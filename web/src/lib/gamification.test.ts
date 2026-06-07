import { describe, it, expect } from 'vitest';
import type { StoredSession } from '@speak-coach/shared';

import { levelInfo, evaluateAchievements, todayDone } from './gamification';

const DAY = 86400000;

function mk(
  id: string,
  overall: number,
  scenarioId = 'interview',
  ts = Date.now(),
  opts: Partial<Pick<StoredSession, 'difficulty' | 'radar'>> = {},
): StoredSession {
  return {
    id,
    timestamp: ts,
    scenarioId,
    difficulty: opts.difficulty ?? 'intermediate',
    radar: opts.radar ?? {
      pronunciation: overall,
      fluency: overall,
      grammar: overall,
      vocabulary: overall,
      taskCompletion: overall,
    },
    overallScore: overall,
  };
}

// ── levelInfo ──────────────────────────────────────────────────────────────
describe('levelInfo', () => {
  it('0 XP 为 1 级', () => {
    const l = levelInfo(0);
    expect(l.level).toBe(1);
    expect(l.progress).toBe(0);
    expect(l.nextLevelXp).toBe(60);
  });

  it('阈值边界：60 XP 升到 2 级', () => {
    expect(levelInfo(59).level).toBe(1);
    expect(levelInfo(60).level).toBe(2);
    expect(levelInfo(179).level).toBe(2);
    expect(levelInfo(180).level).toBe(3);
  });

  it('级内进度计算正确', () => {
    const l = levelInfo(120); // 2 级（60~180），级内 60/120
    expect(l.level).toBe(2);
    expect(l.intoLevel).toBe(60);
    expect(l.levelSpan).toBe(120);
    expect(l.progress).toBeCloseTo(0.5, 5);
  });

  it('负数/异常输入归一为 1 级', () => {
    expect(levelInfo(-50).level).toBe(1);
    expect(levelInfo(NaN).level).toBe(1);
  });
});

