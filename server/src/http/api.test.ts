import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { Report, StoredSession } from '@speak-coach/shared';

import { prisma } from '../db/prisma';
import { registerUser, loginUser, verifyToken } from './auth.service';
import { submitSession, listSessions, mergeGuestSessions, computeGrowth } from './repo';

const DAY = 86400000;

async function clean() {
  await prisma.report.deleteMany();
  await prisma.turn.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

function mkSession(id: string, overall: number, ts = Date.now()): StoredSession {
  return {
    id,
    timestamp: ts,
    scenarioId: 'interview',
    difficulty: 'intermediate',
    radar: {
      pronunciation: overall,
      fluency: overall,
      grammar: overall,
      vocabulary: overall,
      taskCompletion: overall,
    },
    overallScore: overall,
  };
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe('auth.service', () => {
  it('注册返回 token 与 user，token 可解析回 userId', async () => {
    const r = await registerUser('a@test.com', 'secret123', 'Alice');
    expect(r.user.email).toBe('a@test.com');
    expect(r.user.displayName).toBe('Alice');
    expect(verifyToken(r.token)).toBe(r.user.id);
  });

  it('重复邮箱注册抛 409', async () => {
    await registerUser('a@test.com', 'secret123');
    await expect(registerUser('a@test.com', 'secret123')).rejects.toMatchObject({ status: 409 });
  });

  it('密码过短抛 400', async () => {
    await expect(registerUser('b@test.com', '123')).rejects.toMatchObject({ status: 400 });
  });

  it('登录成功/密码错/用户不存在', async () => {
    await registerUser('c@test.com', 'secret123');
    const ok = await loginUser('c@test.com', 'secret123');
    expect(ok.user.email).toBe('c@test.com');
    await expect(loginUser('c@test.com', 'wrong')).rejects.toMatchObject({ status: 401 });
    await expect(loginUser('no@test.com', 'secret123')).rejects.toMatchObject({ status: 401 });
  });

  it('密码以哈希存储（非明文）', async () => {
    await registerUser('d@test.com', 'secret123');
    const u = await prisma.user.findUnique({ where: { email: 'd@test.com' } });
    expect(u?.passwordHash).toBeTruthy();
    expect(u?.passwordHash).not.toBe('secret123');
  });
});

describe('repo 持久化与隔离', () => {
  it('提交后可按用户读取', async () => {
    const a = await registerUser('a@test.com', 'secret123');
    await submitSession(a.user.id, mkSession('s1', 80));
    const list = await listSessions(a.user.id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('s1');
    expect(list[0].overallScore).toBe(80);
  });

  it('用户间隔离：A 看不到 B 的数据', async () => {
    const a = await registerUser('a@test.com', 'secret123');
    const b = await registerUser('b@test.com', 'secret123');
    await submitSession(a.user.id, mkSession('s1', 80));
    await submitSession(b.user.id, mkSession('s2', 70));
    expect((await listSessions(a.user.id)).map((s) => s.id)).toEqual(['s1']);
    expect((await listSessions(b.user.id)).map((s) => s.id)).toEqual(['s2']);
  });

  it('幂等：同 id 重复提交不重复', async () => {
    const a = await registerUser('a@test.com', 'secret123');
    await submitSession(a.user.id, mkSession('s1', 80));
    await submitSession(a.user.id, mkSession('s1', 80));
    expect(await listSessions(a.user.id)).toHaveLength(1);
  });

  it('越权：提交他人已有会话 id 抛 403', async () => {
    const a = await registerUser('a@test.com', 'secret123');
    const b = await registerUser('b@test.com', 'secret123');
    await submitSession(a.user.id, mkSession('s1', 80));
    await expect(submitSession(b.user.id, mkSession('s1', 50))).rejects.toMatchObject({ status: 403 });
  });

  it('合并游客会话幂等', async () => {
    const a = await registerUser('a@test.com', 'secret123');
    const guest = [mkSession('g1', 60), mkSession('g2', 70)];
    expect(await mergeGuestSessions(a.user.id, guest)).toBe(2);
    expect(await mergeGuestSessions(a.user.id, guest)).toBe(0);
    expect(await listSessions(a.user.id)).toHaveLength(2);
  });

  it('computeGrowth 计算 xp 与 streak', async () => {
    const a = await registerUser('a@test.com', 'secret123');
    const today = Date.now();
    await submitSession(a.user.id, mkSession('s1', 60, today));
    await submitSession(a.user.id, mkSession('s2', 80, today - DAY));
    const g = await computeGrowth(a.user.id);
    expect(g.totalXp).toBe(140);
    expect(g.streak).toBe(2);
    expect(g.sessions).toHaveLength(2);
  });

  it('提交报告写入 turns 与 report', async () => {
    const a = await registerUser('a@test.com', 'secret123');
    const session = mkSession('s1', 80);
    const now = Date.now();
    const report: Report = {
      sessionId: 's1',
      radar: session.radar,
      topErrors: [],
      expressionUpgrades: [],
      recasts: [],
      summaryText: 'good',
      annotatedTurns: [
        { id: 't1', sessionId: 's1', role: 'ai', text: 'Hi', timestamp: now, corrections: [] },
        { id: 't2', sessionId: 's1', role: 'user', text: 'Hello', timestamp: now, corrections: [] },
      ],
      cefrEstimate: 'B2',
    };
    await submitSession(a.user.id, session, report);
    expect(await prisma.turn.findMany({ where: { sessionId: 's1' } })).toHaveLength(2);
    const rep = await prisma.report.findUnique({ where: { sessionId: 's1' } });
    expect(rep?.summaryText).toBe('good');
  });
});
