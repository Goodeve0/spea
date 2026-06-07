/**
 * 把 AI 的英文对话翻译成中文（按需，用户看不懂时点击触发）。
 * 复用 LLM 非流式接口；只返回译文，不带解释。
 */
import { chat } from './client';

export async function translateToZh(text: string): Promise<string> {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'You are a translator. Translate the user\'s English text into natural, concise Simplified Chinese. ' +
          'Output ONLY the translation itself — no explanations, no pinyin, no quotes, no English.',
      },
      { role: 'user', content: text },
    ],
    { maxTokens: 300, temperature: 0.2 },
  );
  return reply.trim();
}
