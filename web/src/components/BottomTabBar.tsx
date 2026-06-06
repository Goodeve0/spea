import { NavLink } from 'react-router-dom';

import { NAV_ITEMS } from './nav-items';

/** 移动端底部 Tab 栏（md 以下显示）。 */
export default function BottomTabBar() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-bold transition-colors ${
                isActive ? 'text-primary-dark' : 'text-sub'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
