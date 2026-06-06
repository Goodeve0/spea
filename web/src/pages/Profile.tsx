import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StoredSession } from '@speak-coach/shared';

import Mascot from '../components/ui/Mascot';
import GardenHeatmap from '../components/GardenHeatmap';
import AvatarPicker from '../components/AvatarPicker';
import { UserAvatar } from '../components/user-avatar';
import { ProfileIcon, MelonIcon } from '../components/icons';
import { useAuthStore } from '../store/auth';
import { useSettingsStore } from '../store/settings';
import { loadGrowth } from '../store/growth';
import { levelInfo, levelStage } from '../lib/gamification';

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const avatarKey = useSettingsStore((s) => s.avatarKey);
  const customAvatarUrl = useSettingsStore((s) => s.customAvatarUrl);
  const [xp, setXp] = useState(0);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

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
      <h1 className="text-2xl font-extrabold text-ink mb-6 flex items-center gap-2">
        <ProfileIcon size={28} className="text-primary" /> 我的
      </h1>

      {/* 账号 / 登录引导 */}
      {user ? (
        <section className="bg-white rounded-3xl border border-line shadow-card p-6 flex items-center gap-4 mb-6">
          <button
            onClick={() => setPickerOpen(true)}
            className="relative flex-shrink-0 group"
            title="点击换头像"
          >
            <UserAvatar avatarKey={avatarKey} size={64} customAvatarUrl={customAvatarUrl} />
            <span className="absolute inset-0 rounded-full bg-ink/0 group-hover:bg-ink/20 transition-colors flex items-center justify-center">
              <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </span>
          </button>
          <div className="min-w-0">
            <div className="text-lg font-extrabold text-ink truncate">{user.displayName}</div>
            <div className="text-sm text-sub truncate">{user.email}</div>
            <button onClick={() => setPickerOpen(true)} className="text-xs text-primary font-bold mt-1 hover:underline">换头像</button>
          </div>
        </section>
      ) : (
        <section className="bg-white rounded-3xl border border-line shadow-card p-6 text-center mb-6">
          <button onClick={() => setPickerOpen(true)} className="mx-auto mb-3 block relative group" title="点击换头像">
            <UserAvatar avatarKey={avatarKey} size={72} customAvatarUrl={customAvatarUrl} />
            <span className="absolute inset-0 rounded-full bg-ink/0 group-hover:bg-ink/20 transition-colors flex items-center justify-center">
              <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </span>
          </button>
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

      <AvatarPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      {/* 瓜级卡 */}
      <section className="bg-white rounded-3xl border border-line shadow-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <MelonIcon size={28} />
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
        <h2 className="font-extrabold text-ink mb-3 flex items-center gap-2"><MelonIcon size={22} /> 我的瓜田</h2>
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
