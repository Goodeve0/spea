/** TTS 服务接口 */
export interface ITtsService {
  /** 流式合成语音，onChunk 回调音频分片 */
  synthesize(text: string, onChunk: (chunk: ArrayBuffer) => void): Promise<void>;
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
