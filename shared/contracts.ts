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
  id: string;                    // 'interview' | 'restaurant' | ... | 'custom'
  title: string;
  description: string;
  difficulty: Difficulty;
  rolePrompt: string;            // AI 扮演角色的 system prompt
  goal: string;                  // 本场景对话目标
  category?: string;             // 分类（career/life/travel/social/exam），可选以兼容旧数据
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
  why: string;                   // 为什么更地道（口语化中文）
}

/** 隐性重述记录："你说的" → "我帮你顺的" */
export interface Recast {
  turnId: string;
  original: string;
  recast: string;
}

/** 课后报告 */
export interface Report {
  sessionId: string;
  radar: RadarScores;
  topErrors: TopError[];
  expressionUpgrades: ExpressionUpgrade[];
  recasts: Recast[];             // 隐性重述回放
  summaryText: string;
  annotatedTurns: Array<Turn & { corrections: Correction[] }>;
  cefrEstimate?: string;         // 近似 CEFR 等级（如 "B1"），UI 标注"估算"
  hasUserSpeech?: boolean;       // 本次是否有用户发言（无则不计入成长）
}

/** 持久化的会话记录（成长曲线数据源） */
export interface StoredSession {
  id: string;
  timestamp: number;
  scenarioId: string;
  difficulty: Difficulty;
  radar: RadarScores;
  overallScore: number;
  cefrEstimate?: string;
  userId?: string;               // 归属用户（服务端隔离用；游客为空）
}

// -------------------- 账号与鉴权 --------------------

/** 用户公开信息（不含敏感字段） */
export interface User {
  id: string;
  displayName: string;
  email?: string;
}

/** 登录/注册成功结果 */
export interface AuthResult {
  token: string;
  user: User;
}

/** HTTP API 的请求/响应 DTO */
export namespace Api {
  export interface RegisterReq { email: string; password: string; displayName?: string; }
  export interface LoginReq { email: string; password: string; }
  export interface MergeGuestReq { sessions: StoredSession[]; }
  export interface SubmitSessionReq { session: StoredSession; report?: Report; }
  export interface GrowthResp { streak: number; totalXp: number; sessions: StoredSession[]; }
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

/** 场景分类元数据 */
export const SCENARIO_CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: 'career', label: '职场', emoji: '💼' },
  { id: 'life', label: '生活', emoji: '🏠' },
  { id: 'travel', label: '出行', emoji: '✈️' },
  { id: 'social', label: '社交', emoji: '💬' },
  { id: 'exam', label: '考试', emoji: '📝' },
];

export const PRESET_SCENARIOS: Scenario[] = [
  {
    id: 'interview',
    category: 'career',
    title: 'Job Interview',
    description: 'Practice for English job interviews. The AI will act as a hiring manager.',
    difficulty: 'intermediate',
    rolePrompt:
      'You are a professional hiring manager conducting a job interview. Be polite but thorough. Ask follow-up questions. Keep the conversation focused on the candidate\'s experience and qualifications. Use moderate-paced, professional English.',
    goal: 'Successfully answer interview questions and demonstrate your qualifications.',
  },
  {
    id: 'meeting',
    category: 'career',
    title: 'Team Meeting',
    description: 'Practice participating in an English team meeting. The AI will act as your colleague.',
    difficulty: 'advanced',
    rolePrompt:
      'You are a senior colleague leading a team meeting. Discuss project updates, ask for opinions, and encourage participation. Use professional but conversational English. Introduce business vocabulary naturally.',
    goal: 'Actively participate in the meeting and contribute your ideas.',
  },
  {
    id: 'presentation',
    category: 'career',
    title: 'Give a Presentation',
    description: 'Rehearse presenting an idea and handling questions from the audience.',
    difficulty: 'advanced',
    rolePrompt:
      'You are an audience member at a work presentation. Let the learner present their idea, then ask 1-2 clarifying or challenging questions at a time. Be professional and encouraging, and keep your turns short.',
    goal: 'Clearly present your idea and confidently answer audience questions.',
  },
  {
    id: 'restaurant',
    category: 'life',
    title: 'Restaurant Ordering',
    description: 'Practice ordering food at an English-speaking restaurant. The AI will act as a server.',
    difficulty: 'beginner',
    rolePrompt:
      'You are a friendly server at a casual restaurant. Greet the customer warmly, present the menu, help with recommendations, and take their order. Use simple, everyday English with a warm tone.',
    goal: 'Order a complete meal and handle any questions from the server.',
  },
  {
    id: 'doctor',
    category: 'life',
    title: "Doctor's Visit",
    description: 'Describe your symptoms and understand a doctor at a clinic.',
    difficulty: 'intermediate',
    rolePrompt:
      'You are a kind family doctor. Ask the patient about their symptoms, how long they have had them, and give simple advice. Use clear, reassuring everyday English and ask one question at a time.',
    goal: "Explain your symptoms and understand the doctor's advice.",
  },
  {
    id: 'shopping',
    category: 'life',
    title: 'Shopping & Returns',
    description: 'Buy something, ask about sizes/prices, or return an item.',
    difficulty: 'beginner',
    rolePrompt:
      'You are a helpful shop assistant. Help the customer find what they need, answer questions about price, size and color, and handle returns or exchanges politely. Use simple, friendly English.',
    goal: 'Complete a purchase or a return successfully.',
  },
  {
    id: 'hotel',
    category: 'travel',
    title: 'Hotel Check-in',
    description: 'Check in at a hotel, ask about facilities and handle requests.',
    difficulty: 'beginner',
    rolePrompt:
      'You are a polite hotel front-desk receptionist. Help the guest check in, confirm their booking, explain breakfast and wifi, and handle simple requests. Use clear, courteous English.',
    goal: 'Check in successfully and get the information you need.',
  },
  {
    id: 'smalltalk',
    category: 'social',
    title: 'Making Small Talk',
    description: 'Break the ice and keep a casual conversation going at a social event.',
    difficulty: 'intermediate',
    rolePrompt:
      'You are a friendly stranger at a casual social event (party / networking). Make natural small talk, share a little about yourself, and ask the learner light, open questions. Keep it warm, casual and flowing.',
    goal: 'Start and maintain a natural casual conversation.',
  },
  {
    id: 'ielts',
    category: 'exam',
    title: 'IELTS Speaking Mock',
    description: 'Simulate IELTS Speaking Part 1-2 with an examiner.',
    difficulty: 'advanced',
    rolePrompt:
      'You are an IELTS speaking examiner. Conduct a calm, formal mock: ask Part 1 personal questions, then give a Part 2 cue card topic and let the learner speak. Stay neutral and professional; ask one prompt at a time.',
    goal: 'Respond fluently and at length like in a real IELTS speaking test.',
  },
];

/** 根据用户输入的主题，生成一个可对话的自由话题场景 */
export function buildFreeTopicScenario(topic: string, difficulty: Difficulty): Scenario {
  const t = topic.trim();
  return {
    id: 'custom',
    category: 'social',
    title: t ? t.slice(0, 24) : 'Free Talk',
    description: t ? `自由话题：${t}` : '自由闲聊，想到什么聊什么',
    difficulty,
    rolePrompt:
      'You are a warm, curious native English conversation partner. ' +
      'Have a natural spoken conversation with the learner' +
      (t ? ` about: "${t}".` : ' about anything they want to talk about.') +
      ' Ask engaging follow-up questions, keep your replies short and natural, and gently keep the conversation going. Always stay encouraging.',
    goal: t ? `Have a natural conversation about ${t}.` : 'Have a relaxed free conversation.',
  };
}
