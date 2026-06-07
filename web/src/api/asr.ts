/**
 * 语音转写 API（前端）：把录音 WAV 发给后端 SenseVoice 转写。
 * 失败一律返回空串（静默降级，调用方回退浏览器识别结果）。
 */
const BASE = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3002';

/** 转写超时（毫秒）：超时则放弃，避免拖慢对话 */
const ASR_TIMEOUT_MS = 8000;

export async function transcribeAudio(wav: Blob): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASR_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/asr`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wav,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn('[asr] 转写失败:', res.status);
      return '';
    }
    const data = (await res.json()) as { text?: string };
    return (data.text ?? '').trim();
  } catch (err) {
    console.warn('[asr] 转写异常:', err);
    return '';
  } finally {
    clearTimeout(timer);
  }
}
