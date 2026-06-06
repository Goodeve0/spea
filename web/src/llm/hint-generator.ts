/**
 * 递台阶（Hint Engine）：用户卡壳时，生成一个开头引导 + 2-3 个可点选示例回答。
 *
 * 设计约束（见 specs/conversation-hint-engine）：
 * - 轻量、快速；任何失败/超时都必须静默返回 null，绝不影响主对话链路。
 */

import type { Difficulty, Scenario } from '@speak-coach/shared';

import { chat, type ChatMessage } from './client';

export interface Hints {
  /** 一个简短的英文句子开头，帮用户起步 */
  opener: string;
  /** 2-3 个可直接点选发送的完整示例回答 */
  suggestions: string[];
}

const TIMEOUT_MS = 8000;

/** 生成递台阶提示；失败或超时返回 null（调用方静默忽略）。 */
export async function generateHints(
  scenario: Scenario,
  lastAiText: string,
  difficulty: Difficulty,
): Promise<Hints | null> {
  const system: ChatMessage = {
    role: 'system',
    content:
      `You help a nervous English learner who is stuck and silent during a spoken "${scenario.title}" role-play at ${difficulty} level. ` +
      `Their conversation partner just said: "${lastAiText}". ` +
      `Give the learner a gentle scaffold so they can reply. ` +
      `Respond with ONLY a valid JSON object (no markdown, no code fences) of this exact shape: ` +
      `{"opener": "<a short English sentence starter, at most 6 words>", "suggestions": ["<a short natural full reply>", "<another>", "<another>"]}. ` +
      `Provide 2 or 3 suggestions. Keep everything short, spoken, natural, and appropriate to the ${difficulty} level. ` +
      `Each suggestion must be a plausible reply to what the partner just said.`,
  };

  try {
    const content = await withTimeout(chat([system], { maxTokens: 200, temperature: 0.7 }), TIMEOUT_MS);
    return parseHints(content);
  } catch (err) {
    console.warn('[hint-generator] 生成提示失败，已静默忽略:', err);
    return null;
  }
}

/** 从 LLM 文本中解析 Hints；任何异常或空建议返回 null。 */
export function parseHints(raw: string): Hints | null {
  const jsonText = extractJson(raw);
  if (!jsonText) return null;
  try {
    const obj = JSON.parse(jsonText) as Partial<Hints>;
    const suggestions = Array.isArray(obj.suggestions)
      ? obj.suggestions.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 3)
      : [];
    if (suggestions.length === 0) return null;
    return {
      opener: typeof obj.opener === 'string' ? obj.opener.trim() : '',
      suggestions: suggestions.map((s) => s.trim()),
    };
  } catch {
    return null;
  }
}

/** 截取首个 `{` 到最后一个 `}` 之间的内容（容忍模型偶发的多余文字/代码围栏）。 */
function extractJson(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('hint generation timeout')), ms);
    p.then(
      (v) => { clearTimeout(id); resolve(v); },
      (e) => { clearTimeout(id); reject(e); },
    );
  });
}
