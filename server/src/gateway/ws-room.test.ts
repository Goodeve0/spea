import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { ILlmClient } from '../lib/llm-client';

import { WsGateway } from './ws-gateway';
import { DialogService } from '../modules/dialog.service';
import { CorrectionService } from '../modules/correction.service';
import { ReportService } from '../modules/report.service';
import { MockAsrService } from '../modules/asr.service';
import { MockTtsService } from '../modules/tts.service';
import { MockPronunciationService } from '../modules/pronunciation.service';
import { prisma } from '../db/prisma';
import { registerUser } from '../http/auth.service';

function mkLlm(): ILlmClient {
  return {
    complete: async () => 'Welcome to the room!',
    stream: async (_m, onToken) => {
      const t = 'Sure, go ahead.';
      for (const c of t) onToken(c);
      return t;
    },
  };
}

function mkWs() {
  const sent: Array<{ type: string; payload: any }> = [];
  const ws = { readyState: 1, send: (d: string) => sent.push(JSON.parse(d)) } as any;
  return { ws, sent };
}

function buildGateway(): WsGateway {
  return new WsGateway(
    new DialogService(mkLlm()),
    new CorrectionService(mkLlm()),
    new ReportService(mkLlm()),
    new MockAsrService(),
    new MockTtsService(),
    new MockPronunciationService(),
  );
}

