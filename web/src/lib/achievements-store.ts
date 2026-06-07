/**
 * 徽章获得时间追踪（localStorage，按用户命名空间）。
 *
 * evaluateAchievements 只产出"是否已解锁"，无法知道"何时解锁"。
 * 本模块在首次检测到某徽章解锁时记录时间戳，用于：
 *  - 成就页展示"获得时间"
 *  - 报告页检测"本次新解锁的徽章"并弹庆祝
 */

const PREFIX = 'speak-coach.achievements';

function nsKey(userId?: string): string {
  return `${PREFIX}.${userId ?? 'guest'}`;
}

/** 读取已记录的徽章获得时间（achievementId → epoch ms） */
export function loadEarnedTimes(userId?: string): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(nsKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * 同步当前已解锁徽章的获得时间：为尚未记录的解锁项打上当前时间戳。
 * @returns earnedTimes 最新映射；newlyEarned 本次首次记录（即新解锁）的 id 列表
 */
export function syncEarnedTimes(
  unlockedIds: string[],
  userId?: string,
): { earnedTimes: Record<string, number>; newlyEarned: string[] } {
  const earnedTimes = loadEarnedTimes(userId);
  const newlyEarned: string[] = [];
  const now = Date.now();

  for (const id of unlockedIds) {
    if (!(id in earnedTimes)) {
      earnedTimes[id] = now;
      newlyEarned.push(id);
    }
  }

  if (newlyEarned.length > 0 && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(nsKey(userId), JSON.stringify(earnedTimes));
    } catch {
      /* 忽略写入失败 */
    }
  }

  return { earnedTimes, newlyEarned };
}

/** 格式化获得时间为简洁中文（如 2026年6月7日） */
export function formatEarnedTime(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
