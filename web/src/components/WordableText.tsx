/**
 * 把一段文本渲染为「可逐词交互」的文本：
 *  - 英文单词：悬浮高亮、可点击（回调单词 + 其屏幕位置，供上层弹查词框）
 *  - 其它字符（空格/标点/换行）：原样渲染
 */
interface WordableTextProps {
  text: string;
  onWordClick: (word: string, context: string, rect: DOMRect) => void;
  className?: string;
}

// 捕获分组保留分隔符，确保标点/空格原样保留
const TOKEN_RE = /([A-Za-z][A-Za-z'’-]*)/g;

export default function WordableText({ text, onWordClick, className }: WordableTextProps) {
  const parts: Array<{ word: boolean; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ word: false, value: text.slice(lastIndex, match.index) });
    }
    parts.push({ word: true, value: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ word: false, value: text.slice(lastIndex) });
  }

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.word ? (
          <span
            key={i}
            onClick={(e) =>
              onWordClick(p.value, text, (e.currentTarget as HTMLElement).getBoundingClientRect())
            }
            className="cursor-pointer rounded px-0.5 -mx-0.5 hover:bg-indigo-100 transition-colors"
          >
            {p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  );
}
