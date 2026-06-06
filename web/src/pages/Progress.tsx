import { useEffect, useState, lazy, Suspense } from 'react';
import { PRESET_SCENARIOS, type StoredSession } from '@speak-coach/shared';

import { loadGrowth } from '../store/growth';
import { useAuthStore } from '../store/auth';
import { levelInfo } from '../lib/gamification';

const GrowthCurve = lazy(() => import('../components/GrowthCurve'));

const SCENARIO_TITLE: Record<string, string> = Object.fromEntries(
  PRESET_SCENARIOS.map((s) => [s.id, s.title]),
);

function titleOf(scenarioId: string): string {
  return SCENARIO_TITLE[scenarioId] ?? (scenarioId === 'custom' ? '自由话题' : scenarioId);
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-3xl border border-line shadow-card p-4 text-center">
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-xl font-extrabold text-ink">{value}</div>
      <div className="text-xs text-sub mt-0.5">{label}</div>
    </div>
  );
}

export default function Progress() {
  const user = useAuthStore((s) => s.user);
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
    return () => {
      alive = false;
    };
  }, [user]);

  const l = levelInfo(xp);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl font-extrabold text-ink mb-6">📈 我的成长</h1>

      {/* 概览 */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard emoji="🔥" label="连续天数" value={`${streak}`} />
        <StatCard emoji="⭐" label="当前等级" value={`Lv.${l.level}`} />
        <StatCard emoji="⚡" label="累计 XP" value={`${xp}`} />
      </div>

      {/* 成长曲线 */}
      <section className="bg-white rounded-3xl border border-line shadow-card p-5 mb-8">
        <h2 className="font-extrabold text-ink mb-3">能力趋势</h2>
        <Suspense fallback={<div className="py-10 text-center text-sub text-sm">加载图表…</div>}>
          <GrowthCurve sessions={sessions} />
        </Suspense>
      </section>

      {/* 历史会话 */}
      <section>
        <h2 className="font-extrabold text-ink mb-3">练习记录</h2>
        {sessions.length === 0 ? (
          <div className="bg-white rounded-3xl border border-line shadow-card p-8 text-center">
            <div className="text-4xl mb-2">🌱</div>
            <p className="text-sub text-sm">还没有练习记录，去「练习」开聊第一次吧！</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="bg-white rounded-2xl border border-line shadow-card px-4 py-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="font-bold text-ink truncate">{titleOf(s.scenarioId)}</div>
                  <div className="text-xs text-sub mt-0.5">
                    {new Date(s.timestamp).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {s.cefrEstimate ? ` · ${s.cefrEstimate}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  <span className="text-lg font-extrabold text-primary">{Math.round(s.overallScore)}</span>
                  <span className="text-xs text-sub">分</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
