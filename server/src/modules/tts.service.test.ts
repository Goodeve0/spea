import { describe, it, expect } from 'vitest';
import { MockTtsService } from './tts.service';

describe('TtsService (Mock)', () => {
  it('synthesize 正常路径触发 onChunk 回调', async () => {
    const svc = new MockTtsService();
    const chunks: ArrayBuffer[] = [];
    await svc.synthesize('Hello', (chunk) => chunks.push(chunk));
    expect(chunks.length).toBe(1);
    expect(chunks[0].byteLength).toBeGreaterThan(0);
  });

  it('空文本不触发 onChunk', async () => {
    const svc = new MockTtsService();
    const chunks: ArrayBuffer[] = [];
    await svc.synthesize('', (chunk) => chunks.push(chunk));
    expect(chunks).toEqual([]);
  });

  it('失败时不抛出，静默降级', async () => {
    const svc = new MockTtsService();
    svc.setShouldFail(true);
    const chunks: ArrayBuffer[] = [];
    // 不应抛出
    await svc.synthesize('Hello', (chunk) => chunks.push(chunk));
    expect(chunks).toEqual([]);
  });
});
