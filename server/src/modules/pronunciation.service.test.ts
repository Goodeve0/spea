import { describe, it, expect } from 'vitest';
import { MockPronunciationService } from './pronunciation.service';
import type { PronunciationResult } from '@speak-coach/shared';

describe('PronunciationService (Mock)', () => {
  it('assess 返回四维评分', async () => {
    const svc = new MockPronunciationService();
    const result = await svc.assess(new ArrayBuffer(8), 'Hello world');
    expect(result.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.fluency).toBeGreaterThanOrEqual(0);
    expect(result.completeness).toBeGreaterThanOrEqual(0);
    expect(result.prosody).toBeGreaterThanOrEqual(0);
  });

  it('可自定义 mock 结果', async () => {
    const svc = new MockPronunciationService();
    const custom: PronunciationResult = {
      turnId: 't1', accuracy: 95, fluency: 88,
      completeness: 92, prosody: 80, wordScores: [
        { word: 'Hello', score: 95 }, { word: 'world', score: 88 },
      ],
    };
    svc.setMockResult(custom);
    const result = await svc.assess(new ArrayBuffer(8), 'Hello world');
    expect(result.accuracy).toBe(95);
    expect(result.wordScores).toHaveLength(2);
  });

  it('失败时向上抛出错误', async () => {
    const svc = new MockPronunciationService();
    svc.setShouldFail(true);
    await expect(svc.assess(new ArrayBuffer(8), 'test')).rejects.toThrow('failed');
  });
});
