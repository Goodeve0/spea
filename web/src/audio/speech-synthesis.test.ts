import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserSpeechSynthesisEngine } from './speech-synthesis';

vi.mock('../store/settings', () => ({
  useSettingsStore: {
    getState: () => ({ playbackSpeed: 1 }),
  },
}));

class MockUtterance {
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

  beforeEach(() => {
    utterances.length = 0;
    cancelFn = vi.fn();

    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        lang = '';
        rate = 1;
        pitch = 1;
        voice: SpeechSynthesisVoice | undefined;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

        constructor(_text: string) {
          utterances.push(this);
        }
      },
    );

    vi.stubGlobal('speechSynthesis', {
      speaking: false,
      cancel: cancelFn,
      getVoices: vi.fn().mockReturnValue([]),
      speak: vi.fn(() => {
        (globalThis as { speechSynthesis: { speaking: boolean } }).speechSynthesis.speaking = true;
      }),
      addEventListener: vi.fn(),
    });

    vi.stubGlobal('window', { speechSynthesis: (globalThis as { speechSynthesis: unknown }).speechSynthesis });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stop 后 stale onend 不调用 opts.onEnd', () => {
    const onEnd = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('Hello', { onEnd });
    expect(utterances).toHaveLength(1);
    const stale = utterances[0];

    engine.stop();
    stale.onend?.();

    expect(onEnd).not.toHaveBeenCalled();
    expect(cancelFn).toHaveBeenCalled();
  });

  it('连续 speak 仅最后一次 onEnd 触发', () => {
    const onEndFirst = vi.fn();
    const onEndSecond = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('First', { onEnd: onEndFirst });
    engine.speak('Second', { onEnd: onEndSecond });

    expect(utterances).toHaveLength(2);
    utterances[0].onend?.();
    utterances[1].onend?.();

    expect(onEndFirst).not.toHaveBeenCalled();
    expect(onEndSecond).toHaveBeenCalledTimes(1);
  });

  it('interrupted 且代际匹配时调用 onEnd 以释放状态', () => {
    const onEnd = vi.fn();
    const onError = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('Hello', { onEnd, onError });
    utterances[0].onerror?.({ error: 'interrupted' } as SpeechSynthesisErrorEvent);

    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('stop 后 stale interrupted 不调用 onEnd', () => {
    const onEnd = vi.fn();
    const engine = new BrowserSpeechSynthesisEngine();

    engine.speak('Hello', { onEnd });
    const stale = utterances[0];
    engine.stop();
    stale.onerror?.({ error: 'interrupted' } as SpeechSynthesisErrorEvent);

    expect(onEnd).not.toHaveBeenCalled();
  });
});
