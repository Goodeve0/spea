/**
 * 瓜友数据层：匹配、邀请、关系、贴纸、排行、连胜。
 * 派生数据（本周次数/擅长场景/最近雷达/CEFR）均从 Session 计算，不冗余存储。
 */
import type {
  BuddyCard,
  BuddyRelation,
  BuddyRequestDTO,
  EncouragementDTO,
  RankingEntry,
  PublicProfileUpdate,
  RadarScores,
  StickerKey,
} from '@speak-coach/shared';
import { cefrToLevel, cefrWithinOneLevel, STICKER_KEYS, BUDDY_COOL_DAYS } from '@speak-coach/shared';

import { prisma } from '../db/prisma';
import { HttpError } from './errors';
import { DAY_MS, startOfDay, startOfWeek, computeStreakFromDays } from '../lib/calendar';

const THIRTY_DAYS_MS = 30 * DAY_MS;

interface UserRow {
  id: string;
  displayName: string;
  avatarKey: string | null;
  nativeLang: string | null;
  practiceSlot: string | null;
  targetScenarios: string | null;
  isSeed: boolean;
}

interface SessionRow {
  scenarioId: string;
  cefrEstimate: string | null;
  timestamp: bigint;
  radar: string;
}

/** 规范化一对用户 id：始终 userAId < userBId */
function canonical(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

/** 用用户行 + 其会话构造瓜友卡片（只露学习数据） */
function cardFromData(user: UserRow, sessions: SessionRow[], now: number = Date.now()): BuddyCard {
  const weekStart = startOfWeek(now);
  // sessions 假定按 timestamp 倒序
  const cefr = sessions.find((s) => s.cefrEstimate)?.cefrEstimate ?? undefined;
  const recent = sessions[0];
  const recentRadar = recent ? (JSON.parse(recent.radar) as RadarScores) : undefined;
  const weeklyPracticeCount = sessions.filter((s) => Number(s.timestamp) >= weekStart).length;

  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (Number(s.timestamp) >= now - THIRTY_DAYS_MS) {
      counts.set(s.scenarioId, (counts.get(s.scenarioId) ?? 0) + 1);
    }
  }
  const topScenarios = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k);

  return {
    userId: user.id,
    displayName: user.displayName,
    avatarKey: user.avatarKey ?? 'melon',
    cefr,
    weeklyPracticeCount,
    topScenarios,
    recentRadar,
    isSeed: user.isSeed || undefined,
  };
}

async function fetchSessions(userId: string): Promise<SessionRow[]> {
  return prisma.session.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    select: { scenarioId: true, cefrEstimate: true, timestamp: true, radar: true },
  });
}

async function practiceDays(userId: string): Promise<Set<number>> {
  const sessions = await prisma.session.findMany({ where: { userId }, select: { timestamp: true } });
  return new Set(sessions.map((s) => startOfDay(Number(s.timestamp))));
}

/** 构造某用户的瓜友卡片 */
export async function buildBuddyCard(userId: string): Promise<BuddyCard> {
  const user = (await prisma.user.findUnique({ where: { id: userId } })) as UserRow | null;
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', '用户不存在');
  const sessions = await fetchSessions(userId);
  return cardFromData(user, sessions);
}

/** 更新可公开 profile（仅传入字段更新） */
export async function updateProfile(userId: string, p: PublicProfileUpdate): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarKey: p.avatarKey ?? undefined,
      nativeLang: p.nativeLang ?? undefined,
      practiceSlot: p.practiceSlot ?? undefined,
      targetScenarios: p.targetScenarios ? JSON.stringify(p.targetScenarios) : undefined,
    },
  });
}

export interface MatchFilters {
  scenario?: string;
  slot?: string;
  lang?: string;
}

