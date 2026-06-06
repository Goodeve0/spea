import { EventEmitter } from 'events';

/** ASR 流式识别会话句柄 */
export interface AsrStream {
  push(chunk: ArrayBuffer): void;
  onPartial(cb: (text: string) => void): void;
  onFinal(cb: (text: string) => void): void;
  close(): Promise<void>;
}

/** ASR 服务接口 */
export interface IAsrService {
  createStream(): AsrStream;
}

/**
 * 基于 OpenAI Whisper API 的 ASR 实现
 * 注：Whisper 不是真正的流式，这里模拟流式行为：
 * - onPartial 在收集音频期间不触发（真实流式需要 Deepgram 等）
 * - onFinal 在 close 时一次性返回识别结果
 * 黑客松期先这样，后续可替换为 Deepgram/讯飞等流式 ASR
 */
export class OpenAIAsrService implements IAsrService {
  createStream(): AsrStream {
    return new OpenAIAsrStream();
  }
}

class OpenAIAsrStream extends EventEmitter implements AsrStream {
  private chunks: ArrayBuffer[] = [];
  private finalized = false;

  push(chunk: ArrayBuffer): void {
    if (this.finalized) return;
    this.chunks.push(chunk);
  }

  onPartial(cb: (text: string) => void): void {
    this.on('partial', cb);
  }

  onFinal(cb: (text: string) => void): void {
    this.on('final', cb);
  }

  async close(): Promise<void> {
    if (this.finalized) return;
    this.finalized = true;

    // 合并所有 chunk
    const totalLength = this.chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    try {
      // 调用 Whisper API（实际实现需要 OpenAI SDK）
      // 黑客松期：如果 API key 不存在，返回 mock 结果
      if (!process.env.OPENAI_API_KEY) {
        this.emit('final', '[Mock ASR result - no API key]');
        return;
      }

      const blob = new Blob([merged], { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: formData,
      });

      const result = await response.json() as { text?: string };
      this.emit('final', result.text ?? '');
    } catch (err) {
      this.emit('final', '');
    }
  }
}

/** Mock ASR 服务，用于测试 */
export class MockAsrService implements IAsrService {
  private mockResults: string[] = [];
  private callIndex = 0;

  setMockResults(results: string[]): void {
    this.mockResults = results;
  }

  createStream(): AsrStream {
    const self = this;
    const stream = new EventEmitter() as unknown as AsrStream;
    const chunks: ArrayBuffer[] = [];

    stream.push = (chunk: ArrayBuffer) => chunks.push(chunk);
    stream.onPartial = (cb: (text: string) => void) => (stream as any).on('partial', cb);
    stream.onFinal = (cb: (text: string) => void) => (stream as any).on('final', cb);
    let closed = false;
    stream.close = async () => {
      if (closed) return;
      closed = true;
      const result = self.mockResults[self.callIndex++] ?? '';
      (stream as any).emit('final', result);
    };

    return stream;
  }
}
