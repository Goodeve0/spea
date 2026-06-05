import type { PronunciationResult, WordScore } from '@speak-coach/shared';

/** 发音评测服务接口 */
export interface IPronunciationService {
  assess(audio: ArrayBuffer, referenceText: string): Promise<PronunciationResult>;
}

export function stripWavHeader(audio: ArrayBuffer): Buffer {
  const buf = Buffer.from(audio);
  if (
    buf.length > 44 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return buf.subarray(44);
  }
  return buf;
}

export function estimateResult(referenceText: string): PronunciationResult {
  const words = referenceText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const baseAccuracy = 70 + Math.min(wordCount, 10);
  const fluency = Math.max(50, 85 - wordCount);

  const wordScores: WordScore[] = words.map((word) => ({
    word,
    score: 70 + Math.floor(Math.random() * 20),
  }));

  return {
    turnId: '',
    accuracy: Math.min(baseAccuracy, 100),
    fluency,
    completeness: 80,
    prosody: 70,
    wordScores,
  };
}

export function emptyResult(): PronunciationResult {
  return {
    turnId: '',
    accuracy: 0,
    fluency: 0,
    completeness: 0,
    prosody: 0,
    wordScores: [],
  };
}
