import type { ILlmClient } from '../lib/llm-client';
import type { Correction, ErrorSeverity } from '@speak-coach/shared';

/** 纠错服务接口 */
export interface ICorrectionService {
  /** 分析一句用户发言，返回 0..n 条纠错 */
  analyze(text: string): Promise<Correction[]>;
}

/** LLM 返回的原始纠错结构 */
interface RawCorrection {
  original: string;
  corrected: string;
  errorType: string;
  severity: string;
  explanation: string;
  betterExpression?: string;
}

const CORRECTION_SYSTEM_PROMPT = `You are an English language tutor analyzing a learner's sentence.
Identify grammar errors, word choice issues, and opportunities for more native-like expression.

Return a JSON array of corrections. Each correction should have:
- "original": the error phrase from the user's sentence
- "corrected": the corrected version
- "errorType": one of "grammar", "word_choice", "expression"
- "severity": one of "blocking" (meaning is unclear), "major" (noticeable error), "minor" (small improvement)
- "explanation": brief explanation in Chinese
- "betterExpression" (optional): a more native/natural way to express the whole idea

If the sentence is correct, return an empty array [].
Return ONLY the JSON array, no other text.`;

export class CorrectionService implements ICorrectionService {
  constructor(private readonly llm: ILlmClient) {}

  async analyze(text: string): Promise<Correction[]> {
    if (!text.trim()) {
      return [];
    }

    const raw = await this.llm.complete([
      { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ]);

    const parsed = this.parseResponse(raw);
    const turnId = ''; // 调用方注入
    return parsed.map((c) => ({
      turnId,
      ...c,
      severity: this.normalizeSeverity(c.severity),
    }));
  }

  /** 设置 turnId 便捷方法 */
  async analyzeForTurn(text: string, turnId: string): Promise<Correction[]> {
    const corrections = await this.analyze(text);
    return corrections.map((c) => ({ ...c, turnId }));
  }

  private parseResponse(raw: string): RawCorrection[] {
    try {
      // 尝试提取 JSON 数组（可能被 markdown 包裹）
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];
      return parsed as RawCorrection[];
    } catch {
      // 解析失败，优雅降级返回空
      return [];
    }
  }

  private normalizeSeverity(sev: string): ErrorSeverity {
    const valid: ErrorSeverity[] = ['blocking', 'major', 'minor'];
    const lower = sev.toLowerCase() as ErrorSeverity;
    return valid.includes(lower) ? lower : 'minor';
  }
}
