import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SilenceDetector } from './silence-detector';

describe('SilenceDetector', () => {
  let energyLevel = 0;
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    energyLevel = 0;
    rafCallback = null;

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    vi.stubGlobal(
      'AudioContext',
      vi.fn().mockImplementation(() => ({
        createMediaStreamSource: vi.fn().mockReturnValue({ connect: vi.fn() }),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 512,
          frequencyBinCount: 4,
          getByteFrequencyData: (arr: Uint8Array) => {
            arr.fill(energyLevel);
          },
        }),
        close: vi.fn().mockResolvedValue(undefined),
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const tickVad = (): void => {
    rafCallback?.(0);
  };

  const stream = { id: 'test' } as MediaStream;

  it('检测到说话后静音达到阈值时触发 onSilence', () => {
    const onSilence = vi.fn();
    const detector = new SilenceDetector({ silenceDurationMs: 2000, energyThreshold: 15 });

    detector.onSilence(onSilence);
    detector.start(stream);

    energyLevel = 20;
    tickVad();

    energyLevel = 0;
    tickVad();

    expect(onSilence).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(onSilence).toHaveBeenCalledTimes(1);

    detector.stop();
  });

  it('resetSilenceTimer 在说话后重置计时，延迟 onSilence', () => {
    const onSilence = vi.fn();
    const detector = new SilenceDetector({ silenceDurationMs: 2000, energyThreshold: 15 });

    detector.onSilence(onSilence);
    detector.start(stream);

    energyLevel = 20;
    tickVad();
    energyLevel = 0;
    tickVad();

    vi.advanceTimersByTime(1500);
    detector.resetSilenceTimer();
    tickVad();

    vi.advanceTimersByTime(1500);
    expect(onSilence).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(onSilence).toHaveBeenCalledTimes(1);

    detector.stop();
  });
});
