import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRESET_SCENARIOS, type StoredSession } from '@speak-coach/shared';

import Mascot from '../components/ui/Mascot';
import { loadGrowth } from '../store/growth';
import { useAuthStore } from '../store/auth';
import { todayDone } from '../lib/gamification';

const SCENARIO_EMOJI: Record<string, string> = {
  interview: '💼', meeting: '📋', presentation: '🎤', restaurant: '🍽️',
  doctor: '🩺', shopping: '🛍️', hotel: '🏨', smalltalk: '💬', ielts: '🎓',
};

/**
 * 主页（点击侧边栏/顶部 Logo 进入）：吉祥物 Hero + 每日目标 + 「开始练习」入口。
 * 真正的场景选择在「练习」页（/practice）。
 */
export default function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [streak, setStreak] = useState(0);
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    let alive = true;
    loadGrowth().then((g) => {
      if (!alive) return;
      setStreak(g.streak);
      setSessions(g.sessions);
    });
    return () => { alive = false; };
  }, [user]);

  const done = todayDone(sessions);
  // 今日推荐：随机挑 3 个场景做快捷入口
  const picks = PRESET_SCENARIOS.slice(0, 3);

  const enter = (scenarioId: string) => {
    localStorage.setItem('scenarioId', scenarioId);
    localStorage.setItem('difficulty', localStorage.getItem('difficulty') ?? 'intermediate');
    navigate('/conversation');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:py-14">
      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-8 animate-pop-in">
        <Mascot size={120} className="animate-float drop-shadow-sm" />
        <div className="relative mt-4 px-6 py-4 bg-white rounded-3xl shadow-card border border-line max-w-sm">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-line rotate-45" />
          <p className="text-ink font-extrabold text-xl leading-snug">种瓜得瓜，开口呱呱！</p>
          <p className="text-sub text-sm mt-1.5">和 AI 唠几句，把英语练成肌肉记忆 🍈</p>
        </div>
      </div>

      {/* 每日目标 */}
      <div className="mb-6 flex justify-center">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold ${done ? 'bg-success/10 border-success/30 text-success' : 'bg-white border-line text-ink shadow-card'}`}>
          {done ? `✅ 今日已完成 · 连续 ${streak} 天` : '🎯 今日目标：完成 1 次练习，点亮连续'}
        </div>
      </div>

      {/* 主 CTA */}
      <button
        onClick={() => navigate('/practice')}
        className="w-full py-4 bg-primary text-white rounded-3xl text-lg font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all shadow-pop"
      >
        开始练习 →
      </button>

      {/* 今日推荐快捷入口 */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-extrabold text-ink">今日推荐</h3>
          <button onClick={() => navigate('/practice')} className="text-xs font-bold text-primary-dark hover:underline">
            全部场景 →
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {picks.map((s) => (
            <button
              key={s.id}
              onClick={() => enter(s.id)}
              className="group text-left bg-white rounded-2xl border border-line border-b-4 shadow-card p-4 transition-all hover:-translate-y-1 hover:shadow-pop active:translate-y-0 active:border-b"
            >
              <div className="text-2xl mb-1">{SCENARIO_EMOJI[s.id] ?? '🎯'}</div>
              <div className="font-extrabold text-ink text-sm">{s.title}</div>
              <div className="text-xs text-sub mt-0.5 line-clamp-2">{s.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
