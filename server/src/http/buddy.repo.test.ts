import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { RadarScores } from '@speak-coach/shared';

import { prisma } from '../db/prisma';
import { registerUser } from './auth.service';
import {
  updateProfile,
  buildBuddyCard,
  findMatches,
  sendRequest,
  listRequests,
  acceptRequest,
  declineRequest,
  listBuddies,
  removeBuddy,
  sendEncouragement,
  listEncouragements,
  getRanking,
  areBuddies,
} from './buddy.repo';
import { HttpError } from './errors';
import { DAY_MS } from '../lib/calendar';

const r = (n: number): RadarScores => ({
  pronunciation: n, fluency: n, grammar: n, vocabulary: n, taskCompletion: n,
});

async function clean() {
  await prisma.encouragement.deleteMany();
  await prisma.buddyRequest.deleteMany();
  await prisma.buddy.deleteMany();
  await prisma.report.deleteMany();
  await prisma.turn.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

let seq = 0;
/** 直接给某用户插入一条会话（绕过 submitSession 的 userId 归属校验） */
async function addSession(
  userId: string,
  opts: { scenarioId?: string; overall?: number; cefr?: string; ts?: number; radar?: RadarScores } = {},
) {
  seq += 1;
  await prisma.session.create({
    data: {
      id: `sess-${userId}-${seq}`,
      userId,
      scenarioId: opts.scenarioId ?? 'interview',
      difficulty: 'intermediate',
      overallScore: opts.overall ?? 70,
      cefrEstimate: opts.cefr ?? null,
      hasUserSpeech: true,
      timestamp: BigInt(opts.ts ?? Date.now()),
      radar: JSON.stringify(opts.radar ?? r(opts.overall ?? 70)),
    },
  });
}

async function mkUser(email: string, cefr?: string) {
  const a = await registerUser(email, 'secret123', email.split('@')[0]);
  if (cefr) await addSession(a.user.id, { cefr });
  return a.user;
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe('buildBuddyCard 派生数据', () => {
  it('CEFR 取最近一条带估算的会话', async () => {
    const u = await registerUser('a@t.com', 'secret123', 'Alice');
    await addSession(u.user.id, { cefr: 'A2', ts: Date.now() - 2 * DAY_MS });
    await addSession(u.user.id, { cefr: 'B1', ts: Date.now() - 1 * DAY_MS });
    const card = await buildBuddyCard(u.user.id);
    expect(card.cefr).toBe('B1');
  });

  it('本周练习次数只统计本周', async () => {
    const u = await registerUser('a@t.com', 'secret123');
    await addSession(u.user.id, { ts: Date.now() });
    await addSession(u.user.id, { ts: Date.now() - 30 * DAY_MS }); // 上个月
    const card = await buildBuddyCard(u.user.id);
    expect(card.weeklyPracticeCount).toBe(1);
  });

  it('擅长场景取近 30 天 Top 2', async () => {
    const u = await registerUser('a@t.com', 'secret123');
    await addSession(u.user.id, { scenarioId: 'interview' });
    await addSession(u.user.id, { scenarioId: 'interview' });
    await addSession(u.user.id, { scenarioId: 'restaurant' });
    await addSession(u.user.id, { scenarioId: 'hotel' });
    const card = await buildBuddyCard(u.user.id);
    expect(card.topScenarios[0]).toBe('interview');
    expect(card.topScenarios).toHaveLength(2);
  });

  it('卡片不含 email', async () => {
    const u = await registerUser('a@t.com', 'secret123', 'Alice');
    const card = await buildBuddyCard(u.user.id);
    expect(card).not.toHaveProperty('email');
    expect(card.displayName).toBe('Alice');
  });
});

describe('findMatches 匹配', () => {
  it('CEFR ±1 内可匹配，相差过大排除', async () => {
    const me = await mkUser('me@t.com', 'B1');
    await mkUser('a2@t.com', 'A2'); // 距离1 ✓
    await mkUser('b2@t.com', 'B2'); // 距离1 ✓
    await mkUser('c1@t.com', 'C1'); // 距离2 ✗
    const cards = await findMatches(me.id);
    const emails = cards.map((c) => c.displayName);
    expect(emails).toContain('a2');
    expect(emails).toContain('b2');
    expect(emails).not.toContain('c1');
  });

  it('缺 CEFR 视为可匹配', async () => {
    const me = await mkUser('me@t.com', 'B1');
    await mkUser('nodata@t.com'); // 无会话无 CEFR
    const cards = await findMatches(me.id);
    expect(cards.map((c) => c.displayName)).toContain('nodata');
  });

  it('排除自己', async () => {
    const me = await mkUser('me@t.com', 'B1');
    const cards = await findMatches(me.id);
    expect(cards.map((c) => c.userId)).not.toContain(me.id);
  });

  it('排除已是瓜友', async () => {
    const me = await mkUser('me@t.com', 'B1');
    const x = await mkUser('x@t.com', 'B1');
    await sendRequest(me.id, x.id);
    const req = (await listRequests(x.id))[0];
    await acceptRequest(x.id, req.requestId);
    const cards = await findMatches(me.id);
    expect(cards.map((c) => c.userId)).not.toContain(x.id);
  });

  it('排除已发出 pending 邀请', async () => {
    const me = await mkUser('me@t.com', 'B1');
    const y = await mkUser('y@t.com', 'B1');
    await sendRequest(me.id, y.id);
    const cards = await findMatches(me.id);
    expect(cards.map((c) => c.userId)).not.toContain(y.id);
  });

  it('同 CEFR 距离时本周次数多者靠前', async () => {
    const me = await mkUser('me@t.com', 'B1');
    const low = await mkUser('low@t.com', 'B1');
    const high = await mkUser('high@t.com', 'B1');
    await addSession(high.id, { ts: Date.now() });
    await addSession(high.id, { ts: Date.now() });
    await addSession(low.id, { ts: Date.now() });
    const cards = await findMatches(me.id);
    const idxHigh = cards.findIndex((c) => c.userId === high.id);
    const idxLow = cards.findIndex((c) => c.userId === low.id);
    expect(idxHigh).toBeLessThan(idxLow);
  });
});

describe('邀请 / 接受 / 拒绝', () => {
  it('发起邀请创建 pending', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await sendRequest(a.id, b.id);
    const reqs = await listRequests(b.id);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].from.userId).toBe(a.id);
  });

  it('不可邀请自己', async () => {
    const a = await mkUser('a@t.com', 'B1');
    await expect(sendRequest(a.id, a.id)).rejects.toBeInstanceOf(HttpError);
  });

  it('邀请幂等：重复不报错也不重复创建', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await sendRequest(a.id, b.id);
    await sendRequest(a.id, b.id);
    expect(await listRequests(b.id)).toHaveLength(1);
  });

  it('接受建立规范化 Buddy（userA<userB）', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await sendRequest(a.id, b.id);
    const req = (await listRequests(b.id))[0];
    await acceptRequest(b.id, req.requestId);
    const buddy = await areBuddies(a.id, b.id);
    expect(buddy).toBeTruthy();
    expect(buddy!.userAId < buddy!.userBId).toBe(true);
  });

  it('拒绝不建立关系', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await sendRequest(a.id, b.id);
    const req = (await listRequests(b.id))[0];
    await declineRequest(b.id, req.requestId);
    expect(await areBuddies(a.id, b.id)).toBeNull();
  });

  it('越权接受被拒（非被邀请方）', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    const c = await mkUser('c@t.com', 'B1');
    await sendRequest(a.id, b.id);
    const req = (await listRequests(b.id))[0];
    await expect(acceptRequest(c.id, req.requestId)).rejects.toMatchObject({ status: 403 });
  });
});

