import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StoredSession } from '@speak-coach/shared';

import Mascot from '../components/ui/Mascot';
import GardenHeatmap from '../components/GardenHeatmap';
import { useAuthStore } from '../store/auth';
import { loadGrowth } from '../store/growth';
import { levelInfo, levelStage } from '../lib/gamification';

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [xp, setXp] = useState(0);
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    let alive = true;
    loadGrowth().then((g) => {
      if (!alive) return;
      setXp(g.totalXp);
      setSessions(g.sessions);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const l = levelInfo(xp);
  const stage = levelStage(l.level);
  const toNext = l.levelSpan - l.intoLevel;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl font-extrabold text-ink mb-6">👤 我的</h1>

      {/* 账号 / 登录引导 */}
      {user ? (
        <section className="bg-white rounded-3xl border border-line shadow-card p-6 flex items-center gap-4 mb-6">
          <span className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-extrabold flex-shrink-0">
            {user.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="text-lg font-extrabold text-ink truncate">{user.displayName}</div>
            <div className="text-sm text-sub truncate">{user.email}</div>
          </div>
        </section>
      ) : (
        <section className="bg-white rounded-3xl border border-line shadow-card p-6 text-center mb-6">
          <Mascot size={72} className="mx-auto mb-3" />
          <p className="font-bold text-ink mb-1">登录后，瓜田永久保存</p>
          <p className="text-sm text-sub mb-4">换设备、换浏览器，你的瓜照样在田里等你</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 rounded-2xl bg-primary text-white font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all"
          >
            登录 / 注册
          </button>
        </section>
      )}

      {/* 瓜级卡 */}
      <section className="bg-white rounded-3xl border border-line shadow-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{stage.emoji}</span>
            <div>
              <div className="font-extrabold text-ink">瓜级 Lv.{l.level} · {stage.name}</div>
              <div className="text-xs text-sub mt-0.5">再攒 {toNext} 甜度即可升级</div>
            </div>
          </div>
          <span className="text-sm font-extrabold text-primary">{xp} 甜度</span>
        </div>
        <div className="h-3 rounded-full bg-canvas overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-700"
            style={{ width: `${Math.max(4, Math.round(l.progress * 100))}%` }}
          />
        </div>
      </section>

      {/* 我的瓜田 */}
      <section className="bg-white rounded-3xl border border-line shadow-card p-5 mb-6">
        <h2 className="font-extrabold text-ink mb-3">🍈 我的瓜田</h2>
        <GardenHeatmap sessions={sessions} />
      </section>

      {/* 登出 */}
      {user && (
        <button
          onClick={logout}
          className="w-full px-4 py-3 rounded-2xl bg-white border border-line text-danger font-extrabold hover:bg-danger/5 transition-colors"
        >
          退出登录
        </button>
      )}
    </div>
  );
}
