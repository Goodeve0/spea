/**
 * useTypewriter
 *
 * 把"按块跳变"的流式文本平滑成"逐字递增"的打字机效果。
 *
 * 背景：LLM 流式 delta 往往是多词块（如 " am very"、" happy today"），
 * 直接渲染会让用户看到一块一块跳出来，而非句子平滑变长。本 hook 在渲染层
 * 维护一个"已显示长度"，用定时器逐步逼近目标文本，呈现平滑打字机效果。
 *
 * 行为：
 *  - target 增长且以已显示内容为前缀 → 逐步揭示更多字符（速度随积压量自适应，避免落后于快流）。
 *  - target 被清空或不以已显示内容为前缀（如换轮重置）→ 立即同步，避免残留上一句。
 */
import { useEffect, useRef, useState } from 'react';

const TICK_MS = 16; // ~60fps
const MIN_STEP = 2; // 每帧至少揭示字符数

export function useTypewriter(target: string): string {
  const [shown, setShown] = useState('');
  const targetRef = useRef(target);
  targetRef.current = target;

  // 重置/不连续：立即同步，避免显示上一轮残留
  useEffect(() => {
    if (target === '' || !target.startsWith(shown)) {
      setShown(target);
    }
    // 仅在 target 变化时检查；shown 故意不入依赖，避免每帧重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useEffect(() => {
    const id = setInterval(() => {
      setShown((cur) => {
        const t = targetRef.current;
        if (cur.length >= t.length) return cur;
        if (!t.startsWith(cur)) return t; // 不连续直接同步
        // 自适应步长：积压越多揭示越快，保证不落后于快流
        const remaining = t.length - cur.length;
        const step = Math.max(MIN_STEP, Math.floor(remaining / 8));
        return t.slice(0, cur.length + step);
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return shown;
}
