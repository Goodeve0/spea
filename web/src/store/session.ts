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

  // Actions
  setSession: (id: string, scenarioId: string, difficulty: Difficulty) => void;
  addTurn: (turn: Turn) => void;
  setRecording: (v: boolean) => void;
  setAiSpeaking: (v: boolean) => void;
  appendAiText: (delta: string) => void;
  resetAiText: () => void;
  setReport: (report: Report) => void;
  setConnected: (v: boolean) => void;
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

  reset: () => set(initialState),
}));
