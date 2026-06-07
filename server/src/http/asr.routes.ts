import { Router, type Request } from 'express';
import express from 'express';

import { normalizeTranscript } from '@speak-coach/shared';

import { asyncHandler, HttpError } from './errors';

/** 录音体积上限（WAV，约 2.5 分钟 16kHz） */
const ASR_BODY_LIMIT = '8mb';

/** 把 WAV 音频转写为文本（可注入，便于测试） */
export type Transcriber = (wav: Buffer) => Promise<string>;

/** 基于 SiliconFlow SenseVoice 的转写实现 */
export function siliconflowTranscriber(): Transcriber {
  return async (wav: Buffer): Promise<string> => {
    const key = process.env.SILICONFLOW_API_KEY;
    const base = process.env.SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1';
    const model = process.env.SILICONFLOW_ASR_MODEL ?? 'FunAudioLLM/SenseVoiceSmall';
    if (!key) {
      throw new HttpError(503, 'ASR_UNCONFIGURED', 'SILICONFLOW_API_KEY 未配置');
    }

    // 复制到独立 ArrayBuffer，避免 Buffer 的 ArrayBufferLike 类型不兼容 BlobPart
    const ab = new ArrayBuffer(wav.length);
    new Uint8Array(ab).set(wav);
    const form = new FormData();
    form.append('model', model);
    form.append('file', new Blob([ab], { type: 'audio/wav' }), 'audio.wav');
    // 显式请求标点（SiliconFlow / SenseVoice 支持时生效；不支持则被忽略，由本地 normalizeTranscript 兜底）
    form.append('enable_punctuation', 'true');
    form.append('inverse_text_normalization', 'true');

    const res = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new HttpError(502, 'ASR_UPSTREAM', `ASR 上游失败 (${res.status}): ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { text?: string };
    return normalizeTranscript(cleanSenseVoiceText(data.text ?? ''));
  };
}

/**
 * 清理 SenseVoice 输出：去掉它附带的情感/事件标记。
 * SenseVoice 可能返回 <|en|><|HAPPY|><|Speech|> 这类控制标记，以及句尾情感 emoji（😊😡 等），
 * 这些不应进入对话文本 / 发音评测参考。
 */
export function cleanSenseVoiceText(raw: string): string {
  return raw
    .replace(/<\|[^|]*\|>/g, '') // <|en|> <|HAPPY|> 等控制标记
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '') // emoji / 符号
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * 语音转写路由工厂。
 * POST /asr  body: WAV 二进制（application/octet-stream 或 audio/wav）→ { text }
 */
export function createAsrRouter(transcribe: Transcriber = siliconflowTranscriber()): Router {
  const router = Router();

  router.post(
    '/asr',
    express.raw({ type: ['application/octet-stream', 'audio/wav'], limit: ASR_BODY_LIMIT }),
    asyncHandler(async (req: Request, res) => {
      const body = req.body as Buffer | undefined;
      if (!body || !Buffer.isBuffer(body) || body.length === 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'audio body is empty');
      }
      const text = await transcribe(body);
      res.json({ text });
    }),
  );

  return router;
}
