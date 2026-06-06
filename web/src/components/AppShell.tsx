import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Mascot from './ui/Mascot';
import LevelBar from './ui/LevelBar';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';
import { loadGrowth } from '../store/growth';
import { useAuthStore } from '../store/auth';

/**
 * 应用导航壳层（响应式）：
 * - 桌面：左侧固定 Sidebar + 右侧内容区
 * - 移动：顶部精简状态栏 + 底部 BottomTabBar
 * 通过 <Outlet/> 渲染子路由内容。沉浸式页面（登录/对话/报告）不套此壳。
 */
export default function AppShell() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);

  // 切换 Tab / 用户变化时刷新顶部状态，保证练习后数据新鲜
  useEffect(() => {
    let alive = true;
    loadGrowth().then((g) => {
      if (!alive) return;
      setStreak(g.streak);
      setXp(g.totalXp);
    });
    return () => {
      alive = false;
    };
  }, [user, location.pathname]);

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <Sidebar xp={xp} streak={streak} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* 移动端顶部状态栏 */}
        <header className="md:hidden sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-line">
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold text-ink">
              <Mascot size={34} />
              <span className="text-lg">Speak Coach</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <LevelBar totalXp={xp} compact />
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-accent-dark" title="连续练习天数">
                🔥 {streak}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-24 md:pb-0">
          <Outlet />
        </main>
      </div>

      <BottomTabBar />
    </div>
  );
}
