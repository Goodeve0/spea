/**
 * 语音转写文本规范化：句首大写 + 句末标点 + 空白折叠。
 *
 * 用于服务端 ASR（SenseVoice）与浏览器 SpeechRecognition 两条路径，
 * 保证最终 `onTranscript` 收到的字符串符合 `voice-input-transcript` spec。
 *
 * 算法（纯函数，无副作用）：
 *  1. trim + 折叠多空白
 *  2. 按句末标点（. ? !）切句
 *  3. 每句首字母大写（仅首字符；缩写、所有格不动）
 *  4. 句末若无标点：以疑问词起句补 `?`，否则补 `.`
 *  5. 单空格连接句子
 *
 * 注意：仅做"句末"判断；中间已存在的 , ; : 原样保留。
 */

/** 起句疑问词（小写比对） */
const QUESTION_STARTERS = new Set([
  'who', 'what', 'where', 'when', 'why', 'how', 'which', 'whose',
  'can', 'could', 'do', 'does', 'did',
  'is', 'are', 'am', 'was', 'were',
  'will', 'would', 'should', 'shall', 'may', 'might',
  'have', 'has', 'had',
]);

/** 句末标点 */
const SENTENCE_END = /[.?!]/;

function capitalizeFirst(word: string): string {
  if (!word) return word;
  const first = word[0];
  const upper = first.toUpperCase();
  if (upper === first) return word;
  return upper + word.slice(1);
}

function endsWithSentencePunct(s: string): boolean {
  return SENTENCE_END.test(s.charAt(s.length - 1));
}

function pickEndPunct(sentence: string): '.' | '?' {
  const firstWord = sentence.trim().split(/\s+/, 1)[0] ?? '';
  const stripped = firstWord.toLowerCase().replace(/[^a-z']/g, '');
  return QUESTION_STARTERS.has(stripped) ? '?' : '.';
}

/** 把字符串按句末标点切成 [句正文, 标点][]，未带标点的最后一段标点为 '' */
function splitSentences(input: string): Array<{ body: string; end: string }> {
  const out: Array<{ body: string; end: string }> = [];
  let buf = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (SENTENCE_END.test(ch)) {
      out.push({ body: buf, end: ch });
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim().length > 0) out.push({ body: buf, end: '' });
  return out;
}

/**
 * 把语音转写原始文本规范化为「句首大写 + 句末标点 + 折叠空白」。
 * @param raw 任意来源的转写字符串
 * @returns 规范化后的字符串；空输入返回 ''
 */
export function normalizeTranscript(raw: string): string {
  if (!raw) return '';
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';

  const parts = splitSentences(collapsed);
  if (parts.length === 0) return '';

  const sentences: string[] = [];
  for (const { body, end } of parts) {
    const trimmed = body.trim();
    if (!trimmed) continue;
    const capitalized = capitalizeFirst(trimmed);
    const punct = end || (endsWithSentencePunct(capitalized) ? '' : pickEndPunct(capitalized));
    sentences.push(`${capitalized}${punct}`);
  }
  return sentences.join(' ');
}
