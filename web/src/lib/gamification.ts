/**
 * 游戏化逻辑层（纯函数）：等级 / 经验进度 / 成就 / 每日目标。
 * 全部基于真实成长数据（StoredSession + streak）派生，不写死。
 */
import type { StoredSession } from '@speak-coach/shared';

const DAY_MS = 86400000;

/** 内置场景 id 全集（不含 custom） */
const ALL_BUILTIN_SCENES = new Set([
  'interview', 'meeting', 'presentation', 'restaurant',
  'doctor', 'shopping', 'hotel', 'smalltalk', 'ielts',
]);

/** 到达某等级所需的累计 XP：cum(level) = 30 * (level-1) * level
 *  level1=0, level2=60, level3=180, level4=360, level5=600 ... 递增
 *  （系数 30：一次约 60-85 分的练习即可从 1 级升到 2 级，保证首次升级即时反馈） */
function cumXp(level: number): number {
  return 30 * (level - 1) * level;
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  levelBaseXp: number; // 当前等级起点累计 XP
  nextLevelXp: number; // 升到下一级所需累计 XP
  intoLevel: number;   // 级内已获得 XP
  levelSpan: number;   // 本级所需跨度
  progress: number;    // 0..1
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
  if (level >= 6)  return { name: '蜜瓜', emoji: '🍈' };
  if (level >= 3)  return { name: '青瓜', emoji: '🥒' };
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
  /** scenarioId → 练习次数（由 evaluateAchievements 预计算） */
  scenarioCounts: Map<string, number>;
}

interface AchievementDef extends Omit<Achievement, 'unlocked'> {
  check: (ctx: AchievementCtx) => boolean;
}

