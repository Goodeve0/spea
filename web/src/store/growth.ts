/**
 * 成长数据协调层：根据登录态选择数据源。
 * - 登录：服务端为准，本地缓存兜底（离线/失败时）。
 * - 游客：纯本地命名空间。
 */
import type { Report, StoredSession } from '@speak-coach/shared';

import { api } from '../api/client';
import { useAuthStore } from './auth';
import {
  loadLocalSessions,
  saveLocalSession,
  replaceLocalSessions,
  computeStreak,
  computeTotalXp,
} from './history';

export interface Growth {
  streak: number;
  totalXp: number;
  sessions: StoredSession[];
}

/** 读取成长数据（streak / XP / 会话列表） */
export async function loadGrowth(): Promise<Growth> {
  const { token, user } = useAuthStore.getState();
  if (token) {
    try {
      const g = await api.growth(token);
      replaceLocalSessions(g.sessions, user?.id); // 同步本地缓存
      return { streak: g.streak, totalXp: g.totalXp, sessions: g.sessions };
    } catch (e) {
      console.warn('[growth] 拉取失败，使用本地缓存:', e);
      const sessions = loadLocalSessions(user?.id);
      return { streak: computeStreak(sessions), totalXp: computeTotalXp(sessions), sessions };
    }
  }
  const sessions = loadLocalSessions(undefined);
  return { streak: computeStreak(sessions), totalXp: computeTotalXp(sessions), sessions };
}

/** 记录一次会话（登录上报服务端 + 本地缓存；游客仅本地） */
export async function recordSession(session: StoredSession, report?: Report): Promise<void> {
  const { token, user } = useAuthStore.getState();
  // 本地缓存始终带上完整 report，以便回溯查看
  const localSession: StoredSession = { ...session, report };
  if (token) {
    saveLocalSession({ ...localSession, userId: user?.id }, user?.id);
    try {
      await api.submitSession(token, { session, report });
    } catch (e) {
      console.warn('[growth] 上报会话失败（已本地缓存）:', e);
    }
  } else {
    saveLocalSession(localSession, undefined);
  }
}
