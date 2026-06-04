import { describe, it, expect } from 'vitest';
import { ErrorCode, PRESET_SCENARIOS } from './contracts';

describe('shared/contracts smoke test', () => {
  it('ErrorCode enum has expected values', () => {
    expect(ErrorCode.ASR_FAILED).toBe('ASR_FAILED');
    expect(ErrorCode.LLM_FAILED).toBe('LLM_FAILED');
    expect(ErrorCode.TTS_FAILED).toBe('TTS_FAILED');
  });

  it('PRESET_SCENARIOS has at least 3 scenarios', () => {
    expect(PRESET_SCENARIOS.length).toBeGreaterThanOrEqual(3);
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
