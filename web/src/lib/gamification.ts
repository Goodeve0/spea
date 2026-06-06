/**
 * 游戏化逻辑层（纯函数）：等级 / 经验进度 / 成就 / 每日目标。
 * 全部基于真实成长数据（StoredSession + streak）派生，不写死。
 */
import type { StoredSession } from '@speak-coach/shared';

const DAY_MS = 86400000;

/** 到达某等级所需的累计 XP：cum(level) = 50 * (level-1) * level
 *  level1=0, level2=100, level3=300, level4=600 ... 递增 */
function cumXp(level: number): number {
  return 50 * (level - 1) * level;
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  levelBaseXp: number; // 当前等级起点累计 XP
  nextLevelXp: number; // 升到下一级所需累计 XP
  intoLevel: number; // 级内已获得 XP
  levelSpan: number; // 本级所需跨度
  progress: number; // 0..1
}

export function levelInfo(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  let level = 1;
  while (cumXp(level + 1) <= xp) level += 1;
  const levelBaseXp = cumXp(level);
  const nextLevelXp = cumXp(level + 1);
  const levelSpan = nextLevelXp - levelBaseXp;
  const intoLevel = xp - levelBaseXp;
  return {
    level,
    totalXp: xp,
    levelBaseXp,
    nextLevelXp,
    intoLevel,
    levelSpan,
    progress: levelSpan > 0 ? intoLevel / levelSpan : 0,
  };
}

export interface LevelStage {
  name: string;
  emoji: string;
}

/** 瓜级阶段（按等级映射到哈密瓜成熟阶段）。 */
export function levelStage(level: number): LevelStage {
  if (level >= 15) return { name: '瓜王', emoji: '👑' };
  if (level >= 10) return { name: '金瓜', emoji: '🏅' };
  if (level >= 6) return { name: '蜜瓜', emoji: '🍈' };
  if (level >= 3) return { name: '青瓜', emoji: '🥒' };
  return { name: '瓜苗', emoji: '🌱' };
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
}

interface AchievementCtx {
  sessions: StoredSession[];
  streak: number;
}

interface AchievementDef extends Omit<Achievement, 'unlocked'> {
  check: (ctx: AchievementCtx) => boolean;
}

// 名称走「种瓜得瓜」谐音梗；icon 为无自绘图标场景下的 emoji 兜底
const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_step', icon: '🌱', title: '呱呱坠地', desc: '完成第 1 次练习', check: (c) => c.sessions.length >= 1 },
  { id: 'streak_3', icon: '💧', title: '勤浇水', desc: '连续练习 3 天', check: (c) => c.streak >= 3 },
  { id: 'streak_7', icon: '🌿', title: '瓜藤盘绕', desc: '连续练习 7 天', check: (c) => c.streak >= 7 },
  { id: 'ten_sessions', icon: '🧺', title: '老瓜熟路', desc: '累计练习 10 次', check: (c) => c.sessions.length >= 10 },
  { id: 'high_scorer', icon: '🍯', title: '甜度爆表', desc: '单次综合分 ≥ 90', check: (c) => c.sessions.some((s) => s.overallScore >= 90) },
  { id: 'all_rounder', icon: '🍈', title: '瓜样百出', desc: '体验 3 种不同场景', check: (c) => new Set(c.sessions.map((s) => s.scenarioId)).size >= 3 },
];

export function evaluateAchievements(sessions: StoredSession[], streak: number): Achievement[] {
  const ctx: AchievementCtx = { sessions, streak };
  return ACHIEVEMENTS.map((d) => ({
    id: d.id,
    icon: d.icon,
    title: d.title,
    desc: d.desc,
    unlocked: d.check(ctx),
  }));
}

/** 今日是否已完成至少一次练习 */
export function todayDone(sessions: StoredSession[]): boolean {
  const today = startOfDay(Date.now());
  return sessions.some((s) => startOfDay(s.timestamp) === today);
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export { cumXp as _cumXp, DAY_MS as _DAY_MS };
