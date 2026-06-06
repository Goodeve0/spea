/**
 * 课后报告生成
 *
 * 主路径：调用 LLM 产出结构化评估（5 维评分 + 错误 + 表达升级[含为什么] + 隐性重述 + CEFR + 总结）。
 * 降级路径：LLM 不可用或解析失败时，基于「真实对话内容」做启发式估算，
 *          绝不返回与对话无关的硬编码假数据。
 *
 * 重要：用户「没有任何发言」时，所有维度判 0、不给基线分，避免出现"没开口却 66 分"的不合理结果。
 */

import type { Turn } from '@speak-coach/shared';

import { parseReportJson } from '../pages/report-json';
import { chat } from './client';

export interface GeneratedReport {
  sessionId: string;
  radar: {
    pronunciation: number;
    fluency: number;
    grammar: number;
    vocabulary: number;
    taskCompletion: number;
  };
  topErrors: Array<{ errorType: string; count: number; example: string }>;
  expressionUpgrades: Array<{ from: string; to: string; why: string }>;
  recasts: Array<{ turnId: string; original: string; recast: string }>;
  summaryText: string;
  annotatedTurns: Array<Turn & { corrections: [] }>;
  cefrEstimate?: string;
  /** 本次是否有用户发言（无则不计入成长、不展示分数） */
  hasUserSpeech: boolean;
}

const SYSTEM_PROMPT = `You are an English speaking coach. Analyze the student's conversation and generate a performance report.
You MUST respond with ONLY a valid JSON object (no markdown, no code fences). Use this exact structure:
{
  "pronunciation": <number 0-100>,
  "fluency": <number 0-100>,
  "grammar": <number 0-100>,
  "vocabulary": <number 0-100>,
  "taskCompletion": <number 0-100>,
  "topErrors": [{"errorType": "grammar|word_choice|tense|article|preposition", "count": <number>, "example": "<error> -> <correction>"}],
  "expressionUpgrades": [{"from": "<original>", "to": "<better alternative>", "why": "<用口语化中文解释为什么更地道/更得体>"}],
  "recasts": [{"original": "<what the student actually said, with the mistake>", "recast": "<the natural, corrected way to say it>"}],
  "cefr": "<one of A1|A2|B1|B2|C1|C2>",
  "summaryText": "<2-3 sentence summary in Chinese>"
}

CRITICAL RULES:
- All string values must be valid JSON strings. Inside string values, escape ALL double quotes as \\" — never write a bare " inside a string.
- Prefer single quotes (') or no quotes when quoting fragments. e.g. "example": "he go -> he goes"
- "why" MUST be conversational Simplified Chinese, no linguistic jargon.
- "recasts" should only include the student's real mistakes that you would naturally rephrase; if there are none, return an empty array.
- No trailing commas. No comments. Output only the JSON object.

Be encouraging but honest. Scores should reflect real assessment. If the user made no errors, give high scores and empty arrays.`;

/** 生成报告：优先 LLM，失败回退到基于真实对话的启发式估算 */
export async function generateReport(turns: Turn[], sessionId = 'local-session'): Promise<GeneratedReport> {
  const userTurns = turns.filter((t) => t.role === 'user');

  // 没有任何发言：直接返回"无数据"报告，不调用 LLM、不给任何基线分
  if (userTurns.length === 0) {
    return buildEmptyReport(turns, sessionId);
  }

  try {
    return await generateViaLlm(turns, userTurns, sessionId);
  } catch (err) {
    console.error('[report-generator] LLM 生成失败，使用启发式降级:', err);
    return buildHeuristicReport(turns, userTurns, sessionId);
  }
}

