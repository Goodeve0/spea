import type { PronunciationResult, WordScore } from '@speak-coach/shared';

/** 句/篇级分数所在的属性名（讯飞英文 ISE 多维评分） */
const SCORE_KEYS = [
  'accuracy_score',
  'fluency_score',
  'integrity_score',
  'standard_score',
  'total_score',
];

/**
 * 非单词标记，不计入逐词评分：
 * - sil  : 静音段（句首/句尾/词间）
 * - fil  : 填充停顿（嗯/呃 等）
 * - silv : 部分版本的静音变体
 * - spn  : spoken noise（杂音）
 */
const NON_WORD_TOKENS = new Set(['sil', 'fil', 'silv', 'spn', '']);

function parseTagAttributes(tagContent: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tagContent)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function parseScore(value: string | undefined): number {
  if (!value) return 0;
  const score = parseFloat(value);
  return Number.isFinite(score) ? Math.round(score) : 0;
}

/** 提取某标签（开始标签）的属性集合；取第一个出现的 */
function extractTag(xml: string, tagName: string): Record<string, string> | null {
  // 匹配 <tag ...> 或 <tag .../>，属性区不跨越 '>'
  const re = new RegExp(`<${tagName}\\s([^>]*?)/?>`, 'i');
  const match = xml.match(re);
  if (!match) return null;
  return parseTagAttributes(match[1]);
}

/**
 * 找到真正承载句/篇级分数的标签。
 *
 * 讯飞英文 read_sentence 的真实结构是嵌套的：
 *   <read_sentence lan="en" type="read_sentence" version="...">   ← 无分数
 *     <rec_paper>
 *       <read_chapter accuracy_score=".." fluency_score=".." ...> ← 分数在这里
 *
 * 因此不能按标签顺序取第一个非空，而要取「确实含有分数属性」的那个。
 * 同时兼容简化结构（分数直接挂在 read_sentence 上）。
 */
function findScoredTag(xml: string): Record<string, string> | null {
  const candidates = ['read_chapter', 'read_sentence', 'sentence', 'rec_paper'];
  for (const tag of candidates) {
    const attrs = extractTag(xml, tag);
    if (attrs && SCORE_KEYS.some((k) => k in attrs)) {
      return attrs;
    }
  }
  return null;
}

/** 解析科大讯飞语音评测返回的 XML 结果 */
export function parseXfyunIseXml(xml: string): Omit<PronunciationResult, 'turnId'> {
  const scored = findScoredTag(xml);

  const wordScores: WordScore[] = [];
  const wordRe = /<word\s([^>/]*)(?:\/>|>[\s\S]*?<\/word>)/gi;
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordRe.exec(xml)) !== null) {
    const attrs = parseTagAttributes(wordMatch[1]);
    const content = (attrs.content ?? '').trim();
    // 过滤静音/停顿等非单词标记
    if (NON_WORD_TOKENS.has(content.toLowerCase())) continue;
    if (!content) continue;
    wordScores.push({
      word: content,
      score: parseScore(attrs.total_score),
    });
  }

  return {
    accuracy: parseScore(scored?.accuracy_score),
    fluency: parseScore(scored?.fluency_score),
    completeness: parseScore(scored?.integrity_score),
    prosody: parseScore(scored?.standard_score),
    wordScores,
  };
}
