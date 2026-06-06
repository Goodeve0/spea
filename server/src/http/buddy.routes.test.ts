import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { Server } from 'http';
import type { Api } from '@speak-coach/shared';

import { createHttpApp } from './app';
import { prisma } from '../db/prisma';
import { registerUser } from './auth.service';
import { clearRoomInvites } from './room-invite.store';

let server: Server;
let base = '';

async function clean() {
  await prisma.encouragement.deleteMany();
  await prisma.buddyRequest.deleteMany();
  await prisma.buddy.deleteMany();
  await prisma.report.deleteMany();
  await prisma.turn.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  server = createHttpApp().listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await clean();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await clean();
  clearRoomInvites();
});

function call(path: string, token: string | null, opts: { method?: string; body?: unknown } = {}) {
  return fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function mkUser(email: string) {
  return registerUser(email, 'secret123', email.split('@')[0]);
}

describe('buddy.routes 鉴权', () => {
  it('无 token → 401', async () => {
    const res = await call('/buddy/matches', null);
    expect(res.status).toBe(401);
  });
});

describe('PUT /me/profile', () => {
  it('更新 profile 返回 ok', async () => {
    const a = await mkUser('a@t.com');
    const res = await call('/me/profile', a.token, {
      method: 'PUT',
      body: { avatarKey: 'sprout', nativeLang: 'zh' } satisfies Api.UpdateProfileReq,
    });
    expect(res.status).toBe(200);
    const u = await prisma.user.findUnique({ where: { id: a.user.id } });
    expect(u?.avatarKey).toBe('sprout');
  });
});

describe('matches / requests 流程', () => {
  it('GET /buddy/matches 返回候选', async () => {
    const a = await mkUser('a@t.com');
    await mkUser('b@t.com');
    const res = await call('/buddy/matches', a.token);
    const data = (await res.json()) as Api.MatchesResp;
    expect(data.candidates.map((c) => c.displayName)).toContain('b');
  });

  it('发起邀请 → 对方列表可见 → 接受', async () => {
    const a = await mkUser('a@t.com');
    const b = await mkUser('b@t.com');

    let res = await call('/buddy/requests', a.token, { method: 'POST', body: { toUserId: b.user.id } });
    expect(res.status).toBe(200);

    res = await call('/buddy/requests', b.token);
    const reqs = (await res.json()) as Api.RequestsResp;
    expect(reqs.requests).toHaveLength(1);
    const reqId = reqs.requests[0].requestId;

    res = await call(`/buddy/requests/${reqId}/accept`, b.token, { method: 'POST' });
    expect(res.status).toBe(200);

    res = await call('/buddy/list', a.token);
    const list = (await res.json()) as Api.BuddyListResp;
    expect(list.buddies).toHaveLength(1);
    expect(list.buddies[0].card.userId).toBe(b.user.id);
  });

  it('越权接受 → 403', async () => {
    const a = await mkUser('a@t.com');
    const b = await mkUser('b@t.com');
    const c = await mkUser('c@t.com');
    await call('/buddy/requests', a.token, { method: 'POST', body: { toUserId: b.user.id } });
    const reqs = (await (await call('/buddy/requests', b.token)).json()) as Api.RequestsResp;
    const res = await call(`/buddy/requests/${reqs.requests[0].requestId}/accept`, c.token, { method: 'POST' });
    expect(res.status).toBe(403);
  });
});

describe('解除瓜友', () => {
  it('DELETE /buddy/:id', async () => {
    const a = await mkUser('a@t.com');
    const b = await mkUser('b@t.com');
    await call('/buddy/requests', a.token, { method: 'POST', body: { toUserId: b.user.id } });
    const reqs = (await (await call('/buddy/requests', b.token)).json()) as Api.RequestsResp;
    await call(`/buddy/requests/${reqs.requests[0].requestId}/accept`, b.token, { method: 'POST' });
    const list = (await (await call('/buddy/list', a.token)).json()) as Api.BuddyListResp;
    const res = await call(`/buddy/${list.buddies[0].buddyId}`, a.token, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const after = (await (await call('/buddy/list', a.token)).json()) as Api.BuddyListResp;
    expect(after.buddies).toHaveLength(0);
  });
});

describe('贴纸收发', () => {
  async function makeBuddies(a: { token: string }, b: { token: string; user: { id: string } }) {
    await call('/buddy/requests', a.token, { method: 'POST', body: { toUserId: b.user.id } });
    const reqs = (await (await call('/buddy/requests', b.token)).json()) as Api.RequestsResp;
    await call(`/buddy/requests/${reqs.requests[0].requestId}/accept`, b.token, { method: 'POST' });
  }

  it('向瓜友发贴纸并接收', async () => {
    const a = await mkUser('a@t.com');
    const b = await mkUser('b@t.com');
    await makeBuddies(a, b);
    const res = await call('/buddy/encouragements', a.token, {
      method: 'POST',
      body: { toUserId: b.user.id, stickerKey: 'nice_job' },
    });
    expect(res.status).toBe(200);
    const recv = (await (await call('/buddy/encouragements', b.token)).json()) as Api.EncouragementsResp;
    expect(recv.encouragements[0].stickerKey).toBe('nice_job');
  });

  it('向非瓜友发贴纸 → 403', async () => {
    const a = await mkUser('a@t.com');
    const c = await mkUser('c@t.com');
    const res = await call('/buddy/encouragements', a.token, {
      method: 'POST',
      body: { toUserId: c.user.id, stickerKey: 'nice_job' },
    });
    expect(res.status).toBe(403);
  });
});

describe('排行', () => {
  it('GET /buddy/ranking 含自己', async () => {
    const a = await mkUser('a@t.com');
    const res = await call('/buddy/ranking', a.token);
    const data = (await res.json()) as Api.RankingResp;
    expect(data.ranking.some((e) => e.isSelf)).toBe(true);
  });
});

describe('房间邀请', () => {
  async function makeBuddies(a: { token: string }, b: { token: string; user: { id: string } }) {
    await call('/buddy/requests', a.token, { method: 'POST', body: { toUserId: b.user.id } });
    const reqs = (await (await call('/buddy/requests', b.token)).json()) as Api.RequestsResp;
    await call(`/buddy/requests/${reqs.requests[0].requestId}/accept`, b.token, { method: 'POST' });
  }

  it('邀请瓜友入房 → 对方轮询可取', async () => {
    const a = await mkUser('a@t.com');
    const b = await mkUser('b@t.com');
    await makeBuddies(a, b);
    let res = await call('/buddy/room-invite', a.token, {
      method: 'POST',
      body: { toUserId: b.user.id, roomId: 'room-123' },
    });
    expect(res.status).toBe(200);
    res = await call('/buddy/room-invite', b.token);
    const data = (await res.json()) as Api.RoomInviteResp;
    expect(data.invites).toHaveLength(1);
    expect(data.invites[0].roomId).toBe('room-123');
    expect(data.invites[0].from.userId).toBe(a.user.id);
  });

  it('邀请非瓜友入房 → 403', async () => {
    const a = await mkUser('a@t.com');
    const c = await mkUser('c@t.com');
    const res = await call('/buddy/room-invite', a.token, {
      method: 'POST',
      body: { toUserId: c.user.id, roomId: 'room-x' },
    });
    expect(res.status).toBe(403);
  });
});
