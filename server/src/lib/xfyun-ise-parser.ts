import type { PronunciationResult, WordScore } from '@speak-coach/shared';

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

function extractTag(xml: string, tagName: string): Record<string, string> | null {
  const re = new RegExp(`<${tagName}\\s([^>/]*)(?:/>|>)`, 'i');
  const match = xml.match(re);
  if (!match) return null;
  return parseTagAttributes(match[1]);
}

/** 解析科大讯飞语音评测返回的 XML 结果 */
export function parseXfyunIseXml(xml: string): Omit<PronunciationResult, 'turnId'> {
  const sentence =
    extractTag(xml, 'read_sentence') ??
    extractTag(xml, 'read_chapter') ??
    extractTag(xml, 'rec_paper');

  const wordScores: WordScore[] = [];
  const wordRe = /<word\s([^>/]*)(?:\/>|>[\s\S]*?<\/word>)/gi;
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordRe.exec(xml)) !== null) {
    const attrs = parseTagAttributes(wordMatch[1]);
    if (!attrs.content) continue;
    wordScores.push({
      word: attrs.content,
      score: parseScore(attrs.total_score),
    });
  }

  return {
    accuracy: parseScore(sentence?.accuracy_score),
    fluency: parseScore(sentence?.fluency_score),
    completeness: parseScore(sentence?.integrity_score),
    prosody: parseScore(sentence?.standard_score),
    wordScores,
  };
}
