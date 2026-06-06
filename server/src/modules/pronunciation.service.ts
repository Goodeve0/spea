import type { PronunciationResult } from '@speak-coach/shared';

import { AzurePronunciationService } from './pronunciation-azure.service';
import { IflytekPronunciationService } from './pronunciation-iflytek.service';
import { emptyResult, estimateResult, type IPronunciationService } from './pronunciation-shared';

/** 支持的发音评测服务商 */
export type PronunciationProvider = 'iflytek' | 'azure' | 'estimate';

export type { IPronunciationService } from './pronunciation-shared';
export { AzurePronunciationService } from './pronunciation-azure.service';
export { IflytekPronunciationService } from './pronunciation-iflytek.service';

/** 本地估算模式，无需第三方 API */
export class EstimatePronunciationService implements IPronunciationService {
  async assess(_audio: ArrayBuffer, referenceText: string): Promise<PronunciationResult> {
    if (!referenceText.trim()) {
      return emptyResult();
    }
    return estimateResult(referenceText);
  }
}

/** 根据环境变量创建发音评测服务 */
export function createPronunciationService(
  provider = process.env.PRONUNCIATION_PROVIDER,
): IPronunciationService {
  const resolved = resolvePronunciationProvider(provider);

  switch (resolved) {
    case 'iflytek':
      return new IflytekPronunciationService();
    case 'azure':
      return new AzurePronunciationService();
    case 'estimate':
      return new EstimatePronunciationService();
    default:
      throw new Error(`Unknown PRONUNCIATION_PROVIDER: ${provider}`);
  }
}

export function resolvePronunciationProvider(provider?: string): PronunciationProvider {
  const normalized = provider?.trim().toLowerCase();
  if (normalized === 'iflytek' || normalized === 'azure' || normalized === 'estimate') {
    return normalized;
  }

  if (process.env.XFYUN_APP_ID && process.env.XFYUN_API_KEY && process.env.XFYUN_API_SECRET) {
    return 'iflytek';
  }
  if (process.env.AZURE_SPEECH_KEY) {
    return 'azure';
  }
  return 'estimate';
}

/** Mock 发音评测服务，用于测试 */
export class MockPronunciationService implements IPronunciationService {
  private mockResult: PronunciationResult | null = null;
  private shouldFail = false;

  setMockResult(result: PronunciationResult): void {
    this.mockResult = result;
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  async assess(_audio: ArrayBuffer, _referenceText: string): Promise<PronunciationResult> {
    if (this.shouldFail) {
      throw new Error('Pronunciation assessment failed');
    }
    return (
      this.mockResult ?? {
        turnId: '',
        accuracy: 85,
        fluency: 80,
        completeness: 90,
        prosody: 75,
        wordScores: [],
      }
    );
  }
}
