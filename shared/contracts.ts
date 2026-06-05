// ============================================================
// shared/contracts.ts — 前后端共享的唯一类型契约
// 引用：specs/02-SDD.md 第 3、4 节
// 规则：前后端一律从此文件 import，不得重复定义
// ============================================================

// -------------------- 场景 --------------------

/** 难度等级 */
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

/** 练习场景 */
export interface Scenario {
  id: string;                    // 'interview' | 'restaurant' | 'meeting'
  title: string;
  description: string;
  difficulty: Difficulty;
  rolePrompt: string;            // AI 扮演角色的 system prompt
  goal: string;                  // 本场景对话目标
}

// -------------------- 会话 --------------------

/** 一次完整练习会话 */
export interface Session {
  id: string;
  scenarioId: string;
  difficulty: Difficulty;
  startedAt: number;             // epoch ms
  endedAt?: number;
  overallScore?: number;         // 0-100
}

// -------------------- 对话轮次 --------------------

/** 对话轮次 */
export interface Turn {
  id: string;
  sessionId: string;
  role: 'user' | 'ai';
  text: string;
  audioUrl?: string;
  timestamp: number;
}

// -------------------- 发音评测 --------------------

/** 单词评分 */
export interface WordScore {
  word: string;
  score: number;                 // 0-100
  error?: string;
}

/** 发音评测结果（对应 user turn） */
export interface PronunciationResult {
  turnId: string;
  accuracy: number;              // 0-100
  fluency: number;
  completeness: number;
  prosody: number;
  wordScores: WordScore[];
}

// -------------------- 纠错 --------------------

/** 错误严重程度 */
export type ErrorSeverity = 'blocking' | 'major' | 'minor';

/** 纠错结果 */
export interface Correction {
  turnId: string;
  original: string;
  corrected: string;
  errorType: string;             // 'grammar' | 'word_choice' | 'expression'
  severity: ErrorSeverity;
  explanation: string;
  betterExpression?: string;     // 地道升级
}

// -------------------- 课后报告 --------------------

/** 雷达图五维分数 */
export interface RadarScores {
  pronunciation: number;         // 0-100
  fluency: number;
  grammar: number;
  vocabulary: number;
  taskCompletion: number;
}

/** 高频错误条目 */
export interface TopError {
  errorType: string;
  count: number;
  example: string;
}

/** 表达升级条目 */
export interface ExpressionUpgrade {
  from: string;
  to: string;
}

/** 课后报告 */
export interface Report {
  sessionId: string;
  radar: RadarScores;
  topErrors: TopError[];
  expressionUpgrades: ExpressionUpgrade[];
  summaryText: string;
  annotatedTurns: Array<Turn & { corrections: Correction[] }>;
}

// -------------------- WebSocket 消息契约 --------------------

/** 消息信封格式 */
export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}

// 客户端 → 服务端 消息类型
export type ClientMessageType =
  | 'session.start'
  | 'audio.chunk'
  | 'audio.end'
  | 'session.end'
  | 'tts.request';

// 服务端 → 客户端 消息类型
export type ServerMessageType =
  | 'session.started'
  | 'asr.partial'
  | 'asr.final'
  | 'ai.text'
  | 'ai.audio'
  | 'ai.done'
  | 'report.ready'
  | 'tts.audio'
  | 'tts.done'
  | 'tts.error'
  | 'error';

// 各消息的 payload 类型
export namespace ClientPayload {
  export interface SessionStart {
    scenarioId: string;
    difficulty: Difficulty;
  }
  export interface AudioChunk {
    seq: number;
    // data 在实际传输中为 ArrayBuffer，此处用 number[] 方便序列化
  }
  export type AudioEnd = Record<string, never>;
  export type SessionEnd = Record<string, never>;
  export interface TtsRequest {
    requestId: string;
    text: string;
    voice?: string;
  }
}

export namespace ServerPayload {
  export interface SessionStarted {
    sessionId: string;
    greeting: string;
  }
  export interface AsrPartial {
    text: string;
  }
  export interface AsrFinal {
    turnId: string;
    text: string;
  }
  export interface AiText {
    turnId: string;
    deltaText: string;
  }
  export interface AiAudio {
    turnId: string;
    seq: number;
  }
  export interface AiDone {
    turnId: string;
  }
  export interface ReportReady {
    report: Report;
  }
  export interface ErrorPayload {
    code: ErrorCode;
    message: string;
  }
  export interface TtsAudio {
    requestId: string;
    seq: number;
    audio: string; // base64 编码的 PCM 16kHz/16bit/mono
  }
  export interface TtsDone {
    requestId: string;
  }
  export interface TtsError {
    requestId: string;
    code: ErrorCode;
    message: string;
  }
}

// -------------------- 错误码 --------------------

export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  ASR_FAILED = 'ASR_FAILED',
  LLM_FAILED = 'LLM_FAILED',
  TTS_FAILED = 'TTS_FAILED',
  PRONUNCIATION_FAILED = 'PRONUNCIATION_FAILED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
}

// -------------------- 预设场景数据 --------------------

export const PRESET_SCENARIOS: Scenario[] = [
  {
    id: 'interview',
    title: 'Job Interview',
    description: 'Practice for English job interviews. The AI will act as a hiring manager.',
    difficulty: 'intermediate',
    rolePrompt:
      'You are a professional hiring manager conducting a job interview. Be polite but thorough. Ask follow-up questions. Keep the conversation focused on the candidate\'s experience and qualifications. Use moderate-paced, professional English.',
    goal: 'Successfully answer interview questions and demonstrate your qualifications.',
  },
  {
    id: 'restaurant',
    title: 'Restaurant Ordering',
    description: 'Practice ordering food at an English-speaking restaurant. The AI will act as a server.',
    difficulty: 'beginner',
    rolePrompt:
      'You are a friendly server at a casual restaurant. Greet the customer warmly, present the menu, help with recommendations, and take their order. Use simple, everyday English with a warm tone.',
    goal: 'Order a complete meal and handle any questions from the server.',
  },
  {
    id: 'meeting',
    title: 'Team Meeting',
    description: 'Practice participating in an English team meeting. The AI will act as your colleague.',
    difficulty: 'advanced',
    rolePrompt:
      'You are a senior colleague leading a team meeting. Discuss project updates, ask for opinions, and encourage participation. Use professional but conversational English. Introduce business vocabulary naturally.',
    goal: 'Actively participate in the meeting and contribute your ideas.',
  },
];
