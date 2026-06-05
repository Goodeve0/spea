/**
 * 本地会话历史（按用户命名空间隔离）+ 纯计算工具。
 *
 * 设计：本模块零依赖（不引 auth/api），只负责 localStorage 命名空间读写与 streak/XP 计算。
 * 登录态下的"服务端为准 + 本地缓存兜底"协调逻辑见 `growth.ts`。
 */

import type { StoredSession } from '@speak-coach/shared';

const PREFIX = 'speak-coach.history';
const DAY_MS = 86400000;

/** 命名空间 key：登录用户用其 id，游客用 'guest' */
function nsKey(userId?: string): string {
  return `${PREFIX}.${userId ?? 'guest'}`;
}

/** 读取某命名空间的会话（时间倒序） */
export function loadLocalSessions(userId?: string): StoredSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(nsKey(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as StoredSession[];
    if (!Array.isArray(arr)) return [];
    return arr.slice().sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.error('[history.loadLocalSessions] failed:', e);
    return [];
  }
}

/** 写入一条会话到某命名空间（幂等：同 id 覆盖） */
export function saveLocalSession(session: StoredSession, userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadLocalSessions(userId).filter((s) => s.id !== session.id);
    existing.push(session);
    window.localStorage.setItem(nsKey(userId), JSON.stringify(existing));
  } catch (e) {
    console.error('[history.saveLocalSession] failed:', e);
  }
}

/** 用服务端数据覆盖某命名空间缓存 */
export function replaceLocalSessions(sessions: StoredSession[], userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(nsKey(userId), JSON.stringify(sessions));
  } catch (e) {
    console.error('[history.replaceLocalSessions] failed:', e);
  }
}

/** 清空某命名空间 */
export function clearLocalSessions(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(nsKey(userId));
  } catch (e) {
    console.error('[history.clearLocalSessions] failed:', e);
  }
}

export function getGuestSessions(): StoredSession[] {
  return loadLocalSessions(undefined);
}

export function clearGuest(): void {
  clearLocalSessions(undefined);
}

/** 累计经验值：综合分之和 */
export function computeTotalXp(sessions: StoredSession[]): number {
  return sessions.reduce((sum, s) => sum + Math.max(0, Math.round(s.overallScore || 0)), 0);
}

/** 连续练习天数：从今天（或昨天）起向前连续的自然日数 */
export function computeStreak(sessions: StoredSession[]): number {
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map((s) => startOfDay(s.timestamp)));
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
