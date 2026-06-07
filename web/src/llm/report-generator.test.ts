import { describe, it, expect } from 'vitest';
import { mergeAcousticScores, type GeneratedReport, type AcousticScore } from './report-generator';

function baseReport(): GeneratedReport {
  return {
    sessionId: 's1',
    radar: {
      pronunciation: 70, // LLM 估算（应被覆盖）
      fluency: 80,
      grammar: 75,
      vocabulary: 65,
      taskCompletion: 90,
    },
    topErrors: [],
    expressionUpgrades: [],
    recasts: [],
    summaryText: 'ok',
    annotatedTurns: [],
    hasUserSpeech: true,
  };
}

describe('mergeAcousticScores', () => {
  it('无声学分时标记 none，不改 radar', () => {
    const r = mergeAcousticScores(baseReport(), []);
    expect(r.pronunciationSource).toBe('none');
    expect(r.radar.pronunciation).toBe(70); // 保持原值
    expect(r.radar.fluency).toBe(80);
  });

  it('有声学分时用 accuracy 平均覆盖发音分，标记 acoustic', () => {
    const scores: AcousticScore[] = [
      { accuracy: 90, fluency: 88, wordScores: [] },
      { accuracy: 80, fluency: 82, wordScores: [] },
    ];
    const r = mergeAcousticScores(baseReport(), scores);
    expect(r.pronunciationSource).toBe('acoustic');
    expect(r.radar.pronunciation).toBe(85); // (90+80)/2
  });

  it('流利度按声学与 LLM 各半融合', () => {
    const scores: AcousticScore[] = [{ accuracy: 90, fluency: 90, wordScores: [] }];
    const r = mergeAcousticScores(baseReport(), scores);
    // 声学 fluency 90，LLM fluency 80 → (90+80)/2 = 85
    expect(r.radar.fluency).toBe(85);
  });

  it('汇总逐词最差分（升序，最多 8 个）', () => {
    const scores: AcousticScore[] = [
      {
        accuracy: 80,
        fluency: 80,
        wordScores: [
          { word: 'good', score: 95 },
          { word: 'bad', score: 40 },
          { word: 'mid', score: 70 },
        ],
      },
    ];
    const r = mergeAcousticScores(baseReport(), scores);
    expect(r.pronunciationWordScores?.[0]).toEqual({ word: 'bad', score: 40 });
    expect(r.pronunciationWordScores?.[2]).toEqual({ word: 'good', score: 95 });
  });

  it('不修改入参（纯函数）', () => {
    const original = baseReport();
    mergeAcousticScores(original, [{ accuracy: 50, fluency: 50, wordScores: [] }]);
    expect(original.radar.pronunciation).toBe(70);
    expect(original.pronunciationSource).toBeUndefined();
  });

  it('过滤非法逐词分（NaN / 空词）', () => {
    const scores: AcousticScore[] = [
      {
        accuracy: 80,
        fluency: 80,
        wordScores: [
          { word: '', score: 30 },
          { word: 'ok', score: NaN },
          { word: 'fine', score: 60 },
        ],
      },
    ];
    const r = mergeAcousticScores(baseReport(), scores);
    expect(r.pronunciationWordScores).toEqual([{ word: 'fine', score: 60 }]);
  });
});