// ── evaluateAchievements ───────────────────────────────────────────────────
describe('evaluateAchievements', () => {
  it('无数据时全部未解锁', () => {
    const list = evaluateAchievements([], 0);
    expect(list.every((a) => !a.unlocked)).toBe(true);
  });

  // 里程碑
  it('首次练习解锁 first_step', () => {
    const list = evaluateAchievements([mk('s1', 70)], 1);
    expect(list.find((a) => a.id === 'first_step')?.unlocked).toBe(true);
  });

  it('累计 10 次解锁 ten_sessions', () => {
    const s = Array.from({ length: 10 }, (_, i) => mk(`s${i}`, 70));
    expect(evaluateAchievements(s, 1).find((a) => a.id === 'ten_sessions')?.unlocked).toBe(true);
    expect(evaluateAchievements(s.slice(0, 9), 1).find((a) => a.id === 'ten_sessions')?.unlocked).toBe(false);
  });

  it('累计 30 次解锁 sessions_30', () => {
    const s30 = Array.from({ length: 30 }, (_, i) => mk(`s${i}`, 70));
    expect(evaluateAchievements(s30, 1).find((a) => a.id === 'sessions_30')?.unlocked).toBe(true);
    expect(evaluateAchievements(s30.slice(0, 29), 1).find((a) => a.id === 'sessions_30')?.unlocked).toBe(false);
  });

  it('累计 100 次解锁 sessions_100', () => {
    const s100 = Array.from({ length: 100 }, (_, i) => mk(`s${i}`, 70));
    expect(evaluateAchievements(s100, 1).find((a) => a.id === 'sessions_100')?.unlocked).toBe(true);
    expect(evaluateAchievements(s100.slice(0, 99), 1).find((a) => a.id === 'sessions_100')?.unlocked).toBe(false);
  });

  // 连击
  it('连击解锁 streak_3 / streak_7', () => {
    const list3 = evaluateAchievements([mk('s1', 70)], 3);
    expect(list3.find((a) => a.id === 'streak_3')?.unlocked).toBe(true);
    expect(list3.find((a) => a.id === 'streak_7')?.unlocked).toBe(false);
    const list7 = evaluateAchievements([mk('s1', 70)], 7);
    expect(list7.find((a) => a.id === 'streak_7')?.unlocked).toBe(true);
  });

  it('连击 14 解锁 streak_14', () => {
    expect(evaluateAchievements([mk('s1', 70)], 14).find((a) => a.id === 'streak_14')?.unlocked).toBe(true);
    expect(evaluateAchievements([mk('s1', 70)], 7).find((a) => a.id === 'streak_14')?.unlocked).toBe(false);
  });

  it('连击 30 解锁 streak_30', () => {
    expect(evaluateAchievements([mk('s1', 70)], 30).find((a) => a.id === 'streak_30')?.unlocked).toBe(true);
    expect(evaluateAchievements([mk('s1', 70)], 29).find((a) => a.id === 'streak_30')?.unlocked).toBe(false);
  });

  // 时段
  it('早晨练习解锁 early_bird', () => {
    const morning = new Date(); morning.setHours(7, 0, 0, 0);
    expect(evaluateAchievements([mk('s1', 70, 'interview', morning.getTime())], 1).find((a) => a.id === 'early_bird')?.unlocked).toBe(true);
    const noon = new Date(); noon.setHours(12, 0, 0, 0);
    expect(evaluateAchievements([mk('s1', 70, 'interview', noon.getTime())], 1).find((a) => a.id === 'early_bird')?.unlocked).toBe(false);
  });

  it('夜间练习解锁 night_owl', () => {
    const nightTs = new Date(); nightTs.setHours(23, 0, 0, 0);
    expect(evaluateAchievements([mk('s1', 70, 'interview', nightTs.getTime())], 1).find((a) => a.id === 'night_owl')?.unlocked).toBe(true);
    const dayTs = new Date(); dayTs.setHours(10, 0, 0, 0);
    expect(evaluateAchievements([mk('s1', 70, 'interview', dayTs.getTime())], 1).find((a) => a.id === 'night_owl')?.unlocked).toBe(false);
  });

  // 单日爆发
  it('同天 3 次解锁 speed_run', () => {
    const today = new Date(); today.setHours(10, 0, 0, 0);
    const ts = today.getTime();
    const sessions = [mk('a', 70, 'interview', ts), mk('b', 70, 'restaurant', ts + 1000), mk('c', 70, 'meeting', ts + 2000)];
    expect(evaluateAchievements(sessions, 1).find((a) => a.id === 'speed_run')?.unlocked).toBe(true);
    expect(evaluateAchievements([mk('a', 70), mk('b', 70, 'restaurant', Date.now() - DAY)], 1).find((a) => a.id === 'speed_run')?.unlocked).toBe(false);
  });

  // 分数
  it('高分解锁 high_scorer', () => {
    expect(evaluateAchievements([mk('s1', 95)], 1).find((a) => a.id === 'high_scorer')?.unlocked).toBe(true);
    expect(evaluateAchievements([mk('s1', 80)], 1).find((a) => a.id === 'high_scorer')?.unlocked).toBe(false);
  });

  it('5 维全 80+ 解锁 perfect_five', () => {
    expect(evaluateAchievements([mk('s1', 85)], 1).find((a) => a.id === 'perfect_five')?.unlocked).toBe(true);
    expect(evaluateAchievements([mk('s1', 79)], 1).find((a) => a.id === 'perfect_five')?.unlocked).toBe(false);
  });

  it('发音 ≥ 90 解锁 pronunciation_ace', () => {
    const high = mk('s1', 70, 'interview', Date.now(), {
      radar: { pronunciation: 92, fluency: 70, grammar: 70, vocabulary: 70, taskCompletion: 70 },
    });
    expect(evaluateAchievements([high], 1).find((a) => a.id === 'pronunciation_ace')?.unlocked).toBe(true);
    const low = mk('s2', 70);
    expect(evaluateAchievements([low], 1).find((a) => a.id === 'pronunciation_ace')?.unlocked).toBe(false);
  });

  it('流利度 ≥ 90 解锁 fluency_ace', () => {
    const high = mk('s1', 70, 'interview', Date.now(), {
      radar: { pronunciation: 70, fluency: 91, grammar: 70, vocabulary: 70, taskCompletion: 70 },
    });
    expect(evaluateAchievements([high], 1).find((a) => a.id === 'fluency_ace')?.unlocked).toBe(true);
    const low = mk('s2', 70);
    expect(evaluateAchievements([low], 1).find((a) => a.id === 'fluency_ace')?.unlocked).toBe(false);
  });

  // 进步
  it('最近 5 次均分 > 前 5 次解锁 comeback', () => {
    // sessions 传入顺序不影响结果（evaluateAchievements 内部按时间倒序排）
    const now = Date.now();
    const recent = Array.from({ length: 5 }, (_, i) => mk(`r${i}`, 85, 'interview', now - i * DAY));
    const old = Array.from({ length: 5 }, (_, i) => mk(`o${i}`, 60, 'interview', now - (i + 5) * DAY));
    expect(evaluateAchievements([...recent, ...old], 5).find((a) => a.id === 'comeback')?.unlocked).toBe(true);

    // 进步方向相反，不解锁
    const recentLow = Array.from({ length: 5 }, (_, i) => mk(`rl${i}`, 60, 'interview', now - i * DAY));
    const oldHigh = Array.from({ length: 5 }, (_, i) => mk(`oh${i}`, 85, 'interview', now - (i + 5) * DAY));
    expect(evaluateAchievements([...recentLow, ...oldHigh], 5).find((a) => a.id === 'comeback')?.unlocked).toBe(false);

    // 不足 10 次不解锁
    expect(evaluateAchievements(recent, 3).find((a) => a.id === 'comeback')?.unlocked).toBe(false);
  });

  // 场景探索
  it('多场景解锁 all_rounder', () => {
    const sessions = [mk('a', 70, 'interview'), mk('b', 70, 'restaurant'), mk('c', 70, 'meeting')];
    expect(evaluateAchievements(sessions, 1).find((a) => a.id === 'all_rounder')?.unlocked).toBe(true);
  });

  it('体验全部 9 种场景解锁 all_scenes', () => {
    const allScenes = ['interview', 'meeting', 'presentation', 'restaurant', 'doctor', 'shopping', 'hotel', 'smalltalk', 'ielts'];
    const sessions = allScenes.map((sc, i) => mk(`s${i}`, 70, sc));
    expect(evaluateAchievements(sessions, 1).find((a) => a.id === 'all_scenes')?.unlocked).toBe(true);
    // 缺一个场景不解锁
    expect(evaluateAchievements(sessions.slice(0, 8), 1).find((a) => a.id === 'all_scenes')?.unlocked).toBe(false);
  });

  it('同一场景 10 次解锁 scenario_master', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => mk(`s${i}`, 70, 'interview'));
    expect(evaluateAchievements(sessions, 1).find((a) => a.id === 'scenario_master')?.unlocked).toBe(true);
    expect(evaluateAchievements(sessions.slice(0, 9), 1).find((a) => a.id === 'scenario_master')?.unlocked).toBe(false);
  });

  // 挑战
  it('高级模式 5 次解锁 challenger', () => {
    const hard = Array.from({ length: 5 }, (_, i) => mk(`h${i}`, 70, 'interview', Date.now(), { difficulty: 'advanced' }));
    expect(evaluateAchievements(hard, 1).find((a) => a.id === 'challenger')?.unlocked).toBe(true);
    expect(evaluateAchievements(hard.slice(0, 4), 1).find((a) => a.id === 'challenger')?.unlocked).toBe(false);
  });
});

// ── todayDone ──────────────────────────────────────────────────────────────
describe('todayDone', () => {
  it('今天有练习返回 true', () => {
    expect(todayDone([mk('s1', 70, 'interview', Date.now())])).toBe(true);
  });
  it('只有昨天练习返回 false', () => {
    expect(todayDone([mk('s1', 70, 'interview', Date.now() - DAY)])).toBe(false);
  });
  it('空集返回 false', () => {
    expect(todayDone([])).toBe(false);
  });
});
