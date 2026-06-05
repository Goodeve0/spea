import { describe, it, expect } from 'vitest';
import type { StoredSession } from '@speak-coach/shared';

import { levelInfo, evaluateAchievements, todayDone } from './gamification';

const DAY = 86400000;

function mk(id: string, overall: number, scenarioId = 'interview', ts = Date.now()): StoredSession {
  return {
    id,
    timestamp: ts,
    scenarioId,
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

describe('levelInfo', () => {
  it('0 XP 为 1 级', () => {
    const l = levelInfo(0);
    expect(l.level).toBe(1);
    expect(l.progress).toBe(0);
    expect(l.nextLevelXp).toBe(100);
  });

  it('阈值边界：100 XP 升到 2 级', () => {
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(299).level).toBe(2);
    expect(levelInfo(300).level).toBe(3);
  });

  it('级内进度计算正确', () => {
    const l = levelInfo(200); // 2 级（100~300），级内 100/200
    expect(l.level).toBe(2);
    expect(l.intoLevel).toBe(100);
    expect(l.levelSpan).toBe(200);
    expect(l.progress).toBeCloseTo(0.5, 5);
  });

  it('负数/异常输入归一为 1 级', () => {
    expect(levelInfo(-50).level).toBe(1);
    expect(levelInfo(NaN).level).toBe(1);
  });
});

describe('evaluateAchievements', () => {
  it('无数据时全部未解锁', () => {
    const list = evaluateAchievements([], 0);
    expect(list.every((a) => !a.unlocked)).toBe(true);
  });

  it('首次练习解锁 first_step', () => {
    const list = evaluateAchievements([mk('s1', 70)], 1);
    expect(list.find((a) => a.id === 'first_step')?.unlocked).toBe(true);
  });

  it('连击解锁 streak_3 / streak_7', () => {
    const list3 = evaluateAchievements([mk('s1', 70)], 3);
    expect(list3.find((a) => a.id === 'streak_3')?.unlocked).toBe(true);
    expect(list3.find((a) => a.id === 'streak_7')?.unlocked).toBe(false);
    const list7 = evaluateAchievements([mk('s1', 70)], 7);
    expect(list7.find((a) => a.id === 'streak_7')?.unlocked).toBe(true);
  });

  it('高分解锁 high_scorer', () => {
    expect(evaluateAchievements([mk('s1', 95)], 1).find((a) => a.id === 'high_scorer')?.unlocked).toBe(true);
    expect(evaluateAchievements([mk('s1', 80)], 1).find((a) => a.id === 'high_scorer')?.unlocked).toBe(false);
  });

  it('多场景解锁 all_rounder', () => {
    const sessions = [mk('a', 70, 'interview'), mk('b', 70, 'restaurant'), mk('c', 70, 'meeting')];
    expect(evaluateAchievements(sessions, 1).find((a) => a.id === 'all_rounder')?.unlocked).toBe(true);
  });
});

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
