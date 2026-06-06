/**
 * 轻量 Markdown 清理：把模型可能输出的 markdown 标记转成自然的纯文本。
 *
 * 用途：
 * 1) 聊天气泡显示——口语陪练不该出现 ** 、* 、# 等符号
 * 2) TTS 朗读——避免把 "star star" 之类符号读出来
 *
 * 不做完整 markdown 渲染（口语对话本就不该有格式），只做"去格式化"。
 */
export function stripMarkdown(input: string): string {
  if (!input) return '';

  let text = input;

  // 代码块 ```...``` → 仅保留内容
  text = text.replace(/```[a-zA-Z]*\n?([\s\S]*?)```/g, '$1');
  // 行内代码 `code` → code
  text = text.replace(/`([^`]+)`/g, '$1');
  // 图片 ![alt](url) → alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 链接 [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // 加粗 **text** / __text__ → text
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  // 斜体 *text* / _text_ → text（避免误伤句中的单个 *）
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, '$1$2');
  text = text.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, '$1$2');
  // 标题 ### text → text
  text = text.replace(/^#{1,6}\s+/gm, '');
  // 引用 > text → text
  text = text.replace(/^>\s?/gm, '');
  // 无序列表 -、*、+ → •（更口语，也便于朗读时自然停顿）
  text = text.replace(/^\s*[-*+]\s+/gm, '• ');
  // 分隔线 --- / *** → 去掉
  text = text.replace(/^\s*([-*_])\1{2,}\s*$/gm, '');
  // 多余的连续空行收敛为最多一个空行
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