async function clean() {
  await prisma.encouragement.deleteMany();
  await prisma.buddyRequest.deleteMany();
  await prisma.buddy.deleteMany();
  await prisma.report.deleteMany();
  await prisma.turn.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

let gateway: WsGateway;
let tokenA = '', tokenB = '', tokenC = '', idA = '', idB = '';

beforeEach(async () => {
  await clean();
  gateway = buildGateway();
  const a = await registerUser('a@t.com', 'secret123', 'Alice');
  const b = await registerUser('b@t.com', 'secret123', 'Bob');
  const c = await registerUser('c@t.com', 'secret123', 'Cara');
  tokenA = a.token; tokenB = b.token; tokenC = c.token;
  idA = a.user.id; idB = b.user.id;
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

function send(ws: any, type: string, payload: unknown) {
  return (gateway as any).handleMessage(ws, { type, payload });
}

function roomIdFrom(sent: Array<{ type: string; payload: any }>): string {
  return sent.find((m) => m.type === 'room.created')!.payload.roomId;
}

describe('建房 / 入房 / 鉴权', () => {
  it('合法 token 建房 → room.created + room.joined', async () => {
    const a = mkWs();
    await send(a.ws, 'room.create', { token: tokenA, scenarioId: 'restaurant', difficulty: 'beginner' });
    expect(a.sent.find((m) => m.type === 'room.created')).toBeTruthy();
    expect(a.sent.find((m) => m.type === 'room.joined')).toBeTruthy();
  });

  it('无效 token 建房 → room.error UNAUTHORIZED', async () => {
    const a = mkWs();
    await send(a.ws, 'room.create', { token: 'bad', scenarioId: 'restaurant', difficulty: 'beginner' });
    const err = a.sent.find((m) => m.type === 'room.error');
    expect(err?.payload.code).toBe('UNAUTHORIZED');
  });

  it('满员第三人加入 → room.error ROOM_FULL', async () => {
    const a = mkWs(); const b = mkWs(); const c = mkWs();
    await send(a.ws, 'room.create', { token: tokenA, scenarioId: 'restaurant', difficulty: 'beginner' });
    const roomId = roomIdFrom(a.sent);
    await send(b.ws, 'room.join', { token: tokenB, roomId });
    await send(c.ws, 'room.join', { token: tokenC, roomId });
    const err = c.sent.find((m) => m.type === 'room.error');
    expect(err?.payload.code).toBe('ROOM_FULL');
  });
});

describe('两人到齐开场', () => {
  it('到齐广播 room.ready，初始轮次为创建者', async () => {
    const a = mkWs(); const b = mkWs();
    await send(a.ws, 'room.create', { token: tokenA, scenarioId: 'restaurant', difficulty: 'beginner' });
    const roomId = roomIdFrom(a.sent);
    await send(b.ws, 'room.join', { token: tokenB, roomId });

    const readyA = a.sent.find((m) => m.type === 'room.ready');
    const readyB = b.sent.find((m) => m.type === 'room.ready');
    expect(readyA).toBeTruthy();
    expect(readyB).toBeTruthy();
    expect(readyA!.payload.currentTurnUserId).toBe(idA);
    expect(readyA!.payload.greeting).toBe('Welcome to the room!');
  });

  it('加入时对方收到 room.peer.joined', async () => {
    const a = mkWs(); const b = mkWs();
    await send(a.ws, 'room.create', { token: tokenA, scenarioId: 'restaurant', difficulty: 'beginner' });
    const roomId = roomIdFrom(a.sent);
    await send(b.ws, 'room.join', { token: tokenB, roomId });
    expect(a.sent.find((m) => m.type === 'room.peer.joined')?.payload.member.userId).toBe(idB);
  });
});

describe('轮次仲裁', () => {
  async function setupRoom() {
    const a = mkWs(); const b = mkWs();
    await send(a.ws, 'room.create', { token: tokenA, scenarioId: 'restaurant', difficulty: 'beginner' });
    const roomId = roomIdFrom(a.sent);
    await send(b.ws, 'room.join', { token: tokenB, roomId });
    return { a, b, roomId };
  }

  it('当前轮用户发言 → 对方收到 peer.utterance + AI 回复 + 切轮', async () => {
    const { a, b } = await setupRoom();
    await send(a.ws, 'room.utterance', { text: "I'd like a table" });

    expect(b.sent.find((m) => m.type === 'room.peer.utterance')?.payload.text).toBe("I'd like a table");
    expect(a.sent.find((m) => m.type === 'room.ai.text')).toBeTruthy();
    expect(a.sent.find((m) => m.type === 'room.ai.done')).toBeTruthy();
    const turn = a.sent.filter((m) => m.type === 'room.turn').pop();
    expect(turn?.payload.currentTurnUserId).toBe(idB); // 轮次切到 B
  });

  it('非当前轮用户发言 → room.error NOT_YOUR_TURN', async () => {
    const { b } = await setupRoom();
    await send(b.ws, 'room.utterance', { text: 'not my turn' });
    expect(b.sent.find((m) => m.type === 'room.error')?.payload.code).toBe('NOT_YOUR_TURN');
  });
});

describe('掉线降级', () => {
  it('一方离开 → 对方收到 room.peer.left，轮次归剩余者', async () => {
    const a = mkWs(); const b = mkWs();
    await send(a.ws, 'room.create', { token: tokenA, scenarioId: 'restaurant', difficulty: 'beginner' });
    const roomId = roomIdFrom(a.sent);
    await send(b.ws, 'room.join', { token: tokenB, roomId });

    await (gateway as any).removeFromRoom(b.ws);

    expect(a.sent.find((m) => m.type === 'room.peer.left')?.payload.userId).toBe(idB);
    const turn = a.sent.filter((m) => m.type === 'room.turn').pop();
    expect(turn?.payload.currentTurnUserId).toBe(idA);
  });
});

describe('结束记会话', () => {
  it('双方均发言后结束 → 各记一次 Session', async () => {
    const a = mkWs(); const b = mkWs();
    await send(a.ws, 'room.create', { token: tokenA, scenarioId: 'restaurant', difficulty: 'beginner' });
    const roomId = roomIdFrom(a.sent);
    await send(b.ws, 'room.join', { token: tokenB, roomId });

    await send(a.ws, 'room.utterance', { text: 'Hello there' });
    await send(b.ws, 'room.utterance', { text: 'Hi, can I see the menu' });

    await send(a.ws, 'room.end', {});

    expect(a.sent.find((m) => m.type === 'room.ended')).toBeTruthy();
    expect(await prisma.session.count({ where: { userId: idA } })).toBe(1);
    expect(await prisma.session.count({ where: { userId: idB } })).toBe(1);
  });

  it('无发言的参与者不记录会话', async () => {
    const a = mkWs(); const b = mkWs();
    await send(a.ws, 'room.create', { token: tokenA, scenarioId: 'restaurant', difficulty: 'beginner' });
    const roomId = roomIdFrom(a.sent);
    await send(b.ws, 'room.join', { token: tokenB, roomId });

    await send(a.ws, 'room.utterance', { text: 'Only I speak' });
    await send(a.ws, 'room.end', {});

    expect(await prisma.session.count({ where: { userId: idA } })).toBe(1);
    expect(await prisma.session.count({ where: { userId: idB } })).toBe(0);
  });
});
