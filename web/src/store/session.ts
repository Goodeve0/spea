import { create } from 'zustand';
import type { Turn, Report, Difficulty } from '@speak-coach/shared';

/** 会话状态 */
interface SessionState {
  sessionId: string | null;
  scenarioId: string | null;
  difficulty: Difficulty;
  turns: Turn[];
  isRecording: boolean;
  isAiSpeaking: boolean;
  currentAiText: string;
  report: Report | null;
  connected: boolean;
  /** 当前正在朗读的消息 ID（null 表示无朗读） */
  readingTurnId: string | null;

  // Actions
  setSession: (id: string, scenarioId: string, difficulty: Difficulty) => void;
  addTurn: (turn: Turn) => void;
  setRecording: (v: boolean) => void;
  setAiSpeaking: (v: boolean) => void;
  appendAiText: (delta: string) => void;
  resetAiText: () => void;
  setReport: (report: Report) => void;
  setConnected: (v: boolean) => void;
  setReadingTurnId: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  scenarioId: null,
  difficulty: 'intermediate' as Difficulty,
  turns: [],
  isRecording: false,
  isAiSpeaking: false,
  currentAiText: '',
  report: null,
  connected: false,
  readingTurnId: null,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSession: (id, scenarioId, difficulty) =>
    set({ sessionId: id, scenarioId, difficulty }),

  addTurn: (turn) =>
    set((state) => ({ turns: [...state.turns, turn] })),

  setRecording: (v) => set({ isRecording: v }),

  setAiSpeaking: (v) => set({ isAiSpeaking: v }),

  appendAiText: (delta) =>
    set((state) => ({ currentAiText: state.currentAiText + delta })),

  resetAiText: () => set({ currentAiText: '' }),

  setReport: (report) => set({ report }),

  setConnected: (v) => set({ connected: v }),

  setReadingTurnId: (id) => set({ readingTurnId: id }),

  reset: () => set(initialState),
}));
