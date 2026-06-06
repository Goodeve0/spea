import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PRESET_SCENARIOS,
  SCENARIO_CATEGORIES,
  buildFreeTopicScenario,
  type Difficulty,
  type StoredSession,
} from '@speak-coach/shared';

import Mascot from '../components/ui/Mascot';
import LevelBar from '../components/ui/LevelBar';
import AchievementWall from '../components/AchievementWall';
import { loadGrowth } from '../store/growth';
import { useAuthStore } from '../store/auth';
import { evaluateAchievements, todayDone } from '../lib/gamification';
import { setCustomScenario } from '../lib/scenario';

const DIFFICULTIES: { id: Difficulty; label: string; emoji: string }[] = [
  { id: 'beginner', label: 'Beginner', emoji: '🌱' },
  { id: 'intermediate', label: 'Intermediate', emoji: '🌿' },
  { id: 'advanced', label: 'Advanced', emoji: '🌳' },
];

const SCENARIO_EMOJI: Record<string, string> = {
  interview: '💼', meeting: '📋', presentation: '🎤', restaurant: '🍽️',
  doctor: '🩺', shopping: '🛍️', hotel: '🏨', smalltalk: '💬', ielts: '🎓',
};

const CATEGORY_STYLE: Record<string, { tint: string; accent: string }> = {
  career: { tint: 'bg-primary-light', accent: 'from-primary to-primary-dark' },
  life: { tint: 'bg-orange-50', accent: 'from-accent to-accent-dark' },
  travel: { tint: 'bg-sky-50', accent: 'from-sky-400 to-sky-600' },
  social: { tint: 'bg-purple-50', accent: 'from-purple-400 to-purple-600' },
  exam: { tint: 'bg-green-50', accent: 'from-success to-emerald-600' },
};

const DIFF_BADGE: Record<Difficulty, string> = {
  beginner: 'bg-success/15 text-success',
  intermediate: 'bg-warning/20 text-yellow-700',
  advanced: 'bg-danger/15 text-danger',
};

