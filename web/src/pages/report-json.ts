/**
 * 容错解析 LLM 返回的报告 JSON。
 * LLM 经常在 example 等自由文本里写未转义的双引号，先做最小修复再 parse。
 */

interface RawReport {
  pronunciation?: number;
  fluency?: number;
  grammar?: number;
  vocabulary?: number;
  taskCompletion?: number;
  topErrors?: Array<{ errorType?: string; count?: number; example?: string }>;
  expressionUpgrades?: Array<{ from?: string; to?: string; why?: string }>;
  recasts?: Array<{ turnId?: string; original?: string; recast?: string }>;
  cefr?: string;
  summaryText?: string;
}

export function parseReportJson(raw: string): RawReport {
  if (!raw || !raw.trim()) {
    throw new Error('empty content');
  }

  let jsonStr = raw.trim();

  // 去 markdown code fence
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  // 抽出最外层 {...}（防止 LLM 在 JSON 前后说废话）
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start >= 0 && end > start) {
    jsonStr = jsonStr.slice(start, end + 1);
  }

  // 第一次直接 parse
  try {
    return JSON.parse(jsonStr) as RawReport;
  } catch {
    // 继续修复
  }

  // 修复一：去掉对象/数组结尾多余的逗号
  let repaired = jsonStr.replace(/,\s*([}\]])/g, '$1');

  // 修复二：把字符串值里未转义的引号转义掉
  // 策略：用状态机扫描，处于 string 状态时遇到 `"` 看其后是否紧跟 `,` `}` `]` `:` 或空白+这些
  // 不是 → 视为内容，转义为 \"
  repaired = escapeStrayQuotes(repaired);

  try {
    return JSON.parse(repaired) as RawReport;
  } catch (err) {
    console.error('[parseReportJson] failed after repair, raw:', raw.slice(0, 200), err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

function escapeStrayQuotes(input: string): string {
  const chars = Array.from(input);
  let inString = false;
  let escaped = false;

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];

    if (!inString) {
      if (ch === '"') inString = true;
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      // 看后面第一个非空白字符
      let j = i + 1;
      while (j < chars.length && /\s/.test(chars[j])) j += 1;
      const next = chars[j];
      if (next === ',' || next === '}' || next === ']' || next === ':' || j >= chars.length) {
        inString = false;
      } else {
        // 字符串内部的裸引号 → 转义
        chars[i] = '\\"';
      }
    }
  }

  return chars.join('');
}
