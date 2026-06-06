/**
 * 瓜友状态：匹配 / 邀请 / 关系 / 贴纸 / 排行 + profile 同步。
 * 仅登录用户可用；token 取自 auth store。
 */
import { create } from 'zustand';
import type {
  BuddyCard,
  BuddyRelation,
  BuddyRequestDTO,
  EncouragementDTO,
  RankingEntry,
  StickerKey,
} from '@speak-coach/shared';

import { api } from '../api/client';
import { useAuthStore } from './auth';
import { useSettingsStore } from './settings';

function token(): string | null {
  return useAuthStore.getState().token;
}

interface BuddyState {
  matches: BuddyCard[];
  requests: BuddyRequestDTO[];
  buddies: BuddyRelation[];
  encouragements: EncouragementDTO[];
  ranking: RankingEntry[];
  loading: boolean;
  error: string | null;

  loadMatches: (filters?: { scenario?: string; slot?: string; lang?: string }) => Promise<void>;
  loadRequests: () => Promise<void>;
  loadBuddies: () => Promise<void>;
  loadRanking: () => Promise<void>;
  loadEncouragements: () => Promise<void>;
  loadAll: () => Promise<void>;
  invite: (toUserId: string) => Promise<void>;
  accept: (requestId: string) => Promise<void>;
  decline: (requestId: string) => Promise<void>;
  removeBuddy: (buddyId: string) => Promise<void>;
  sendSticker: (toUserId: string, key: StickerKey) => Promise<void>;
  sendRoomInvite: (toUserId: string, roomId: string) => Promise<void>;
  syncProfile: () => Promise<void>;
}

export const useBuddyStore = create<BuddyState>((set, get) => ({
  matches: [],
  requests: [],
  buddies: [],
  encouragements: [],
  ranking: [],
  loading: false,
  error: null,

  loadMatches: async (filters = {}) => {
    const t = token();
    if (!t) return;
    set({ loading: true, error: null });
    try {
      const { candidates } = await api.buddy.matches(t, filters);
      set({ matches: candidates });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadRequests: async () => {
    const t = token();
    if (!t) return;
    try {
      const { requests } = await api.buddy.requests(t);
      set({ requests });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    }
  },

  loadBuddies: async () => {
    const t = token();
    if (!t) return;
    try {
      const { buddies } = await api.buddy.list(t);
      set({ buddies });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    }
  },

  loadRanking: async () => {
    const t = token();
    if (!t) return;
    try {
      const { ranking } = await api.buddy.ranking(t);
      set({ ranking });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    }
  },

  loadEncouragements: async () => {
    const t = token();
    if (!t) return;
    try {
      const { encouragements } = await api.buddy.encouragements(t);
      set({ encouragements });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    }
  },

  loadAll: async () => {
    await get().syncProfile();
    await Promise.all([
      get().loadMatches(),
      get().loadRequests(),
      get().loadBuddies(),
      get().loadRanking(),
    ]);
  },

  invite: async (toUserId) => {
    const t = token();
    if (!t) return;
    await api.buddy.sendRequest(t, toUserId);
    // 邀请后从匹配列表移除该候选
    set({ matches: get().matches.filter((c) => c.userId !== toUserId) });
  },

  accept: async (requestId) => {
    const t = token();
    if (!t) return;
    await api.buddy.accept(t, requestId);
    await Promise.all([get().loadRequests(), get().loadBuddies(), get().loadRanking()]);
  },

  decline: async (requestId) => {
    const t = token();
    if (!t) return;
    await api.buddy.decline(t, requestId);
    await get().loadRequests();
  },

  removeBuddy: async (buddyId) => {
    const t = token();
    if (!t) return;
    await api.buddy.remove(t, buddyId);
    await Promise.all([get().loadBuddies(), get().loadRanking()]);
  },

  sendSticker: async (toUserId, key) => {
    const t = token();
    if (!t) return;
    await api.buddy.sendEncouragement(t, toUserId, key);
    await get().loadBuddies();
  },

  sendRoomInvite: async (toUserId, roomId) => {
    const t = token();
    if (!t) return;
    await api.buddy.sendRoomInvite(t, toUserId, roomId);
  },

  syncProfile: async () => {
    const t = token();
    if (!t) return;
    const { avatarKey } = useSettingsStore.getState();
    try {
      await api.buddy.updateProfile(t, { avatarKey });
    } catch {
      // 同步失败不阻断
    }
  },
}));
