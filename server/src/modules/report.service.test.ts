import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportService } from './report.service';
import { createMockLlmClient } from '../lib/llm-client.test';
import type { ILlmClient } from '../lib/llm-client';
import type { Turn, Correction, PronunciationResult } from '@speak-coach/shared';

// 测试数据工厂
function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: 't1', sessionId: 's1', role: 'user',
    text: 'I very like this job.', timestamp: Date.now(), ...overrides,
  };
}

function makeCorrection(overrides: Partial<Correction> = {}): Correction {
  return {
    turnId: 't1', original: 'I very like', corrected: 'I really like',
    errorType: 'word_choice', severity: 'minor',
    explanation: 'test', ...overrides,
  };
}

function makePronunciation(overrides: Partial<PronunciationResult> = {}): PronunciationResult {
  return {
    turnId: 't1', accuracy: 80, fluency: 75,
    completeness: 90, prosody: 70, wordScores: [],
    ...overrides,
  };
}

describe('ReportService', () => {
  let llm: ILlmClient;
  let svc: ReportService;

  beforeEach(() => {
    llm = createMockLlmClient();
    svc = new ReportService(llm);
  });

  it('正常路径：给定 turns/corrections/pron，产出完整 Report', async () => {
    (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({ summaryText: '表现不错，继续加油！', vocabularyScore: 70, taskCompletionScore: 80 }),
    );

    const turns = [
      makeTurn({ id: 't1', role: 'user', text: 'I very like this job.' }),
      makeTurn({ id: 't2', role: 'ai', text: 'Great! Tell me more.' }),
    ];
    const corrections = [
      makeCorrection({ turnId: 't1', errorType: 'word_choice', betterExpression: 'I really enjoy this role' }),
    ];
    const pronunciations = [makePronunciation({ turnId: 't1' })];

    const report = await svc.generate('s1', turns, corrections, pronunciations);

    // 雷达图 5 维齐全
    expect(report.radar).toHaveProperty('pronunciation');
    expect(report.radar).toHaveProperty('fluency');
    expect(report.radar).toHaveProperty('grammar');
    expect(report.radar).toHaveProperty('vocabulary');
    expect(report.radar).toHaveProperty('taskCompletion');

    // 每个维度 0-100
    for (const val of Object.values(report.radar)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }

    // annotatedTurns 包含批注
    expect(report.annotatedTurns).toHaveLength(2);
    expect(report.annotatedTurns[0].corrections).toHaveLength(1);
    expect(report.annotatedTurns[1].corrections).toHaveLength(0);

    // 表达升级
    expect(report.expressionUpgrades).toHaveLength(1);
    expect(report.expressionUpgrades[0].to).toBe('I really enjoy this role');

    // 高频错误
    expect(report.topErrors).toHaveLength(1);
    expect(report.topErrors[0].errorType).toBe('word_choice');

    // 文字总结
    expect(report.summaryText).toBeTruthy();
  });

  it('无纠错数据时 topErrors 和 expressionUpgrades 为空', async () => {
    (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({ summaryText: '很好！', vocabularyScore: 80, taskCompletionScore: 90 }),
    );

    const report = await svc.generate('s2', [makeTurn({ id: 't1' })], [], []);
    expect(report.topErrors).toEqual([]);
    expect(report.expressionUpgrades).toEqual([]);
  });

  it('无发音数据时 radar 的 pronunciation 和 fluency 给默认分', async () => {
    (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({ summaryText: 'ok', vocabularyScore: 60, taskCompletionScore: 70 }),
    );

    const report = await svc.generate('s3', [makeTurn({ id: 't1' })], [], []);
    expect(report.radar.pronunciation).toBe(60);
    expect(report.radar.fluency).toBe(60);
  });

  it('LLM 总结失败时降级返回默认文本', async () => {
    (llm.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    const report = await svc.generate('s4', [makeTurn({ id: 't1' })], [], []);
    expect(report.summaryText).toContain('练习完成');
  });

  it('多个纠错按类型聚合 TOP3', async () => {
    (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({ summaryText: 'ok', vocabularyScore: 60, taskCompletionScore: 70 }),
    );

    const corrections = [
      makeCorrection({ turnId: 't1', errorType: 'grammar' }),
      makeCorrection({ turnId: 't2', errorType: 'grammar' }),
      makeCorrection({ turnId: 't3', errorType: 'word_choice' }),
      makeCorrection({ turnId: 't4', errorType: 'grammar' }),
      makeCorrection({ turnId: 't5', errorType: 'expression' }),
    ];
    const report = await svc.generate('s5', [], corrections, []);
    expect(report.topErrors[0].errorType).toBe('grammar');
    expect(report.topErrors[0].count).toBe(3);
    expect(report.topErrors.length).toBeLessThanOrEqual(3);
  });
});