describe('瓜友列表 / 解除', () => {
  async function makeBuddies(a: string, b: string) {
    await sendRequest(a, b);
    const req = (await listRequests(b))[0];
    await acceptRequest(b, req.requestId);
  }

  it('列出瓜友含对方卡片', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await makeBuddies(a.id, b.id);
    const list = await listBuddies(a.id);
    expect(list).toHaveLength(1);
    expect(list[0].card.userId).toBe(b.id);
  });

  it('解除瓜友后互不为瓜友', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await makeBuddies(a.id, b.id);
    const list = await listBuddies(a.id);
    await removeBuddy(a.id, list[0].buddyId);
    expect(await areBuddies(a.id, b.id)).toBeNull();
  });

  it('非参与方不可解除', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    const c = await mkUser('c@t.com', 'B1');
    await makeBuddies(a.id, b.id);
    const list = await listBuddies(a.id);
    await expect(removeBuddy(c.id, list[0].buddyId)).rejects.toMatchObject({ status: 403 });
  });

  it('长期无互动标记 cooling', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await makeBuddies(a.id, b.id);
    // 手动把 lastInteractAt 推到 8 天前
    await prisma.buddy.updateMany({ data: { lastInteractAt: new Date(Date.now() - 8 * DAY_MS) } });
    const list = await listBuddies(a.id);
    expect(list[0].status).toBe('cooling');
  });
});

