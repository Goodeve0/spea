/**
 * 发音评测 API（前端）。
 *
 * 把前端采集的 16kHz Int16 PCM 异步发给后端讯飞 ISE 评测。
 * 失败一律返回 null（静默降级），调用方不应因评测失败而中断对话。
 */
import type { PronunciationResult } from '@speak-coach/shared';

const BASE = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3002';

/**
 * 评测一段语音。
 * @param pcm 16kHz / 16bit / 单声道 Int16 PCM
 * @param referenceText ASR 识别出的文本（作为 ISE 参考文本）
 * @param turnId 关联的用户发言 turn id（便于报告按句关联）
 * @returns 评测结果；任何失败返回 null
 */
export async function assessPronunciation(
  pcm: Int16Array,
  referenceText: string,
  turnId: string,
): Promise<PronunciationResult | null> {
  if (pcm.length === 0 || !referenceText.trim()) return null;

  try {
    const qs = new URLSearchParams({ referenceText, turnId });
    // 复制到独立 ArrayBuffer 作请求体（PCM 始终由普通 ArrayBuffer 承载）
    const buf = new ArrayBuffer(pcm.byteLength);
    new Uint8Array(buf).set(
      new Uint8Array(pcm.buffer as ArrayBuffer, pcm.byteOffset, pcm.byteLength),
    );
    const res = await fetch(`${BASE}/pronunciation/assess?${qs.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buf,
    });
    if (!res.ok) {
      console.warn('[pronunciation] 评测请求失败:', res.status);
      return null;
    }
    return (await res.json()) as PronunciationResult;
  } catch (err) {
    console.warn('[pronunciation] 评测请求异常:', err);
    return null;
  }
}