async function generateViaLlm(turns: Turn[], userTurns: Turn[], sessionId: string): Promise<GeneratedReport> {
  const userMessages = userTurns.map((t, i) => `${i + 1}. "${t.text}"`).join('\n');

  const content = await chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Here are the student's messages during the conversation:\n${userMessages}` },
    ],
    { maxTokens: 900, temperature: 0.2 },
  );

  const parsed = parseReportJson(content);

  const radar = {
    pronunciation: clampScore(parsed.pronunciation, 70),
    fluency: clampScore(parsed.fluency, 70),
    grammar: clampScore(parsed.grammar, 70),
    vocabulary: clampScore(parsed.vocabulary, 70),
    taskCompletion: clampScore(parsed.taskCompletion, 70),
  };
  const overall = avg(Object.values(radar));

  return {
    sessionId,
    radar,
    topErrors: (parsed.topErrors ?? []).map((e) => ({
      errorType: e.errorType ?? 'grammar',
      count: e.count ?? 1,
      example: e.example ?? '',
    })),
    expressionUpgrades: (parsed.expressionUpgrades ?? [])
      .map((e) => ({
        from: e.from ?? '',
        to: e.to ?? '',
        why: e.why?.trim() || '更符合英语母语者的自然表达',
      }))
      .filter((e) => e.from && e.to),
    recasts: (parsed.recasts ?? [])
      .map((r) => ({ turnId: r.turnId ?? '', original: r.original ?? '', recast: r.recast ?? '' }))
      .filter((r) => r.original && r.recast),
    summaryText: parsed.summaryText ?? '本次练习已完成，继续加油！',
    annotatedTurns: turns.map((t) => ({ ...t, corrections: [] as [] })),
    cefrEstimate: normalizeCefr(parsed.cefr) ?? scoreToCefr(overall),
    hasUserSpeech: true,
  };
}

/** 无发言：所有维度 0，明确提示用户去开口，不污染成长曲线 */
function buildEmptyReport(turns: Turn[], sessionId: string): GeneratedReport {
  return {
    sessionId,
    radar: { pronunciation: 0, fluency: 0, grammar: 0, vocabulary: 0, taskCompletion: 0 },
    topErrors: [],
    expressionUpgrades: [],
    recasts: [],
    summaryText: '本次没有捕捉到你的发言，所以暂时无法评分。用麦克风或文字和 AI 多聊几轮，再来看报告就有数据啦～',
    annotatedTurns: turns.map((t) => ({ ...t, corrections: [] as [] })),
    hasUserSpeech: false,
  };
}

/**
 * 启发式报告（有发言但 LLM 不可用）：完全基于真实对话内容计算，不编造与对话无关的错误。
 * - 词汇量：Type-Token Ratio（去重词数 / 总词数）
 * - 流利度：平均每句词数
 * - 任务完成度：对话轮数
 */
function buildHeuristicReport(turns: Turn[], userTurns: Turn[], sessionId: string): GeneratedReport {
  const allWords = userTurns.flatMap((t) => t.text.toLowerCase().match(/[a-z']+/g) ?? []);
  const totalWords = allWords.length;
  const uniqueWords = new Set(allWords).size;

  const ttr = totalWords > 0 ? uniqueWords / totalWords : 0;
  const avgWordsPerTurn = userTurns.length > 0 ? totalWords / userTurns.length : 0;

  const vocabulary = totalWords === 0 ? 0 : clamp(Math.round(50 + ttr * 50), 50, 95);
  const fluency = totalWords === 0 ? 0 : clamp(Math.round(40 + avgWordsPerTurn * 4), 50, 95);
  const taskCompletion = clamp(60 + userTurns.length * 5, 60, 95);
  // 发音/语法无法离线评估，给中性基线并在总结里说明
  const pronunciation = 75;
  const grammar = 75;

  const radar = { pronunciation, fluency, grammar, vocabulary, taskCompletion };
  const overall = avg(Object.values(radar));

  const summaryText =
    `本次练习共 ${userTurns.length} 轮发言、约 ${totalWords} 个单词，词汇丰富度（去重率）约 ${Math.round(ttr * 100)}%。` +
    `（注：发音与语法为离线估算，AI 详细点评暂不可用，可稍后重试以获得更精准的反馈。）`;

  return {
    sessionId,
    radar,
    topErrors: [], // 离线无法可靠识别错误，宁可不显示也不编造
    expressionUpgrades: [],
    recasts: [],
    summaryText,
    annotatedTurns: turns.map((t) => ({ ...t, corrections: [] as [] })),
    cefrEstimate: scoreToCefr(overall),
    hasUserSpeech: true,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clampScore(n: number | undefined, fallback: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return fallback;
  return clamp(Math.round(n), 0, 100);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/** 综合分 → 近似 CEFR 等级 */
export function scoreToCefr(score: number): string {
  if (score >= 90) return 'C2';
  if (score >= 80) return 'C1';
  if (score >= 70) return 'B2';
  if (score >= 55) return 'B1';
  if (score >= 40) return 'A2';
  return 'A1';
}

function normalizeCefr(v: string | undefined): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = v.toUpperCase().match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  return m ? m[1] : undefined;
}
