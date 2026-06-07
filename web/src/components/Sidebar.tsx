import { NavLink, useNavigate } from 'react-router-dom';

import Mascot from './ui/Mascot';
import LevelBar from './ui/LevelBar';
import { MelonIcon } from './icons';
import { UserAvatar } from './user-avatar';
import { NAV_ITEMS } from './nav-items';
import { useAuthStore } from '../store/auth';
import { useSettingsStore } from '../store/settings';

/** 桌面端固定侧边栏（md 及以上显示）。 */
export default function Sidebar({ xp, streak }: { xp: number; streak: number }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const avatarKey = useSettingsStore((s) => s.avatarKey);
  const customAvatarUrl = useSettingsStore((s) => s.customAvatarUrl);

  return (
    <aside className="hidden md:flex md:flex-col md:w-60 md:flex-shrink-0 md:sticky md:top-0 md:h-screen bg-white border-r border-line">
      {/* Logo（点击进主页） */}
      <NavLink
        to="/"
        className="px-4 h-16 flex items-center gap-2 font-extrabold text-ink border-b border-line hover:bg-canvas transition-colors"
        title="返回主页"
      >
        <Mascot size={40} />
        <span className="text-lg leading-none">英语口语<br />顶呱呱</span>
      </NavLink>

      {/* 导航 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                isActive ? 'bg-primary-light text-primary-dark' : 'text-sub hover:bg-canvas hover:text-ink'
              }`
            }
          >
            <item.Icon size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* 状态 + 用户卡 */}
      <div className="px-3 pb-4 space-y-3">
        <div className="px-4 py-3 rounded-2xl bg-canvas flex items-center justify-between text-sm font-bold">
          <LevelBar totalXp={xp} />
          <span className="flex items-center gap-1 text-accent-dark" title="连续练习天数">
            <MelonIcon size={18} /> {streak}
          </span>
        </div>
        {user ? (
          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-canvas transition-colors"
          >
            <UserAvatar avatarKey={avatarKey} size={36} customAvatarUrl={customAvatarUrl} />
            <span className="text-ink font-bold truncate text-left">{user.displayName}</span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="w-full px-4 py-3 rounded-2xl bg-primary text-white font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all"
          >
            登录 / 注册
          </button>
        )}
      </div>
    </aside>
  );
}