export default function ScenarioHub() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [freeTopic, setFreeTopic] = useState('');
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    let alive = true;
    loadGrowth().then((g) => {
      if (!alive) return;
      setStreak(g.streak);
      setXp(g.totalXp);
      setSessions(g.sessions);
    });
    return () => { alive = false; };
  }, [user]);

  const achievements = evaluateAchievements(sessions, streak);
  const done = todayDone(sessions);

  const enter = (scenarioId: string) => {
    localStorage.setItem('scenarioId', scenarioId);
    localStorage.setItem('difficulty', difficulty);
    navigate('/conversation');
  };

  const startFree = () => {
    setCustomScenario(buildFreeTopicScenario(freeTopic, difficulty));
    enter('custom');
  };

  const startRandom = () => {
    const s = PRESET_SCENARIOS[Math.floor(Math.random() * PRESET_SCENARIOS.length)];
    enter(s.id);
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* 顶部状态栏 */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-line">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-ink">
            <Mascot size={38} />
            <span className="hidden sm:inline text-lg">Speak Coach</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-sm font-bold">
            <LevelBar totalXp={xp} />
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-accent-dark" title="连续练习天数">🔥 {streak}</span>
            {user ? (
              <button onClick={logout} title="点击登出" className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full hover:bg-canvas transition-colors">
                <span className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-extrabold">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline text-ink font-medium max-w-[72px] truncate">{user.displayName}</span>
              </button>
            ) : (
              <button onClick={() => navigate('/login')} className="px-3 py-1.5 rounded-full bg-primary text-white text-xs font-extrabold border-b-2 border-primary-dark active:translate-y-0.5 active:border-b-0">
                登录
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="flex flex-col items-center text-center mb-8 animate-pop-in">
          <Mascot size={104} className="animate-float drop-shadow-sm" />
          <div className="relative mt-4 px-5 py-3 bg-white rounded-3xl shadow-card border border-line max-w-sm">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-line rotate-45" />
            <p className="text-ink font-bold text-lg leading-snug">Hi! 准备好开口说英语了吗？</p>
            <p className="text-sub text-sm mt-1">选场景，或聊任意话题 👇</p>
          </div>
        </div>

        {/* 每日目标 */}
        <div className="mb-6 flex justify-center">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold ${done ? 'bg-success/10 border-success/30 text-success' : 'bg-white border-line text-ink shadow-card'}`}>
            {done ? `✅ 今日已完成 · 连击 ${streak} 天` : '🎯 今日目标：完成 1 次练习，点亮连击'}
          </div>
        </div>

        {/* 难度 */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex p-1 bg-white rounded-2xl border border-line shadow-card">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={`px-4 sm:px-5 py-2 rounded-xl text-sm font-bold transition-all ${difficulty === d.id ? 'bg-primary text-white shadow-pop' : 'text-sub hover:text-ink'}`}
              >
                <span className="mr-1">{d.emoji}</span>{d.label}
              </button>
            ))}
          </div>
        </div>

        {/* 自由话题 + 随机 */}
        <div className="mb-10 bg-white rounded-3xl border border-line shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">✨</span>
            <h3 className="font-extrabold text-ink">自由话题</h3>
            <span className="text-xs text-sub">想聊什么就聊什么</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={freeTopic}
              onChange={(e) => setFreeTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') startFree(); }}
              placeholder="比如：我的周末计划、最近看的电影、点咖啡…"
              className="flex-1 px-4 py-2.5 rounded-2xl border border-line focus:border-primary focus:ring-2 focus:ring-primary-light outline-none text-sm"
            />
            <button onClick={startFree} className="px-5 py-2.5 bg-primary text-white rounded-2xl font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all">
              开聊 →
            </button>
            <button onClick={startRandom} className="px-4 py-2.5 rounded-2xl font-bold text-sub border border-line hover:text-ink hover:border-primary transition-colors">
              🎲 随机
            </button>
          </div>
        </div>

        {/* 分类场景 */}
        {SCENARIO_CATEGORIES.map((cat) => {
          const list = PRESET_SCENARIOS.filter((s) => s.category === cat.id);
          if (list.length === 0) return null;
          return (
            <div key={cat.id} className="mb-8">
              <h3 className="text-sm font-extrabold text-ink mb-3 flex items-center gap-1.5">
                <span>{cat.emoji}</span>{cat.label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {list.map((scenario, i) => {
                  const style = CATEGORY_STYLE[scenario.category ?? 'career'] ?? CATEGORY_STYLE.career;
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => enter(scenario.id)}
                      style={{ animationDelay: `${i * 60}ms` }}
                      className="group text-left bg-white rounded-3xl border border-line border-b-4 shadow-card overflow-hidden transition-all hover:-translate-y-1 hover:shadow-pop active:translate-y-0 active:border-b animate-pop-in"
                    >
                      <div className={`h-2 bg-gradient-to-r ${style.accent}`} />
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-12 h-12 rounded-2xl ${style.tint} flex items-center justify-center text-2xl`}>
                            {SCENARIO_EMOJI[scenario.id] ?? '🎯'}
                          </div>
                          <div>
                            <h2 className="text-base font-extrabold text-ink">{scenario.title}</h2>
                            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${DIFF_BADGE[difficulty]}`}>
                              {DIFFICULTIES.find((d) => d.id === difficulty)?.label}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-sub leading-relaxed mb-3 min-h-[40px]">{scenario.description}</p>
                        <span className="block w-full text-center bg-primary text-white py-2.5 rounded-2xl font-extrabold border-b-4 border-primary-dark transition-all group-hover:brightness-105 group-active:translate-y-0.5 group-active:border-b-0">
                          Start →
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* 成就墙 */}
        <div className="mt-12">
          <h3 className="text-sm font-extrabold text-ink mb-3 text-center">🏅 我的成就</h3>
          <AchievementWall achievements={achievements} />
        </div>
      </main>
    </div>
  );
}