/** 匹配候选：CEFR ±1（缺省可匹配），排除自己/已是瓜友/已邀请，可选学习维度过滤 */
export async function findMatches(userId: string, filters: MatchFilters = {}): Promise<BuddyCard[]> {
  const me = (await prisma.user.findUnique({ where: { id: userId } })) as UserRow | null;
  if (!me) throw new HttpError(404, 'USER_NOT_FOUND', '用户不存在');
  const mySessions = await fetchSessions(userId);
  const myCefr = mySessions.find((s) => s.cefrEstimate)?.cefrEstimate ?? undefined;
  const myLevel = cefrToLevel(myCefr);

  // 排除集合：已是瓜友
  const buddies = await prisma.buddy.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
  });
  const excluded = new Set<string>();
  for (const b of buddies) excluded.add(b.userAId === userId ? b.userBId : b.userAId);

  // 排除集合：存在 pending/accepted 邀请（任一方向）
  const reqs = await prisma.buddyRequest.findMany({
    where: {
      OR: [{ fromUserId: userId }, { toUserId: userId }],
      status: { in: ['pending', 'accepted'] },
    },
  });
  for (const rq of reqs) excluded.add(rq.fromUserId === userId ? rq.toUserId : rq.fromUserId);

  const others = (await prisma.user.findMany({ where: { id: { not: userId } } })) as UserRow[];

  const scored: { card: BuddyCard; dist: number }[] = [];
  for (const u of others) {
    if (excluded.has(u.id)) continue;
    const sessions = await fetchSessions(u.id);
    const card = cardFromData(u, sessions);

    // CEFR ±1（缺省可匹配）
    if (!cefrWithinOneLevel(myCefr, card.cefr)) continue;

    // 可选过滤（仅当候选明确冲突才排除）
    if (filters.scenario) {
      const targets = u.targetScenarios ? (JSON.parse(u.targetScenarios) as string[]) : [];
      if (!targets.includes(filters.scenario)) continue;
    }
    if (filters.slot && filters.slot !== 'any') {
      if (u.practiceSlot && u.practiceSlot !== 'any' && u.practiceSlot !== filters.slot) continue;
    }
    if (filters.lang) {
      if (u.nativeLang && u.nativeLang !== filters.lang) continue;
    }

    const candLevel = cefrToLevel(card.cefr);
    const dist = myLevel === null || candLevel === null ? 0 : Math.abs(myLevel - candLevel);
    scored.push({ card, dist });
  }

  scored.sort((x, y) => {
    if (x.dist !== y.dist) return x.dist - y.dist;
    if (x.card.weeklyPracticeCount !== y.card.weeklyPracticeCount) {
      return y.card.weeklyPracticeCount - x.card.weeklyPracticeCount;
    }
    return Math.random() - 0.5;
  });
  return scored.slice(0, 20).map((s) => s.card);
}

/** 当前两人是否已是瓜友（返回 Buddy 行或 null） */
export async function areBuddies(a: string, b: string) {
  const { userAId, userBId } = canonical(a, b);
  return prisma.buddy.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
}

/** 发起瓜友邀请（幂等；不可邀请自己/已是瓜友） */
export async function sendRequest(fromUserId: string, toUserId: string): Promise<void> {
  if (fromUserId === toUserId) throw new HttpError(400, 'INVALID', '不能邀请自己');
  if (await areBuddies(fromUserId, toUserId)) throw new HttpError(409, 'ALREADY_BUDDY', '已经是瓜友了');

  const pending = await prisma.buddyRequest.findFirst({
    where: {
      status: 'pending',
      OR: [
        { fromUserId, toUserId },
        { fromUserId: toUserId, toUserId: fromUserId },
      ],
    },
  });
  if (pending) return; // 幂等

  await prisma.buddyRequest.upsert({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
    update: { status: 'pending', createdAt: new Date() },
    create: { fromUserId, toUserId, status: 'pending' },
  });
}

/** 我收到的 pending 邀请（含发起方卡片） */
export async function listRequests(userId: string): Promise<BuddyRequestDTO[]> {
  const reqs = await prisma.buddyRequest.findMany({
    where: { toUserId: userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  const out: BuddyRequestDTO[] = [];
  for (const rq of reqs) {
    out.push({
      requestId: rq.id,
      from: await buildBuddyCard(rq.fromUserId),
      createdAt: rq.createdAt.getTime(),
    });
  }
  return out;
}

/** 接受邀请：建规范化 Buddy 行，标记 accepted */
export async function acceptRequest(userId: string, requestId: string): Promise<void> {
  const rq = await prisma.buddyRequest.findUnique({ where: { id: requestId } });
  if (!rq) throw new HttpError(404, 'NOT_FOUND', '邀请不存在');
  if (rq.toUserId !== userId) throw new HttpError(403, 'FORBIDDEN', '无权操作该邀请');
  if (rq.status !== 'pending') return;

  const { userAId, userBId } = canonical(rq.fromUserId, rq.toUserId);
  await prisma.$transaction([
    prisma.buddyRequest.update({ where: { id: requestId }, data: { status: 'accepted' } }),
    prisma.buddy.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: { lastInteractAt: new Date() },
      create: { userAId, userBId },
    }),
  ]);
}

/** 拒绝邀请：标记 declined，不建关系 */
export async function declineRequest(userId: string, requestId: string): Promise<void> {
  const rq = await prisma.buddyRequest.findUnique({ where: { id: requestId } });
  if (!rq) throw new HttpError(404, 'NOT_FOUND', '邀请不存在');
  if (rq.toUserId !== userId) throw new HttpError(403, 'FORBIDDEN', '无权操作该邀请');
  await prisma.buddyRequest.update({ where: { id: requestId }, data: { status: 'declined' } });
}

/** 我的瓜友列表（含冷却状态与瓜友连胜） */
export async function listBuddies(userId: string): Promise<BuddyRelation[]> {
  const buddies = await prisma.buddy.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { lastInteractAt: 'desc' },
  });
  const myDays = await practiceDays(userId);
  const now = Date.now();
  const out: BuddyRelation[] = [];
  for (const b of buddies) {
    const otherId = b.userAId === userId ? b.userBId : b.userAId;
    const card = await buildBuddyCard(otherId);
    const lastInteract = b.lastInteractAt.getTime();
    const status: 'active' | 'cooling' =
      now - lastInteract > BUDDY_COOL_DAYS * DAY_MS ? 'cooling' : 'active';
    const otherDays = await practiceDays(otherId);
    const intersection = new Set([...myDays].filter((d) => otherDays.has(d)));
    const mutualStreak = computeStreakFromDays(intersection, now);
    out.push({ buddyId: b.id, card, status, mutualStreak, lastInteractAt: lastInteract });
  }
  return out;
}

