import { create } from 'zustand';

import { DEFAULT_IFLYTEK_VOICE, IFLYTEK_VOICES } from '../audio/iflytek-voices';
import type { EngineId } from '../audio/tts-engine';

const STORAGE_KEY = 'speak-coach.settings';
// 已知与 .env 默认 AppId 不匹配的旧默认值（英文音色未在控制台领取，会触发 11119）
const KNOWN_UNAUTHORIZED_DEFAULTS = new Set(['x4_EnUs_Catherine']);

function isKnownVoice(id: string): boolean {
  return IFLYTEK_VOICES.some((v) => v.id === id);
}

export interface SettingsState {
  ttsEngine: EngineId;
  iflytekVoice: string;
  iflytekDisabled: boolean;
  iflytekLastError: string | null;

  setTtsEngine: (engine: EngineId) => void;
  setIflytekVoice: (voice: string) => void;
  setIflytekDisabled: (disabled: boolean) => void;
  setIflytekLastError: (msg: string | null) => void;
}

interface PersistedSettings {
  ttsEngine: EngineId;
  iflytekVoice: string;
}

const defaults = {
  ttsEngine: 'browser' as EngineId,
  iflytekVoice: DEFAULT_IFLYTEK_VOICE,
  iflytekDisabled: false,
};

function loadFromStorage(): PersistedSettings {
  if (typeof window === 'undefined') {
    return { ttsEngine: defaults.ttsEngine, iflytekVoice: defaults.iflytekVoice };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ttsEngine: defaults.ttsEngine, iflytekVoice: defaults.iflytekVoice };
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;

    let voice = typeof parsed.iflytekVoice === 'string' ? parsed.iflytekVoice : defaults.iflytekVoice;
    // 迁移：旧的未授权英文默认音色 / 不在当前列表里的音色 → 回退到默认
    if (KNOWN_UNAUTHORIZED_DEFAULTS.has(voice) || !isKnownVoice(voice)) {
      voice = defaults.iflytekVoice;
    }

    return {
      ttsEngine: parsed.ttsEngine === 'iflytek' || parsed.ttsEngine === 'browser' ? parsed.ttsEngine : defaults.ttsEngine,
      iflytekVoice: voice,
    };
  } catch (error) {
    console.error('[settings.loadFromStorage] failed:', error);
    return { ttsEngine: defaults.ttsEngine, iflytekVoice: defaults.iflytekVoice };
  }
}

function persistToStorage(state: PersistedSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[settings.persistToStorage] failed:', error);
  }
}

const initial = loadFromStorage();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ttsEngine: initial.ttsEngine,
  iflytekVoice: initial.iflytekVoice,
  iflytekDisabled: false,
  iflytekLastError: null,

  setTtsEngine: (engine) => {
    set({ ttsEngine: engine });
    const { iflytekVoice } = get();
    persistToStorage({ ttsEngine: engine, iflytekVoice });
  },

  setIflytekVoice: (voice) => {
    set({ iflytekVoice: voice, iflytekLastError: null });
    const { ttsEngine } = get();
    persistToStorage({ ttsEngine, iflytekVoice: voice });
  },

  setIflytekDisabled: (disabled) => {
    set({ iflytekDisabled: disabled });
  },

  setIflytekLastError: (msg) => {
    set({ iflytekLastError: msg });
  },
}));
