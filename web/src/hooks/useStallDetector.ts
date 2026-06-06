import { useEffect, useRef } from 'react';

interface StallDetectorOptions {
  /** 是否应开始计时（如：等待用户输入、未录音、AI 未说话） */
  active: boolean;
  /** 该值变化时重置计时器（如对话轮数变化 = 进入新一轮等待） */
  resetKey: unknown;
  /** 静默阈值（毫秒），默认 6000 */
  thresholdMs?: number;
  /** 达到阈值时回调 */
  onStall: () => void;
}

/**
 * 卡壳检测：当 `active` 为真且持续 `thresholdMs` 未被打断时，触发 `onStall`。
 *
 * - `active` 变为 false 会立即取消计时（如用户开始说话/打字、AI 开始朗读）。
 * - `resetKey` 变化会重新开始计时（如进入新一轮等待）。
 * - 用 ref 持有最新回调，避免回调身份变化导致计时器频繁重建。
 */
export function useStallDetector({
  active,
  resetKey,
  thresholdMs = 6000,
  onStall,
}: StallDetectorOptions): void {
  const onStallRef = useRef(onStall);
  onStallRef.current = onStall;

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => onStallRef.current(), thresholdMs);
    return () => clearTimeout(id);
  }, [active, resetKey, thresholdMs]);
}
