import type { Difficulty, Report, StoredSession } from '@speak-coach/shared';

import { prisma } from '../db/prisma';
import { HttpError } from './errors';

const DAY_MS = 86400000;

interface SessionRow {
  id: string;
  userId: string;
  scenarioId: string;
  difficulty: string;
  overallScore: number;
  cefrEstimate: string | null;
  timestamp: bigint;
  radar: string;
}

function toStored(r: SessionRow): StoredSession {
  return {
    id: r.id,
    userId: r.userId,
    timestamp: Number(r.timestamp),
    scenarioId: r.scenarioId,
    difficulty: r.difficulty as Difficulty,
    radar: JSON.parse(r.radar),
    overallScore: r.overallScore,
    cefrEstimate: r.cefrEstimate ?? undefined,
  };
}

/**
 * 提交一次会话（+可选报告），按 userId 归属，幂等（同 id 重复提交不重复写）。
 * 越权：若该 id 已属于他人则拒绝。
 */
export async function submitSession(
  userId: string,
  session: StoredSession,
  report?: Report,
): Promise<void> {
  const existing = await prisma.session.findUnique({ where: { id: session.id } });
  if (existing) {
    if (existing.userId !== userId) {
      throw new HttpError(403, 'FORBIDDEN', '无权操作该会话');
    }
    return; // 幂等：已存在则跳过
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        id: session.id,
        userId,
        scenarioId: session.scenarioId,
        difficulty: session.difficulty,
        overallScore: session.overallScore,
        cefrEstimate: session.cefrEstimate ?? null,
        hasUserSpeech: true,
        timestamp: BigInt(session.timestamp),
        radar: JSON.stringify(session.radar),
      },
    });

    if (report) {
      await tx.report.create({
        data: {
          sessionId: session.id,
          userId,
          radar: JSON.stringify(report.radar),
          topErrors: JSON.stringify(report.topErrors),
          expressionUpgrades: JSON.stringify(report.expressionUpgrades),
          recasts: JSON.stringify(report.recasts),
          summaryText: report.summaryText,
          cefrEstimate: report.cefrEstimate ?? null,
        },
      });

      const turns = report.annotatedTurns ?? [];
      if (turns.length > 0) {
        await tx.turn.createMany({
          data: turns.map((t) => ({
            sessionId: session.id,
            role: t.role,
            text: t.text,
            ts: BigInt(t.timestamp ?? Date.now()),
          })),
        });
      }
    }
  });
}

/** 列出某用户的历史会话（时间倒序） */
export async function listSessions(userId: string, limit = 100): Promise<StoredSession[]> {
  const rows = await prisma.session.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  return rows.map(toStored);
}

/** 幂等合并游客会话到账号 */
export async function mergeGuestSessions(userId: string, sessions: StoredSession[]): Promise<number> {
  let merged = 0;
  for (const s of sessions) {
    const existing = await prisma.session.findUnique({ where: { id: s.id } });
    if (existing) continue; // 幂等去重
    await prisma.session.create({
      data: {
        id: s.id,
        userId,
        scenarioId: s.scenarioId,
        difficulty: s.difficulty,
        overallScore: s.overallScore,
        cefrEstimate: s.cefrEstimate ?? null,
        hasUserSpeech: true,
        timestamp: BigInt(s.timestamp),
        radar: JSON.stringify(s.radar),
      },
    });
    merged += 1;
  }
  return merged;
}

/** 计算成长数据：streak / 累计 XP / 会话列表 */
export async function computeGrowth(userId: string): Promise<{
  streak: number;
  totalXp: number;
  sessions: StoredSession[];
}> {
  const sessions = await listSessions(userId);
  const totalXp = sessions.reduce((sum, s) => sum + Math.max(0, Math.round(s.overallScore || 0)), 0);
  const streak = computeStreak(sessions.map((s) => s.timestamp));
  return { streak, totalXp, sessions };
}

/** 连续练习天数（从今天或昨天起向前连续的自然日） */
function computeStreak(timestamps: number[]): number {
  if (timestamps.length === 0) return 0;
  const days = new Set(timestamps.map(startOfDay));
  const today = startOfDay(Date.now());
  let cursor: number | null = days.has(today)
    ? today
    : days.has(today - DAY_MS)
      ? today - DAY_MS
      : null;
  if (cursor === null) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