/** 解除瓜友（仅参与方） */
export async function removeBuddy(userId: string, buddyId: string): Promise<void> {
  const b = await prisma.buddy.findUnique({ where: { id: buddyId } });
  if (!b) throw new HttpError(404, 'NOT_FOUND', '关系不存在');
  if (b.userAId !== userId && b.userBId !== userId) {
    throw new HttpError(403, 'FORBIDDEN', '无权解除该关系');
  }
  await prisma.buddy.delete({ where: { id: buddyId } });
}

/** 发送预置贴纸（仅瓜友间，校验枚举，更新 lastInteractAt） */
export async function sendEncouragement(
  fromUserId: string,
  toUserId: string,
  stickerKey: StickerKey,
): Promise<void> {
  if (!STICKER_KEYS.includes(stickerKey)) throw new HttpError(400, 'INVALID_STICKER', '无效贴纸');
  const buddy = await areBuddies(fromUserId, toUserId);
  if (!buddy) throw new HttpError(403, 'NOT_BUDDY', '只能给瓜友发送鼓励');
  await prisma.$transaction([
    prisma.encouragement.create({ data: { fromUserId, toUserId, stickerKey } }),
    prisma.buddy.update({ where: { id: buddy.id }, data: { lastInteractAt: new Date() } }),
  ]);
}

/** 收到的贴纸（未读优先），读取后标记已读 */
export async function listEncouragements(userId: string): Promise<EncouragementDTO[]> {
  const items = await prisma.encouragement.findMany({ where: { toUserId: userId } });
  items.sort((a, b) => {
    const ua = a.readAt === null ? 0 : 1;
    const ub = b.readAt === null ? 0 : 1;
    if (ua !== ub) return ua - ub; // 未读(0)在前
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const out: EncouragementDTO[] = [];
  for (const e of items) {
    out.push({
      id: e.id,
      from: await buildBuddyCard(e.fromUserId),
      stickerKey: e.stickerKey as StickerKey,
      createdAt: e.createdAt.getTime(),
      read: e.readAt !== null,
    });
  }
  await prisma.encouragement.updateMany({
    where: { toUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return out;
}

/** 瓜友圈本周练习次数排行（含自己，降序，标识自己） */
export async function getRanking(userId: string): Promise<RankingEntry[]> {
  const buddies = await prisma.buddy.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
  });
  const ids = new Set<string>([userId]);
  for (const b of buddies) ids.add(b.userAId === userId ? b.userBId : b.userAId);

  const weekStart = startOfWeek(Date.now());
  const entries: RankingEntry[] = [];
  for (const id of ids) {
    const user = (await prisma.user.findUnique({ where: { id } })) as UserRow | null;
    if (!user) continue;
    const weeklyPracticeCount = await prisma.session.count({
      where: { userId: id, timestamp: { gte: BigInt(weekStart) } },
    });
    entries.push({
      userId: id,
      displayName: user.displayName,
      avatarKey: user.avatarKey ?? 'melon',
      weeklyPracticeCount,
      isSelf: id === userId,
    });
  }
  entries.sort((a, b) => b.weeklyPracticeCount - a.weeklyPracticeCount);
  return entries;
}
