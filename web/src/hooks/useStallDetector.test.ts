import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useStallDetector } from './useStallDetector';

describe('useStallDetector', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('active 持续到达阈值后触发 onStall', () => {
    const onStall = vi.fn();
    renderHook(() => useStallDetector({ active: true, resetKey: 0, thresholdMs: 6000, onStall }));

    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5999);
    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('active 为 false 时永不触发', () => {
    const onStall = vi.fn();
    renderHook(() => useStallDetector({ active: false, resetKey: 0, thresholdMs: 6000, onStall }));

    vi.advanceTimersByTime(10000);
    expect(onStall).not.toHaveBeenCalled();
  });

  it('resetKey 变化会重新开始计时', () => {
    const onStall = vi.fn();
    const { rerender } = renderHook(
      ({ rk }: { rk: number }) =>
        useStallDetector({ active: true, resetKey: rk, thresholdMs: 6000, onStall }),
      { initialProps: { rk: 0 } },
    );

    vi.advanceTimersByTime(5000);
    rerender({ rk: 1 }); // 进入新一轮，计时重置
    vi.advanceTimersByTime(5000); // 距重置仅 5s
    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); // 距重置满 6s
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('active 变为 false 会取消正在进行的计时', () => {
    const onStall = vi.fn();
    const { rerender } = renderHook(
      ({ a }: { a: boolean }) =>
        useStallDetector({ active: a, resetKey: 0, thresholdMs: 6000, onStall }),
      { initialProps: { a: true } },
    );

    vi.advanceTimersByTime(3000);
    rerender({ a: false }); // 用户开始说话/打字
    vi.advanceTimersByTime(10000);
    expect(onStall).not.toHaveBeenCalled();
  });
});
