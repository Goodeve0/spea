/**
 * 瓜友状态：匹配 / 邀请 / 关系 / 贴纸 / 排行 + profile 同步 + 全局通知。
 * 仅登录用户可用；token 取自 auth store。
 */
import { create } from 'zustand';
import type {
  BuddyCard,
  BuddyRelation,
  BuddyRequestDTO,
  EncouragementDTO,
  RankingEntry,
  RoomInviteDTO,
  StickerKey,
} from '@speak-coach/shared';

import { ApiError, api } from '../api/client';
import { useAuthStore } from './auth';
import { useSettingsStore } from './settings';

function token(): string | null {
  return useAuthStore.getState().token;
}

export interface BuddyToastItem {
  id: string;
  message: string;
}

interface BuddyState {
  matches: BuddyCard[];
  requests: BuddyRequestDTO[];
  buddies: BuddyRelation[];
  encouragements: EncouragementDTO[];
  ranking: RankingEntry[];
  pendingRoomInvites: RoomInviteDTO[];
  /** 本次会话内已被用户主动 dismiss 的 roomId；服务端短窗口内仍可能再次返回，前端按此屏蔽，防止横幅重弹 */
  dismissedRoomIds: Set<string>;
  toasts: BuddyToastItem[];
  /** 本次会话内已发出邀请的用户 id（用于在发现列表上显示"已邀请·待接受"） */
  invitedIds: string[];
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
  sendSticker: (toUserId: string, key: StickerKey, displayName?: string) => Promise<void>;
  sendRoomInvite: (toUserId: string, roomId: string) => Promise<void>;
  syncProfile: () => Promise<void>;
  mergeRoomInvites: (incoming: RoomInviteDTO[]) => void;
  dismissRoomInvite: (roomId: string) => void;
  showToast: (message: string) => void;
  removeToast: (id: string) => void;
  resetInbox: () => void;
}

/** 按 roomId 合并邀请（后者覆盖） */
export function mergeRoomInviteList(
  existing: RoomInviteDTO[],
  incoming: RoomInviteDTO[],
): RoomInviteDTO[] {
  if (incoming.length === 0) return existing;
  const map = new Map(existing.map((i) => [i.roomId, i]));
  for (const inv of incoming) {
    map.set(inv.roomId, inv);
  }
  return [...map.values()];
}

export const useBuddyStore = create<BuddyState>((set, get) => ({
  matches: [],
  requests: [],
  buddies: [],
  encouragements: [],
  ranking: [],
  pendingRoomInvites: [],
  dismissedRoomIds: new Set<string>(),
  toasts: [],
  invitedIds: [],
  loading: false,
  error: null,

  loadMatches: async (filters = {}) => {
    const t = token();
    if (!t) return;
    set({ loading: true, error: null });
    try {
      const { candidates } = await api.buddy.matches(t, filters);
      set({ matches: candidates, invitedIds: [] });
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
    if (!get().invitedIds.includes(toUserId)) {
      set({ invitedIds: [...get().invitedIds, toUserId] });
    }
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

  sendSticker: async (toUserId, key, displayName) => {
    const t = token();
    if (!t) return;
    const name =
      displayName ??
      get().buddies.find((b) => b.card.userId === toUserId)?.card.displayName ??
      '瓜友';
    try {
      await api.buddy.sendEncouragement(t, toUserId, key);
      await get().loadBuddies();
      get().showToast(`已发送给 ${name}`);
    } catch {
      get().showToast('发送失败，请重试');
      throw new Error('send sticker failed');
    }
  },

  sendRoomInvite: async (toUserId, roomId) => {
    const t = token();
    if (!t) return;
    try {
      await api.buddy.sendRoomInvite(t, toUserId, roomId);
    } catch (error) {
      console.error('[buddy.sendRoomInvite] failed:', { roomId, toUserId }, error);
      const message =
        error instanceof ApiError && error.message
          ? `邀请发送失败：${error.message}`
          : '邀请发送失败，请重试';
      get().showToast(message);
      throw error instanceof Error ? error : new Error('send room invite failed');
    }
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

  mergeRoomInvites: (incoming) => {
    set((s) => {
      const filtered = incoming.filter((i) => !s.dismissedRoomIds.has(i.roomId));
      if (filtered.length === 0) return {};
      return { pendingRoomInvites: mergeRoomInviteList(s.pendingRoomInvites, filtered) };
    });
  },

  dismissRoomInvite: (roomId) => {
    set((s) => ({
      pendingRoomInvites: s.pendingRoomInvites.filter((i) => i.roomId !== roomId),
      dismissedRoomIds: new Set([...s.dismissedRoomIds, roomId]),
    }));
  },

  showToast: (message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({
      toasts: [...s.toasts, { id, message }].slice(-3),
    }));
  },

  removeToast: (id) => {
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    }));
  },

  resetInbox: () => {
    set({ pendingRoomInvites: [], dismissedRoomIds: new Set<string>(), toasts: [] });
  },
}));
