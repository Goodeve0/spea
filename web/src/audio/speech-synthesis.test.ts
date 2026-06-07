import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserSpeechSynthesisEngine } from './speech-synthesis';

vi.mock('../store/settings', () => ({
  useSettingsStore: {
    getState: () => ({ playbackSpeed: 1 }),
  },
}));

class MockUtterance {
  text = '';
  lang = '';
  rate = 1;
  pitch = 1;
  voice: SpeechSynthesisVoice | undefined;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
}

describe('BrowserSpeechSynthesisEngine', () => {
  const utterances: MockUtterance[] = [];
  let cancelFn: ReturnType<typeof vi.fn>;
  let resumeFn: ReturnType<typeof vi.fn>;
  let speakFn: ReturnType<typeof vi.fn>;

  const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    utterances.length = 0;
    cancelFn = vi.fn();
    resumeFn = vi.fn();

    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text = '';
        lang = '';
        rate = 1;
        pitch = 1;
        voice: SpeechSynthesisVoice | undefined;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

        constructor(text: string) {
          this.text = text;
          utterances.push(this as unknown as MockUtterance);
        }
      },
    );

    speakFn = vi.fn();
    speakFn.mockImplementation(() => {
      (globalThis as { speechSynthesis: { speaking: boolean } }).speechSynthesis.speaking = true;
    });
    vi.stubGlobal('speechSynthesis', {
      speaking: false,
      cancel: cancelFn,
      resume: resumeFn,
      getVoices: vi.fn().mockReturnValue([]),
      speak: speakFn,
      addEventListener: vi.fn(),
    });

    vi.stubGlobal('window', { speechSynthesis: (globalThis as { speechSynthesis: unknown }).speechSynthesis });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stop 后 stale onend 不调用 opts.onEnd', async () => {
    const onEnd = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('Hello', { onEnd });
    await vi.advanceTimersByTimeAsync(0);
    expect(utterances).toHaveLength(1);
    const stale = utterances[0];

    engine.stop();
    stale.onend?.();

    expect(onEnd).not.toHaveBeenCalled();
    expect(cancelFn).toHaveBeenCalled();
  });

  it('连续 speak 仅最后一次 onEnd 触发', async () => {
    const onEndFirst = vi.fn();
    const onEndSecond = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('First', { onEnd: onEndFirst });
    engine.speak('Second', { onEnd: onEndSecond });
    await vi.advanceTimersByTimeAsync(0);

    expect(utterances.length).toBeGreaterThanOrEqual(1);
    const last = utterances[utterances.length - 1];
    last.onend?.();

    expect(onEndFirst).not.toHaveBeenCalled();
    expect(onEndSecond).toHaveBeenCalledTimes(1);
  });

  it('interrupted 且代际匹配时调用 onEnd 以释放状态', async () => {
    const onEnd = vi.fn();
    const onError = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('Hello', { onEnd, onError });
    await vi.advanceTimersByTimeAsync(0);
    utterances[0].onerror?.({ error: 'interrupted' } as SpeechSynthesisErrorEvent);

    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('stop 后 stale interrupted 不调用 onEnd', async () => {
    const onEnd = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('Hello', { onEnd });
    await vi.advanceTimersByTimeAsync(0);
    const stale = utterances[0];
    engine.stop();
    stale.onerror?.({ error: 'interrupted' } as SpeechSynthesisErrorEvent);

    expect(onEnd).not.toHaveBeenCalled();
  });

  it('正常发声时 onStart 在 onEnd 之前被调用一次', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('Hello', { onStart, onEnd });
    await vi.advanceTimersByTimeAsync(0);
    expect(utterances).toHaveLength(1);

    utterances[0].onstart?.();
    utterances[0].onend?.();

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onStart.mock.invocationCallOrder[0]).toBeLessThan(onEnd.mock.invocationCallOrder[0]);
  });

  it('第一次未触发 onstart 时自动重试，第二次成功不报错', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('Hello', { onStart, onEnd, onError });
    // 跑掉首次 setTimeout(0) → tryStart(0) 入队 utterance #1
    await vi.advanceTimersByTimeAsync(1);
    expect(utterances).toHaveLength(1);

    // 启动超时（1500ms）+ 重试入队 setTimeout(0) → utterance #2
    await vi.advanceTimersByTimeAsync(1500);
    await vi.advanceTimersByTimeAsync(1);
    expect(utterances).toHaveLength(2);
    expect(resumeFn).toHaveBeenCalled();
    expect(cancelFn).toHaveBeenCalled();

    // 第二次正常发声
    utterances[1].onstart?.();
    utterances[1].onend?.();

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('全部重试失败时触发 onError + onEnd', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('Hello', { onStart, onEnd, onError });
    await vi.advanceTimersByTimeAsync(1);

    // 三次启动超时（首次 + 2 次重试）
    for (let i = 0; i < 3; i += 1) {
      await vi.advanceTimersByTimeAsync(1500);
      await vi.advanceTimersByTimeAsync(1);
    }

    expect(utterances.length).toBe(3);
    expect(onStart).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe('SpeechSynthesis start timeout');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('重试等待中调用 stop 不触发任何回调', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('Hello', { onStart, onEnd, onError });
    await vi.advanceTimersByTimeAsync(1);
    // 触发第一次启动超时进入重试链
    await vi.advanceTimersByTimeAsync(1500);

    engine.stop();

    // 跑光所有挂起 timer
    await vi.advanceTimersByTimeAsync(10000);

    expect(onStart).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });
});
