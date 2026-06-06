import { create } from 'zustand';
import type { User } from '@speak-coach/shared';

import { api } from '../api/client';
import { getGuestSessions, clearGuest, clearLocalSessions } from './history';

const KEY = 'speak-coach.auth';

interface Persisted {
  token: string;
  user: User;
}

function load(): Persisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

function persist(p: Persisted | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (p) window.localStorage.setItem(KEY, JSON.stringify(p));
    else window.localStorage.removeItem(KEY);
  } catch (e) {
    console.error('[auth.persist] failed:', e);
  }
}

/** 登录/注册成功后，把本地游客数据幂等合并到账号 */
async function mergeGuestInto(token: string): Promise<void> {
  const guest = getGuestSessions();
  if (guest.length === 0) return;
  try {
    await api.merge(token, guest);
    clearGuest();
  } catch (e) {
    console.warn('[auth] 合并游客数据失败（不阻断登录）:', e);
  }
}

interface AuthState {
  token: string | null;
  user: User | null;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const init = load();
  return {
    token: init?.token ?? null,
    user: init?.user ?? null,

    register: async (email, password, displayName) => {
      const r = await api.register({ email, password, displayName });
      await mergeGuestInto(r.token);
      persist({ token: r.token, user: r.user });
      set({ token: r.token, user: r.user });
    },

    login: async (email, password) => {
      const r = await api.login({ email, password });
      await mergeGuestInto(r.token);
      persist({ token: r.token, user: r.user });
      set({ token: r.token, user: r.user });
    },

    logout: () => {
      const u = get().user;
      if (u) clearLocalSessions(u.id); // 清当前用户本地缓存，防下一个使用者查看
      persist(null);
      set({ token: null, user: null });
    },
  };
});
