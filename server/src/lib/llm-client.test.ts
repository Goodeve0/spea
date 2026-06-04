import { describe, it, expect, vi } from 'vitest';
import type { ILlmClient } from './llm-client';

/** 创建一个 mock LLM 客户端，用于测试 */
export function createMockLlmClient(responses: string[] = []): ILlmClient {
  let callIndex = 0;
  return {
    complete: vi.fn(async () => {
      const resp = responses[callIndex++] ?? '';
      return resp;
    }),
    stream: vi.fn(async (_messages, onToken) => {
      const resp = responses[callIndex++] ?? '';
      for (const char of resp) {
        onToken(char);
      }
      return resp;
    }),
  };
}

describe('ILlmClient 接口契约（通过 mock 验证）', () => {
  it('complete 返回完整文本', async () => {
    const client = createMockLlmClient(['Hello, how can I help you?']);
    const result = await client.complete([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hi' },
    ]);
    expect(result).toBe('Hello, how can I help you?');
  });

  it('stream 逐 token 回调并返回完整文本', async () => {
    const tokens: string[] = [];
    const client = createMockLlmClient(['Hi there!']);
    const result = await client.stream(
      [{ role: 'user', content: 'Hello' }],
      (token) => tokens.push(token),
    );
    expect(result).toBe('Hi there!');
    expect(tokens.join('')).toBe('Hi there!');
  });

  it('多次调用依次返回不同响应', async () => {
    const client = createMockLlmClient(['First', 'Second']);
    const r1 = await client.complete([{ role: 'user', content: 'a' }]);
    const r2 = await client.complete([{ role: 'user', content: 'b' }]);
    expect(r1).toBe('First');
    expect(r2).toBe('Second');
  });

  it('空响应列表时返回空字符串', async () => {
    const client = createMockLlmClient([]);
    const result = await client.complete([{ role: 'user', content: 'test' }]);
    expect(result).toBe('');
  });
});
