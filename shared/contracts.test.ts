import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  PRESET_SCENARIOS,
  SCENARIO_CATEGORIES,
  buildFreeTopicScenario,
} from './contracts';

describe('shared/contracts smoke test', () => {
  it('ErrorCode enum has expected values', () => {
    expect(ErrorCode.ASR_FAILED).toBe('ASR_FAILED');
    expect(ErrorCode.LLM_FAILED).toBe('LLM_FAILED');
    expect(ErrorCode.TTS_FAILED).toBe('TTS_FAILED');
  });

  it('PRESET_SCENARIOS has at least 9 scenarios across categories', () => {
    expect(PRESET_SCENARIOS.length).toBeGreaterThanOrEqual(9);
    const cats = new Set(PRESET_SCENARIOS.map((s) => s.category));
    expect(cats.size).toBeGreaterThanOrEqual(3);
  });

  it('every scenario category is a known category', () => {
    const known = new Set(SCENARIO_CATEGORIES.map((c) => c.id));
    for (const s of PRESET_SCENARIOS) {
      expect(known.has(s.category as string)).toBe(true);
    }
  });

  it('buildFreeTopicScenario builds a usable custom scenario', () => {
    const s = buildFreeTopicScenario('我的周末计划', 'beginner');
    expect(s.id).toBe('custom');
    expect(s.difficulty).toBe('beginner');
    expect(s.rolePrompt).toContain('我的周末计划');
    expect(s.goal).toBeTruthy();
  });

  it('buildFreeTopicScenario falls back when topic is empty', () => {
    const s = buildFreeTopicScenario('   ', 'intermediate');
    expect(s.id).toBe('custom');
    expect(s.title).toBeTruthy();
    expect(s.rolePrompt).toBeTruthy();
  });

  it('each preset scenario has required fields', () => {
    for (const s of PRESET_SCENARIOS) {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.rolePrompt).toBeTruthy();
      expect(s.goal).toBeTruthy();
      expect(['beginner', 'intermediate', 'advanced']).toContain(s.difficulty);
    }
  });
});
