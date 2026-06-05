import WebSocket from 'ws';

import { buildXfyunTtsAuthUrl } from '../lib/xfyun-auth';

/** TTS 服务接口 */
export interface ITtsService {
  /** 流式合成语音，onChunk 回调音频分片 */
  synthesize(text: string, onChunk: (chunk: ArrayBuffer) => void, voice?: string): Promise<void>;
}

/** 基于 OpenAI TTS API 的实现 */
export class OpenAITtsService implements ITtsService {
  async synthesize(text: string, onChunk: (chunk: ArrayBuffer) => void): Promise<void> {
    if (!text.trim()) return;

    try {
      if (!process.env.OPENAI_API_KEY) {
        // 无 API key 时返回静音 mock
        onChunk(new ArrayBuffer(8));
        return;
      }

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: 'alloy',
          response_format: 'mp3',
        }),
      });

      if (!response.body) {
        // 不支持流式读取，直接读完整响应
        const buffer = await response.arrayBuffer();
        onChunk(buffer);
        return;
      }

      // 流式读取
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(value.buffer as ArrayBuffer);
      }
    } catch {
      // TTS 失败不抛断对话，降级为纯文字模式
      // 通知调用方无音频可用
    }
  }
}

const IFLYTEK_TTS_TIMEOUT_MS = 30_000;
const DEFAULT_IFLYTEK_VOICE = 'x4_EnUs_Catherine';

/**
 * 科大讯飞在线流式 TTS 实现（v2/tts）
 * 文档：https://www.xfyun.cn/doc/tts/online_tts/API.html
 * - 输出 PCM 16kHz / 16bit / mono / RAW
 * - 通过 onChunk 按帧（base64 解码后的 Buffer）回调，前端用 Web Audio API 拼装播放
 */
export class IflytekTtsService implements ITtsService {
  private readonly appId: string | undefined;

  constructor() {
    this.appId = process.env.XFYUN_APP_ID;
  }

  async synthesize(
    text: string,
    onChunk: (chunk: ArrayBuffer) => void,
    voice: string = DEFAULT_IFLYTEK_VOICE,
  ): Promise<void> {
    if (!text.trim()) return;

    if (!this.appId) {
      throw new Error('XFYUN_APP_ID is not set');
    }

    // 鉴权 URL（缺 key/secret 时函数自身会抛错）
    const authUrl = buildXfyunTtsAuthUrl();

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(authUrl);
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
        fn();
      };

      const timer = setTimeout(() => {
        finish(() => reject(new Error('Iflytek TTS timeout')));
      }, IFLYTEK_TTS_TIMEOUT_MS);

      ws.on('error', (err) => {
        finish(() => reject(err));
      });

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            common: { app_id: this.appId },
            business: {
              aue: 'raw',
              sfl: 0,
              auf: 'audio/L16;rate=16000',
              vcn: voice,
              tte: 'UTF8',
              speed: 50,
              volume: 50,
              pitch: 50,
            },
            data: {
              status: 2,
              text: Buffer.from(text, 'utf-8').toString('base64'),
            },
          }),
        );
      });

      ws.on('message', (raw) => {
        try {
          const payload = JSON.parse(raw.toString()) as {
            code?: number;
            message?: string;
            data?: { audio?: string; status?: number };
          };

          if (payload.code !== 0) {
            finish(() =>
              reject(new Error(`Iflytek TTS error: ${payload.code} ${payload.message ?? ''}`.trim())),
            );
            return;
          }

          if (payload.data?.audio) {
            const buf = Buffer.from(payload.data.audio, 'base64');
            // 转成独立 ArrayBuffer，避免共享底层 buffer 引发的越界
            const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
            onChunk(ab);
          }

          if (payload.data?.status === 2) {
            finish(() => resolve());
          }
        } catch (err) {
          finish(() => reject(err instanceof Error ? err : new Error('Invalid Iflytek response')));
        }
      });
    });
  }
}

/** Mock TTS 服务，用于测试 */
export class MockTtsService implements ITtsService {
  private shouldFail = false;

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  async synthesize(text: string, onChunk: (chunk: ArrayBuffer) => void): Promise<void> {
    if (!text.trim()) return;

    if (this.shouldFail) {
      // 模拟失败但不抛出（降级策略）
      return;
    }

    // 返回一段 mock 音频
    const mockAudio = new ArrayBuffer(64);
    onChunk(mockAudio);
  }
}
