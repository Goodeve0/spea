import { type FC, useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRESET_SCENARIOS, type StoredSession } from '@speak-coach/shared';

import { loadGrowth } from '../store/growth';
import { useAuthStore } from '../store/auth';
import { levelInfo } from '../lib/gamification';
import { GrowthIcon, MelonIcon, StarIcon, BoltIcon, SproutIcon } from '../components/icons';
import type { IconProps } from '../components/icons';

const GrowthCurve = lazy(() => import('../components/GrowthCurve'));

const SCENARIO_TITLE: Record<string, string> = Object.fromEntries(
  PRESET_SCENARIOS.map((s) => [s.id, s.title]),
);

function titleOf(scenarioId: string): string {
  return SCENARIO_TITLE[scenarioId] ?? (scenarioId === 'custom' ? '自由话题' : scenarioId);
}

function StatCard({ Icon, label, value }: { Icon: FC<IconProps>; label: string; value: string }) {
  return (
    <div className="bg-white rounded-3xl border border-line shadow-card p-4 text-center">
      <Icon size={28} className="mx-auto mb-1 text-primary" />
      <div className="text-xl font-extrabold text-ink">{value}</div>
      <div className="text-xs text-sub mt-0.5">{label}</div>
    </div>
  );
}

export default function Progress() {
  const navigate = useNavigate();
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
      <h1 className="text-2xl font-extrabold text-ink mb-6 flex items-center gap-2">
        <GrowthIcon size={28} className="text-primary" /> 我的成长
      </h1>

      {/* 概览 */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard Icon={MelonIcon} label="连续天数" value={`${streak}`} />
        <StatCard Icon={StarIcon} label="当前等级" value={`Lv.${l.level}`} />
        <StatCard Icon={BoltIcon} label="累计 XP" value={`${xp}`} />
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
            <SproutIcon size={40} className="mx-auto mb-2" />
            <p className="text-sub text-sm">瓜田还空着，去「练习」种下第一颗瓜吧！</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                onClick={() => navigate(`/session/${s.id}`)}
                className="bg-white rounded-2xl border border-line shadow-card px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-primary-light/25 active:scale-[0.98] transition-all"
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
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-extrabold text-primary">{Math.round(s.overallScore)}</span>
                    <span className="text-xs text-sub">分</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sub/50"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