// ── 成就定义（名称走「种瓜得瓜」谐音梗；icon 用 emoji 兜底无自绘图标场景）──────
const ACHIEVEMENTS: AchievementDef[] = [
  // ── 里程碑：入门 ─────────────────────────────────────────────────────────
  {
    id: 'first_step',
    icon: '🌱',
    title: '呱呱坠地',
    desc: '完成第 1 次练习',
    check: (c) => c.sessions.length >= 1,
  },

  // ── 里程碑：累计次数 ──────────────────────────────────────────────────────
  {
    id: 'ten_sessions',
    icon: '🧺',
    title: '老瓜熟路',
    desc: '累计练习 10 次',
    check: (c) => c.sessions.length >= 10,
  },
  {
    id: 'sessions_30',
    icon: '🌾',
    title: '万里瓜途',
    desc: '累计练习 30 次',
    check: (c) => c.sessions.length >= 30,
  },
  {
    id: 'sessions_100',
    icon: '💯',
    title: '百练成瓜',
    desc: '累计练习 100 次',
    check: (c) => c.sessions.length >= 100,
  },

  // ── 连击 ────────────────────────────────────────────────────────────────
  {
    id: 'streak_3',
    icon: '💧',
    title: '勤浇水',
    desc: '连续练习 3 天',
    check: (c) => c.streak >= 3,
  },
  {
    id: 'streak_7',
    icon: '🌿',
    title: '瓜藤盘绕',
    desc: '连续练习 7 天',
    check: (c) => c.streak >= 7,
  },
  {
    id: 'streak_14',
    icon: '🍂',
    title: '瓜熟蒂落',
    desc: '连续练习 14 天',
    check: (c) => c.streak >= 14,
  },
  {
    id: 'streak_30',
    icon: '🔥',
    title: '瓜不间断',
    desc: '连续练习 30 天',
    check: (c) => c.streak >= 30,
  },

  // ── 时段特辑 ─────────────────────────────────────────────────────────────
  {
    id: 'early_bird',
    icon: '🌅',
    title: '晨光练瓜',
    desc: '6:00-8:00 完成练习',
    check: (c) => c.sessions.some((s) => {
      const h = new Date(s.timestamp).getHours();
      return h >= 6 && h < 8;
    }),
  },
  {
    id: 'night_owl',
    icon: '🦉',
    title: '夜半偷瓜',
    desc: '22:00-6:00 完成练习',
    check: (c) => c.sessions.some((s) => {
      const h = new Date(s.timestamp).getHours();
      return h >= 22 || h < 6;
    }),
  },

  // ── 单日爆发 ─────────────────────────────────────────────────────────────
  {
    id: 'speed_run',
    icon: '⚡',
    title: '速成瓜',
    desc: '同一天练 3 次',
    check: (c) => {
      const dayCounts: Record<number, number> = {};
      c.sessions.forEach((s) => {
        const d = startOfDay(s.timestamp);
        dayCounts[d] = (dayCounts[d] || 0) + 1;
      });
      return Object.values(dayCounts).some((n) => n >= 3);
    },
  },

  // ── 分数类 ───────────────────────────────────────────────────────────────
  {
    id: 'high_scorer',
    icon: '🍯',
    title: '甜度爆表',
    desc: '单次综合分 ≥ 90',
    check: (c) => c.sessions.some((s) => s.overallScore >= 90),
  },
  {
    id: 'perfect_five',
    icon: '👑',
    title: '瓜神降临',
    desc: '5 维能力全 ≥ 80',
    check: (c) => c.sessions.some((s) => {
      const r = s.radar;
      return r.pronunciation >= 80 && r.fluency >= 80 &&
             r.grammar >= 80 && r.vocabulary >= 80 && r.taskCompletion >= 80;
    }),
  },
  {
    id: 'pronunciation_ace',
    icon: '🎙️',
    title: '播音腔',
    desc: '发音评分 ≥ 90',
    check: (c) => c.sessions.some((s) => s.radar.pronunciation >= 90),
  },
  {
    id: 'fluency_ace',
    icon: '🌊',
    title: '滔滔不绝',
    desc: '流利度评分 ≥ 90',
    check: (c) => c.sessions.some((s) => s.radar.fluency >= 90),
  },

  // ── 进步类 ───────────────────────────────────────────────────────────────
  {
    id: 'comeback',
    icon: '📈',
    title: '越练越甜',
    desc: '最近 5 次均分超过前 5 次',
    check: (c) => {
      const s = c.sessions;
      if (s.length < 10) return false;
      const recent = s.slice(0, 5).reduce((sum, x) => sum + x.overallScore, 0) / 5;
      const prev = s.slice(5, 10).reduce((sum, x) => sum + x.overallScore, 0) / 5;
      return recent > prev;
    },
  },

  // ── 场景探索 ─────────────────────────────────────────────────────────────
  {
    id: 'all_rounder',
    icon: '🍈',
    title: '瓜样百出',
    desc: '体验 3 种不同场景',
    check: (c) => new Set(c.sessions.map((s) => s.scenarioId)).size >= 3,
  },
  {
    id: 'all_scenes',
    icon: '🗺️',
    title: '走南闯北',
    desc: '体验全部 9 种内置场景',
    check: (c) => {
      const tried = new Set(c.sessions.map((s) => s.scenarioId));
      return [...ALL_BUILTIN_SCENES].every((sc) => tried.has(sc));
    },
  },
  {
    id: 'scenario_master',
    icon: '🎯',
    title: '专精一门',
    desc: '同一场景累计练习 10 次',
    check: (c) => [...c.scenarioCounts.values()].some((n) => n >= 10),
  },

  // ── 挑战类 ───────────────────────────────────────────────────────────────
  {
    id: 'challenger',
    icon: '⚔️',
    title: '迎刃而解',
    desc: '高级模式完成 5 次',
    check: (c) => c.sessions.filter((s) => s.difficulty === 'advanced').length >= 5,
  },
];

export function evaluateAchievements(sessions: StoredSession[], streak: number): Achievement[] {
  // 预计算按场景分组次数，供多个 check 复用
  const scenarioCounts = new Map<string, number>();
  for (const s of sessions) {
    scenarioCounts.set(s.scenarioId, (scenarioCounts.get(s.scenarioId) ?? 0) + 1);
  }

  // sessions 按时间倒序（最新在前），部分 check（如 comeback）依赖此顺序
  const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);

  const ctx: AchievementCtx = { sessions: sorted, streak, scenarioCounts };
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
