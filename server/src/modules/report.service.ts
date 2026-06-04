import type { ILlmClient } from '../lib/llm-client';
import type {
  Correction,
  PronunciationResult,
  Report,
  RadarScores,
  TopError,
  ExpressionUpgrade,
  Turn,
} from '@speak-coach/shared';

/** 报告服务接口 */
export interface IReportService {
  generate(sessionId: string, turns: Turn[], corrections: Correction[], pronunciations: PronunciationResult[]): Promise<Report>;
}

const REPORT_SYSTEM_PROMPT = `You are an English tutor generating a practice session summary.
Given the conversation, corrections, and pronunciation scores, generate:
1. A brief summary paragraph (2-3 sentences) in Chinese about the student's performance
2. Suggestions for improvement

Return a JSON object with:
- "summaryText": the summary paragraph in Chinese
- "vocabularyScore": estimated score 0-100 for vocabulary richness
- "taskCompletionScore": estimated score 0-100 for how well the student completed the scenario goal

Return ONLY the JSON object.`;

export class ReportService implements IReportService {
  constructor(private readonly llm: ILlmClient) {}

  async generate(
    sessionId: string,
    turns: Turn[],
    corrections: Correction[],
    pronunciations: PronunciationResult[],
  ): Promise<Report> {
    // 计算雷达图各维度
    const radar = this.computeRadar(turns, corrections, pronunciations);

    // 计算高频错误 TOP3
    const topErrors = this.computeTopErrors(corrections);

    // 计算表达升级列表
    const expressionUpgrades = this.computeExpressionUpgrades(corrections);

    // 生成文字总结
    const summaryText = await this.generateSummary(turns, corrections, pronunciations);

    // 构建逐句批注的 turns
    const userTurnIds = new Set(
      turns.filter((t) => t.role === 'user').map((t) => t.id),
    );
    const correctionMap = new Map<string, Correction[]>();
    for (const c of corrections) {
      if (!correctionMap.has(c.turnId)) correctionMap.set(c.turnId, []);
      correctionMap.get(c.turnId)!.push(c);
    }

    const annotatedTurns = turns.map((t) => ({
      ...t,
      corrections: correctionMap.get(t.id) ?? [],
    }));

    return {
      sessionId,
      radar,
      topErrors,
      expressionUpgrades,
      summaryText,
      annotatedTurns,
    };
  }

  /** 计算雷达图五维分数 */
  private computeRadar(
    turns: Turn[],
    corrections: Correction[],
    pronunciations: PronunciationResult[],
  ): RadarScores {
    const userTurns = turns.filter((t) => t.role === 'user');
    const totalSentences = Math.max(userTurns.length, 1);
    const totalWords = userTurns.reduce((sum, t) => sum + t.text.split(/\s+/).length, 0);

    // 发音维度：取所有评测结果的平均准确度
    const pronunciation =
      pronunciations.length > 0
        ? Math.round(
            pronunciations.reduce((sum, p) => sum + p.accuracy, 0) / pronunciations.length,
          )
        : 60; // 无数据时给默认中间分

    // 流利度维度：取评测流利度平均
    const fluency =
      pronunciations.length > 0
        ? Math.round(
            pronunciations.reduce((sum, p) => sum + p.fluency, 0) / pronunciations.length,
          )
        : 60;

    // 语法维度：正确句占比
    const sentencesWithErrors = new Set(corrections.filter((c) => c.errorType === 'grammar').map((c) => c.turnId)).size;
    const grammar = Math.round(((totalSentences - sentencesWithErrors) / totalSentences) * 100);

    // 词汇维度：词汇多样性 TTR (Type-Token Ratio)
    const allWords = userTurns.flatMap((t) => t.text.toLowerCase().split(/\s+/)).filter(Boolean);
    const uniqueWords = new Set(allWords);
    const ttr = allWords.length > 0 ? uniqueWords.size / allWords.length : 0;
    const vocabulary = Math.round(Math.min(ttr * 150, 100)); // 放大一下，避免 TTR 本身偏低

    // 任务完成度：让 LLM 评估（此处先用简单规则，有 corrections 中无 blocking 错误则高分）
    const blockingErrors = corrections.filter((c) => c.severity === 'blocking').length;
    const taskCompletion = Math.max(0, Math.round(100 - blockingErrors * 20));

    return { pronunciation, fluency, grammar, vocabulary, taskCompletion };
  }

  /** 计算高频错误 TOP3 */
  private computeTopErrors(corrections: Correction[]): TopError[] {
    const countByType = new Map<string, { count: number; example: string }>();
    for (const c of corrections) {
      const existing = countByType.get(c.errorType);
      if (existing) {
        existing.count++;
      } else {
        countByType.set(c.errorType, { count: 1, example: `"${c.original}" → "${c.corrected}"` });
      }
    }
    return Array.from(countByType.entries())
      .map(([errorType, data]) => ({ errorType, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  /** 计算表达升级列表 */
  private computeExpressionUpgrades(corrections: Correction[]): ExpressionUpgrade[] {
    return corrections
      .filter((c) => c.betterExpression)
      .map((c) => ({ from: c.original, to: c.betterExpression! }));
  }

  /** 生成文字总结 */
  private async generateSummary(
    turns: Turn[],
    corrections: Correction[],
    pronunciations: PronunciationResult[],
  ): Promise<string> {
    try {
      const conversationText = turns
        .map((t) => `${t.role}: ${t.text}`)
        .join('\n');
      const correctionsText = corrections
        .map((c) => `${c.original} → ${c.corrected} (${c.errorType})`)
        .join('\n');
      const pronAvg =
        pronunciations.length > 0
          ? Math.round(pronunciations.reduce((s, p) => s + p.accuracy, 0) / pronunciations.length)
          : 'N/A';

      const raw = await this.llm.complete([
        { role: 'system', content: REPORT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Conversation:\n${conversationText}\n\nCorrections:\n${correctionsText}\n\nAvg pronunciation: ${pronAvg}`,
        },
      ]);

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.summaryText ?? '练习完成！';
      }
      return '练习完成！';
    } catch {
      return '练习完成！继续加油！';
    }
  }
}
