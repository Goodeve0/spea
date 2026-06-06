import { create } from 'zustand';

import { DEFAULT_IFLYTEK_VOICE, IFLYTEK_VOICES } from '../audio/iflytek-voices';
import type { EngineId } from '../audio/tts-engine';

const STORAGE_KEY = 'speak-coach.settings';
// 已知与 .env 默认 AppId 不匹配的旧默认值（英文音色未在控制台领取，会触发 11119）
const KNOWN_UNAUTHORIZED_DEFAULTS = new Set(['x4_EnUs_Catherine']);

/** 允许的 TTS 播放速度档位 */
export const PLAYBACK_SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEED_OPTIONS)[number];

function isKnownVoice(id: string): boolean {
  return IFLYTEK_VOICES.some((v) => v.id === id);
}

/** 校验并规范化播放速度，非法值回退到 1 */
export function normalizePlaybackSpeed(value: unknown): PlaybackSpeed {
  if (typeof value === 'number' && PLAYBACK_SPEED_OPTIONS.includes(value as PlaybackSpeed)) {
    return value as PlaybackSpeed;
  }
  return 1;
}

/** 允许的头像 key */
export const AVATAR_KEYS = ['melon', 'sprout', 'flower', 'sun', 'moon', 'rainbow', 'leaf', 'star'] as const;
export type AvatarKey = (typeof AVATAR_KEYS)[number];

export interface SettingsState {
  ttsEngine: EngineId;
  iflytekVoice: string;
  iflytekDisabled: boolean;
  iflytekLastError: string | null;
  playbackSpeed: PlaybackSpeed;
  avatarKey: AvatarKey;
  /** 是否开启对话中的卡壳提示气泡（初学者友好；默认关） */
  hintEnabled: boolean;
  /**
   * 登录用户上传的自定义头像（data URL / base64）。
   * 有值时优先于 avatarKey 显示；游客不允许设置（UI 层控制）。
   */
  customAvatarUrl: string | null;

  setTtsEngine: (engine: EngineId) => void;
  setIflytekVoice: (voice: string) => void;
  setIflytekDisabled: (disabled: boolean) => void;
  setIflytekLastError: (msg: string | null) => void;
  setPlaybackSpeed: (speed: number) => void;
  setAvatarKey: (key: AvatarKey) => void;
  setHintEnabled: (enabled: boolean) => void;
  setCustomAvatarUrl: (url: string | null) => void;
}

interface PersistedSettings {
  ttsEngine: EngineId;
  iflytekVoice: string;
  playbackSpeed: PlaybackSpeed;
  avatarKey: AvatarKey;
  hintEnabled: boolean;
  customAvatarUrl: string | null;
}

const defaults: PersistedSettings = {
  ttsEngine: 'browser',
  iflytekVoice: DEFAULT_IFLYTEK_VOICE,
  playbackSpeed: 1,
  avatarKey: 'melon',
  hintEnabled: false,
  customAvatarUrl: null,
};

function loadFromStorage(): PersistedSettings {
  if (typeof window === 'undefined') {
    return { ...defaults };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;

    let voice = typeof parsed.iflytekVoice === 'string' ? parsed.iflytekVoice : defaults.iflytekVoice;
    // 迁移：旧的未授权英文默认音色 / 不在当前列表里的音色 → 回退到默认
    if (KNOWN_UNAUTHORIZED_DEFAULTS.has(voice) || !isKnownVoice(voice)) {
      voice = defaults.iflytekVoice;
    }

    const avatarKeys = new Set<string>(AVATAR_KEYS);
    return {
      ttsEngine: parsed.ttsEngine === 'iflytek' || parsed.ttsEngine === 'browser' ? parsed.ttsEngine : defaults.ttsEngine,
      iflytekVoice: voice,
      playbackSpeed: normalizePlaybackSpeed(parsed.playbackSpeed),
      avatarKey: avatarKeys.has(parsed.avatarKey as string) ? (parsed.avatarKey as AvatarKey) : defaults.avatarKey,
      hintEnabled: typeof parsed.hintEnabled === 'boolean' ? parsed.hintEnabled : defaults.hintEnabled,
      customAvatarUrl: typeof parsed.customAvatarUrl === 'string' ? parsed.customAvatarUrl : null,
    };
  } catch (error) {
    console.error('[settings.loadFromStorage] failed:', error);
    return { ...defaults };
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

function pickPersisted(state: SettingsState): PersistedSettings {
  return {
    ttsEngine: state.ttsEngine,
    iflytekVoice: state.iflytekVoice,
    playbackSpeed: state.playbackSpeed,
    avatarKey: state.avatarKey,
    hintEnabled: state.hintEnabled,
    customAvatarUrl: state.customAvatarUrl,
  };
}

const initial = loadFromStorage();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ttsEngine: initial.ttsEngine,
  iflytekVoice: initial.iflytekVoice,
  iflytekDisabled: false,
  iflytekLastError: null,
  playbackSpeed: initial.playbackSpeed,
  avatarKey: initial.avatarKey,
  hintEnabled: initial.hintEnabled,
  customAvatarUrl: initial.customAvatarUrl,

  setTtsEngine: (engine) => {
    set({ ttsEngine: engine });
    persistToStorage(pickPersisted(get()));
  },

  setIflytekVoice: (voice) => {
    set({ iflytekVoice: voice, iflytekLastError: null });
    persistToStorage(pickPersisted(get()));
  },

  setIflytekDisabled: (disabled) => {
    set({ iflytekDisabled: disabled });
  },

  setIflytekLastError: (msg) => {
    set({ iflytekLastError: msg });
  },

  setPlaybackSpeed: (speed) => {
    const normalized = normalizePlaybackSpeed(speed);
    set({ playbackSpeed: normalized });
    persistToStorage(pickPersisted(get()));
  },

  setAvatarKey: (key) => {
    set({ avatarKey: key });
    persistToStorage(pickPersisted(get()));
  },

  setHintEnabled: (enabled) => {
    set({ hintEnabled: enabled });
    persistToStorage(pickPersisted(get()));
  },

  setCustomAvatarUrl: (url) => {
    set({ customAvatarUrl: url });
    persistToStorage(pickPersisted(get()));
  },
}));
