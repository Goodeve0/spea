import OpenAI from 'openai';

/** LLM 客户端接口 —— 业务模块只依赖此接口，便于 mock 测试 */
export interface ILlmClient {
  /** 非流式调用，返回完整文本 */
  complete(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string>;

  /** 流式调用，onToken 逐 token 回调，返回拼接的完整文本 */
  stream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void,
  ): Promise<string>;
}

/** 基于 OpenAI SDK 的真实实现（延迟初始化，无 API key 时也能启动） */
export class OpenAILlmClient implements ILlmClient {
  private client: OpenAI | null = null;
  private model: string;

  constructor() {
    this.model = process.env.LLM_MODEL ?? 'gpt-4o';
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set. Please add it to your .env file.');
      }
      const baseURL = process.env.OPENAI_BASE_URL;
      this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    }
    return this.client;
  }

  async complete(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
    const response = await this.getClient().chat.completions.create({
      model: this.model,
      messages,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  async stream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void,
  ): Promise<string> {
    const stream = await this.getClient().chat.completions.create({
      model: this.model,
      messages,
      stream: true,
    });

    let fullText = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) {
        fullText += token;
        onToken(token);
      }
    }
    return fullText;
  }
}
