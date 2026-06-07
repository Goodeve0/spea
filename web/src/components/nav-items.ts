import type { FC } from 'react';

import {
  PracticeIcon,
  GrowthIcon,
  AchievementIcon,
  ProfileIcon,
  BuddyIcon,
  NoteIcon,
  type IconProps,
} from './icons';

/** 全局主导航配置（桌面 Sidebar 与移动 BottomTabBar 共享） */
export interface NavItem {
  to: string;
  label: string;
  /** 自绘哈密瓜主题图标组件 */
  Icon: FC<IconProps>;
  /** 是否精确匹配（'/' 需要，否则会匹配所有子路由） */
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '练习', Icon: PracticeIcon, end: true },
  { to: '/vocab', label: '生词本', Icon: NoteIcon },
  { to: '/progress', label: '成长', Icon: GrowthIcon },
  { to: '/buddies', label: '瓜友', Icon: BuddyIcon },
  { to: '/achievements', label: '成就', Icon: AchievementIcon },
  { to: '/profile', label: '我的', Icon: ProfileIcon },
];