describe('贴纸鼓励', () => {
  async function makeBuddies(a: string, b: string) {
    await sendRequest(a, b);
    const req = (await listRequests(b))[0];
    await acceptRequest(b, req.requestId);
  }

  it('向瓜友发送贴纸并更新 lastInteractAt', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await makeBuddies(a.id, b.id);
    await prisma.buddy.updateMany({ data: { lastInteractAt: new Date(Date.now() - 8 * DAY_MS) } });
    await sendEncouragement(a.id, b.id, 'nice_job');
    const list = await listBuddies(a.id);
    expect(list[0].status).toBe('active'); // 互动重置冷却
    const recv = await listEncouragements(b.id);
    expect(recv[0].stickerKey).toBe('nice_job');
  });

  it('向非瓜友发送被拒', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const c = await mkUser('c@t.com', 'B1');
    await expect(sendEncouragement(a.id, c.id, 'nice_job')).rejects.toBeInstanceOf(HttpError);
  });

  it('非法 stickerKey 被拒', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await makeBuddies(a.id, b.id);
    await expect(sendEncouragement(a.id, b.id, 'evil' as never)).rejects.toBeInstanceOf(HttpError);
  });

  it('接收后标记已读，未读优先', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await makeBuddies(a.id, b.id);
    await sendEncouragement(a.id, b.id, 'nice_job');
    const first = await listEncouragements(b.id);
    expect(first[0].read).toBe(false);
    const second = await listEncouragements(b.id);
    expect(second[0].read).toBe(true);
  });
});

describe('排行 + 瓜友连胜', () => {
  async function makeBuddies(a: string, b: string) {
    await sendRequest(a, b);
    const req = (await listRequests(b))[0];
    await acceptRequest(b, req.requestId);
  }

  it('排行仅含瓜友圈，本周降序，标识自己', async () => {
    const me = await mkUser('me@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    const c = await mkUser('c@t.com', 'B1');
    const d = await mkUser('d@t.com', 'B1'); // 非瓜友
    await makeBuddies(me.id, b.id);
    await makeBuddies(me.id, c.id);
    await addSession(c.id, { ts: Date.now() });
    await addSession(c.id, { ts: Date.now() });
    await addSession(me.id, { ts: Date.now() });
    const ranking = await getRanking(me.id);
    const ids = ranking.map((x) => x.userId);
    expect(ids).toContain(me.id);
    expect(ids).toContain(b.id);
    expect(ids).toContain(c.id);
    expect(ids).not.toContain(d.id);
    expect(ranking[0].userId).toBe(c.id); // c 本周 2 次最多
    expect(ranking.find((x) => x.userId === me.id)!.isSelf).toBe(true);
  });

  it('瓜友连胜：双方连续同日练习', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await makeBuddies(a.id, b.id);
    const now = Date.now();
    for (const ts of [now, now - DAY_MS, now - 2 * DAY_MS]) {
      await addSession(a.id, { ts });
      await addSession(b.id, { ts });
    }
    const list = await listBuddies(a.id);
    expect(list[0].mutualStreak).toBe(3);
  });

  it('瓜友连胜：一方某日缺席则中断', async () => {
    const a = await mkUser('a@t.com', 'B1');
    const b = await mkUser('b@t.com', 'B1');
    await makeBuddies(a.id, b.id);
    const now = Date.now();
    await addSession(a.id, { ts: now });
    await addSession(b.id, { ts: now });
    await addSession(a.id, { ts: now - DAY_MS }); // 昨天只有 a
    const list = await listBuddies(a.id);
    expect(list[0].mutualStreak).toBe(1);
  });
});

describe('updateProfile', () => {
  it('更新可公开 profile', async () => {
    const a = await mkUser('a@t.com', 'B1');
    await updateProfile(a.id, { avatarKey: 'sprout', nativeLang: 'zh', practiceSlot: 'night', targetScenarios: ['interview'] });
    const card = await buildBuddyCard(a.id);
    expect(card.avatarKey).toBe('sprout');
  });
});
