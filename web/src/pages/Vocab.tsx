import { useEffect } from 'react';

import { useVocabStore } from '../store/vocab';
import { useAuthStore } from '../store/auth';
import { getEngine, getCurrentEngine } from '../audio/tts-engine';
import { initTtsEngines } from '../audio/tts-init';
import { useSettingsStore } from '../store/settings';
import { NoteIcon } from '../components/icons';

initTtsEngines();

const SCENARIO_LABEL: Record<string, string> = {
  interview: '面试', meeting: '会议', presentation: '演讲', restaurant: '餐厅',
  doctor: '看医生', shopping: '购物', hotel: '酒店', smalltalk: '闲聊', ielts: '雅思',
  custom: '自由话题',
};

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Vocab() {
  const user = useAuthStore((s) => s.user);
  const { words, reload, remove } = useVocabStore();

  // 进入页面 / 切换用户时按当前用户命名空间重载
  useEffect(() => {
    reload();
  }, [user, reload]);

  const speak = (word: string) => {
    const settings = useSettingsStore.getState();
    const engine = getEngine('browser') ?? getCurrentEngine();
    engine.speak(word, { rate: settings.playbackSpeed });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl font-extrabold text-ink mb-2 flex items-center gap-2">
        <NoteIcon size={28} className="text-primary" /> 生词本
      </h1>
      <p className="text-sm text-sub mb-6">
        对话中点击不认识的单词即可查词、收藏；这里随时复习。共 {words.length} 个词。
      </p>

      {words.length === 0 ? (
        <div className="bg-white rounded-3xl border border-line shadow-card p-10 text-center">
          <NoteIcon size={44} className="mx-auto mb-3 text-sub" />
          <p className="font-bold text-ink mb-1">生词本还是空的</p>
          <p className="text-sm text-sub">在练习对话中点击 AI 说的单词，点「☆ 收藏」即可加入这里。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {words.map((w) => (
            <div key={w.word} className="bg-white rounded-2xl border border-line shadow-card p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-ink">{w.word}</span>
                <button
                  onClick={() => speak(w.word)}
                  className="text-gray-400 hover:text-indigo-600 transition-colors"
                  title="朗读"
                >
                  🔊
                </button>
                {w.phonetic && <span className="text-xs font-mono text-sub">{w.phonetic}</span>}
                {w.pos && <span className="text-[10px] px-1.5 py-0.5 rounded bg-canvas font-bold text-sub">{w.pos}</span>}
                <button
                  onClick={() => remove(w.word)}
                  className="ml-auto text-xs text-sub hover:text-danger transition-colors"
                  title="移出生词本"
                >
                  移除
                </button>
              </div>
              <p className="text-sm text-ink mt-1.5">{w.meaning}</p>
              {w.example && <p className="text-xs text-sub mt-1 leading-relaxed">例：{w.example}</p>}
              <div className="mt-2 flex items-center gap-2 text-[11px] text-sub">
                {w.scenarioId && (
                  <span className="px-1.5 py-0.5 rounded-full bg-primary-light text-primary-dark font-bold">
                    {SCENARIO_LABEL[w.scenarioId] ?? w.scenarioId}
                  </span>
                )}
                <span>收藏于 {fmtDate(w.addedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
