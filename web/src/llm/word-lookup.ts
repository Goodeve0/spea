/**
 * 单词查询：点击对话中的单词时，返回音标 + 词性 + 中文释义（结合语境）+ 例句。
 * 复用 LLM 非流式接口；按单词缓存，避免重复请求。
 */
import { chat } from './client';

export interface WordInfo {
  word: string;
  phonetic: string; // IPA 音标，如 /prəˈfeʃənl/
  pos: string; // 词性，如 adj. / n. / v.
  meaning: string; // 中文释义（结合语境）
  example: string; // 英文例句
}

const cache = new Map<string, WordInfo>();

function extractJson(raw: string): Record<string, unknown> | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 查询单词释义。
 * @param word 目标单词
 * @param context 该单词所在的句子（用于给出语境释义）
 */
export async function lookupWord(word: string, context = ''): Promise<WordInfo> {
  const key = word.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const raw = await chat(
    [
      {
        role: 'system',
        content:
          'You are a concise English-Chinese dictionary. Given an English word and the sentence it appears in, ' +
          'return ONLY a JSON object (no markdown) with keys: ' +
          '"phonetic" (IPA with slashes, e.g. /prəˈfeʃənl/), ' +
          '"pos" (part of speech abbreviation in English like n./v./adj./adv.), ' +
          '"meaning" (the Simplified Chinese meaning that fits THIS sentence context, concise), ' +
          '"example" (one short natural English example sentence using the word). ' +
          'No extra text.',
      },
      {
        role: 'user',
        content: `Word: ${word}\nSentence: ${context || '(no context)'}`,
      },
    ],
    { maxTokens: 200, temperature: 0.2 },
  );

  const parsed = extractJson(raw);
  const info: WordInfo = {
    word,
    phonetic: typeof parsed?.phonetic === 'string' ? parsed.phonetic : '',
    pos: typeof parsed?.pos === 'string' ? parsed.pos : '',
    meaning: typeof parsed?.meaning === 'string' ? parsed.meaning : '（暂无释义）',
    example: typeof parsed?.example === 'string' ? parsed.example : '',
  };
  cache.set(key, info);
  return info;
}
