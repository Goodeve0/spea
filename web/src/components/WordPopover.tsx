import { useEffect, useState } from 'react';

import { lookupWord, type WordInfo } from '../llm/word-lookup';
import { useVocabStore } from '../store/vocab';
import { getEngine, getCurrentEngine } from '../audio/tts-engine';
import { useSettingsStore } from '../store/settings';

const POPOVER_WIDTH = 260;

/** 计算锚定在单词附近、且不超出视口的固定定位 */
function computePosition(rect: DOMRect): { top: number; left: number } {
  const margin = 8;
  let left = rect.left;
  if (left + POPOVER_WIDTH > window.innerWidth - margin) {
    left = window.innerWidth - POPOVER_WIDTH - margin;
  }
  left = Math.max(margin, left);
  // 默认放在单词下方；底部空间不足则放上方
  const belowTop = rect.bottom + 6;
  const top = belowTop;
  return { top, left };
}

/**
 * 查词弹层：显示音标/词性/中文释义/例句，可朗读单词、可加入/移出生词本。
 */
export default function WordPopover({
  word,
  context,
  rect,
  scenarioId,
  onClose,
}: {
  word: string;
  context: string;
  rect: DOMRect;
  scenarioId?: string;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<WordInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { add, remove, has } = useVocabStore();
  const saved = has(word);

  const pos = computePosition(rect);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setInfo(null);
    lookupWord(word, context)
      .then((r) => {
        if (alive) setInfo(r);
      })
      .catch(() => {
        if (alive) setInfo({ word, phonetic: '', pos: '', meaning: '查询失败，请重试', example: '' });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [word, context]);

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const speak = () => {
    const settings = useSettingsStore.getState();
    // 单词朗读优先浏览器引擎（快、无网络依赖）
    const engine = getEngine('browser') ?? getCurrentEngine();
    engine.speak(word, { rate: settings.playbackSpeed });
  };

  const toggleSave = () => {
    if (saved) {
      remove(word);
    } else if (info) {
      add({
        word,
        phonetic: info.phonetic,
        pos: info.pos,
        meaning: info.meaning,
        example: info.example,
        addedAt: Date.now(),
        scenarioId,
      });
    }
  };

  return (
    <>
      {/* 点击外部关闭 */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-[260px] bg-white rounded-2xl shadow-pop border border-line p-4 animate-pop-in"
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-extrabold text-ink">{word}</span>
          <button
            onClick={speak}
            className="text-gray-400 hover:text-indigo-600 transition-colors"
            title="朗读单词"
          >
            🔊
          </button>
          <button
            onClick={toggleSave}
            disabled={loading || !info}
            className={`ml-auto text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
              saved
                ? 'text-accent-dark bg-accent/10'
                : 'text-gray-400 hover:text-accent-dark hover:bg-accent/10'
            } disabled:opacity-40`}
            title={saved ? '移出生词本' : '加入生词本'}
          >
            {saved ? '★ 已收藏' : '☆ 收藏'}
          </button>
        </div>

        {loading ? (
          <div className="mt-3 flex items-center gap-1.5 text-sub text-sm">
            <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="ml-1">查询中…</span>
          </div>
        ) : (
          info && (
            <div className="mt-2 space-y-1.5">
              {(info.phonetic || info.pos) && (
                <div className="flex items-center gap-2 text-xs text-sub">
                  {info.phonetic && <span className="font-mono">{info.phonetic}</span>}
                  {info.pos && <span className="px-1.5 py-0.5 rounded bg-canvas font-bold">{info.pos}</span>}
                </div>
              )}
              <p className="text-sm text-ink leading-relaxed">{info.meaning}</p>
              {info.example && (
                <p className="text-xs text-sub leading-relaxed pt-1 border-t border-line">
                  例：{info.example}
                </p>
              )}
            </div>
          )
        )}
      </div>
    </>
  );
}
