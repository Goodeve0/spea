/**
 * 日历工具：自然日 / 本周起点 / 连续天数（streak）。
 * 供个人成长 streak 与瓜友连胜共用。
 */

export const DAY_MS = 86400000;

/** 某时间戳所在自然日 0 点（本地时区） */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 某时间戳所在「本地周一 0 点」 */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=周日 .. 6=周六
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return d.getTime() - daysSinceMonday * DAY_MS;
}

/**
 * 从「自然日集合」计算连续天数：
 * 从今天（或昨天，允许今天还没练）起向前连续计数。
 */
export function computeStreakFromDays(days: Set<number>, now: number = Date.now()): number {
  if (days.size === 0) return 0;
  const today = startOfDay(now);
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

/** 从时间戳列表计算连续练习天数 */
export function computeStreak(timestamps: number[], now: number = Date.now()): number {
  return computeStreakFromDays(new Set(timestamps.map(startOfDay)), now);
}
