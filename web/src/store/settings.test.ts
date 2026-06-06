import { describe, expect, it } from 'vitest';

import { normalizePlaybackSpeed, PLAYBACK_SPEED_OPTIONS } from './settings';

describe('normalizePlaybackSpeed', () => {
  it('接受合法档位', () => {
    for (const speed of PLAYBACK_SPEED_OPTIONS) {
      expect(normalizePlaybackSpeed(speed)).toBe(speed);
    }
  });

  it('非法值回退到 1', () => {
    expect(normalizePlaybackSpeed(2)).toBe(1);
    expect(normalizePlaybackSpeed('1')).toBe(1);
    expect(normalizePlaybackSpeed(undefined)).toBe(1);
  });
});
