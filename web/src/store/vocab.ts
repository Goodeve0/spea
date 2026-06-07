/**
 * 生词本：用户在对话中点击单词后收藏的词，持久化到 localStorage（按用户命名空间）。
 */
import { create } from 'zustand';

import { useAuthStore } from './auth';

export interface VocabWord {
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  example: string;
  addedAt: number;
  /** 收藏时所在场景（可选，便于回顾语境） */
  scenarioId?: string;
}

const PREFIX = 'speak-coach.vocab';

function nsKey(userId?: string): string {
  return `${PREFIX}.${userId ?? 'guest'}`;
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

function load(userId?: string): VocabWord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(nsKey(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as VocabWord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persist(words: VocabWord[], userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(nsKey(userId), JSON.stringify(words));
  } catch {
    /* ignore */
  }
}

interface VocabState {
  words: VocabWord[];
  /** 重新从当前用户命名空间加载 */
  reload: () => void;
  add: (w: VocabWord) => void;
  remove: (word: string) => void;
  has: (word: string) => boolean;
}

export const useVocabStore = create<VocabState>((set, get) => ({
  words: load(currentUserId()),

  reload: () => set({ words: load(currentUserId()) }),

  add: (w) => {
    const key = w.word.toLowerCase();
    const exists = get().words.some((x) => x.word.toLowerCase() === key);
    if (exists) return;
    const next = [{ ...w, addedAt: w.addedAt || Date.now() }, ...get().words];
    persist(next, currentUserId());
    set({ words: next });
  },

  remove: (word) => {
    const key = word.toLowerCase();
    const next = get().words.filter((x) => x.word.toLowerCase() !== key);
    persist(next, currentUserId());
    set({ words: next });
  },

  has: (word) => {
    const key = word.toLowerCase();
    return get().words.some((x) => x.word.toLowerCase() === key);
  },
}));
