/** 全局主导航配置（桌面 Sidebar 与移动 BottomTabBar 共享） */
export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** 是否精确匹配（'/' 需要，否则会匹配所有子路由） */
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '练习', icon: '🎤', end: true },
  { to: '/progress', label: '成长', icon: '📈' },
  { to: '/achievements', label: '成就', icon: '🏅' },
  { to: '/profile', label: '我的', icon: '👤' },
];
