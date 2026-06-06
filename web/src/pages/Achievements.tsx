import { useEffect, useState } from 'react';
import type { StoredSession } from '@speak-coach/shared';

import AchievementWall from '../components/AchievementWall';
import { loadGrowth } from '../store/growth';
import { useAuthStore } from '../store/auth';
import { evaluateAchievements, todayDone } from '../lib/gamification';

export default function Achievements() {
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
    return () => {
      alive = false;
    };
  }, [user]);

  const achievements = evaluateAchievements(sessions, streak);
  const done = todayDone(sessions);
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl font-extrabold text-ink mb-6">🏅 我的成就</h1>

      {/* 每日目标 */}
      <div
        className={`mb-8 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border text-sm font-bold ${
          done ? 'bg-success/10 border-success/30 text-success' : 'bg-white border-line text-ink shadow-card'
        }`}
      >
        {done ? `✅ 今日已完成 · 连击 ${streak} 天` : '🎯 今日目标：完成 1 次练习，点亮连击'}
      </div>

      {/* 成就墙 */}
      <section className="bg-white rounded-3xl border border-line shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-ink">徽章</h2>
          <span className="text-sm text-sub font-bold">
            {unlocked} / {achievements.length} 已解锁
          </span>
        </div>
        <AchievementWall achievements={achievements} />
      </section>
    </div>
  );
}
