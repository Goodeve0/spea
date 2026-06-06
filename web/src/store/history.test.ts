import { describe, it, expect, beforeEach } from 'vitest';
import type { StoredSession } from '@speak-coach/shared';

import {
  loadLocalSessions,
  saveLocalSession,
  replaceLocalSessions,
  clearLocalSessions,
  getGuestSessions,
  clearGuest,
  computeStreak,
  computeTotalXp,
} from './history';

const DAY = 86400000;

function mk(id: string, ts: number, overall: number): StoredSession {
  return {
    id,
    timestamp: ts,
    scenarioId: 'interview',
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

describe('history 本地命名空间', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('按 userId 隔离，互不污染（含游客）', () => {
    saveLocalSession(mk('a1', 1000, 60), 'userA');
    saveLocalSession(mk('b1', 2000, 70), 'userB');
    saveLocalSession(mk('g1', 3000, 80)); // 游客
    expect(loadLocalSessions('userA').map((s) => s.id)).toEqual(['a1']);
    expect(loadLocalSessions('userB').map((s) => s.id)).toEqual(['b1']);
    expect(getGuestSessions().map((s) => s.id)).toEqual(['g1']);
  });

  it('同 id 覆盖（幂等）', () => {
    saveLocalSession(mk('a1', 1000, 60), 'u');
    saveLocalSession(mk('a1', 1000, 90), 'u');
    const list = loadLocalSessions('u');
    expect(list).toHaveLength(1);
    expect(list[0].overallScore).toBe(90);
  });

  it('倒序返回', () => {
    saveLocalSession(mk('x', 1000, 60), 'u');
    saveLocalSession(mk('y', 3000, 60), 'u');
    saveLocalSession(mk('z', 2000, 60), 'u');
    expect(loadLocalSessions('u').map((s) => s.id)).toEqual(['y', 'z', 'x']);
  });

  it('clear 与 replace', () => {
    saveLocalSession(mk('a1', 1000, 60), 'u');
    clearLocalSessions('u');
    expect(loadLocalSessions('u')).toEqual([]);
    replaceLocalSessions([mk('n1', 1000, 60), mk('n2', 2000, 70)], 'u');
    expect(loadLocalSessions('u')).toHaveLength(2);
  });

  it('clearGuest 只清游客', () => {
    saveLocalSession(mk('g', 1000, 60));
    saveLocalSession(mk('u1', 1000, 60), 'u');
    clearGuest();
    expect(getGuestSessions()).toEqual([]);
    expect(loadLocalSessions('u')).toHaveLength(1);
  });
});

describe('computeStreak / computeTotalXp', () => {
  it('XP 累加', () => {
    expect(computeTotalXp([mk('a', 1, 60), mk('b', 2, 80)])).toBe(140);
  });

  it('空集为 0', () => {
    expect(computeStreak([])).toBe(0);
    expect(computeTotalXp([])).toBe(0);
  });

  it('连续多天 streak', () => {
    const t = Date.now();
    expect(computeStreak([mk('a', t, 60), mk('b', t - DAY, 60), mk('c', t - 2 * DAY, 60)])).toBe(3);
  });

  it('断档处停止', () => {
    const t = Date.now();
    expect(computeStreak([mk('a', t, 60), mk('b', t - 2 * DAY, 60)])).toBe(1);
  });

  it('同日多次只算一天', () => {
    const t = Date.now();
    expect(computeStreak([mk('a', t, 60), mk('b', t - 1000, 60)])).toBe(1);
  });
});
