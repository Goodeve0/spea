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
  category?: ScenarioCategoryId; // 用于场景分类展示
}

/** 场景分类 ID（与 SCENARIO_CATEGORIES 一一对应） */
export type ScenarioCategoryId = 'career' | 'life' | 'travel' | 'social' | 'exam';

/** 场景分类元信息 */
export interface ScenarioCategory {
  id: ScenarioCategoryId;
  label: string;
  emoji: string;
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
  /** 口语化中文解释为什么这样说更地道（可选） */
  why?: string;
}

/** 隐性重述条目：把学生说的原句改写为更自然的英文 */
export interface Recast {
  turnId?: string;
  original: string;
  recast: string;
}

/** 课后报告 */
export interface Report {
  sessionId: string;
  radar: RadarScores;
  topErrors: TopError[];
  expressionUpgrades: ExpressionUpgrade[];
  /** 隐性重述回放（学生可能没注意到的口误改写） */
  recasts: Recast[];
  summaryText: string;
  annotatedTurns: Array<Turn & { corrections: Correction[] }>;
  /** CEFR 等级估算：A1/A2/B1/B2/C1/C2 */
  cefrEstimate?: string;
  /** 本次是否有用户发言（无则不计入成长曲线） */
  hasUserSpeech?: boolean;
  /**
   * 发音分数据来源：
   * - 'acoustic'：讯飞 ISE 真实声学评测（可信）
   * - 'none'：本次无录音（文字模式/不支持），发音维度未评测，不计入综合分
   */
  pronunciationSource?: 'acoustic' | 'none';
  /** 声学评测逐词分数（仅 acoustic 时有值，按分数升序，供展示薄弱词） */
  pronunciationWordScores?: Array<{ word: string; score: number }>;
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
  | 'tts.request'
  // 瓜友实时练习房间（双排协作）
  | 'room.create'
  | 'room.join'
  | 'room.utterance'
  | 'room.leave'
  | 'room.end';

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
  | 'error'
  // 瓜友实时练习房间
  | 'room.created'
  | 'room.joined'
  | 'room.peer.joined'
  | 'room.ready'
  | 'room.turn'
  | 'room.peer.utterance'
  | 'room.ai.text'
  | 'room.ai.done'
  | 'room.peer.left'
  | 'room.ended'
  | 'room.error';

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
  // 瓜友房间
  export interface RoomCreate {
    token: string;
    scenarioId: string;
    difficulty: Difficulty;
  }
  export interface RoomJoin {
    token: string;
    roomId: string;
  }
  export interface RoomUtterance {
    text: string;
  }
  export type RoomLeave = Record<string, never>;
  export type RoomEnd = Record<string, never>;
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
  // 瓜友房间
  export interface RoomCreated {
    roomId: string;
  }
  export interface RoomJoined {
    roomId: string;
    members: RoomMember[];
  }
  export interface RoomPeerJoined {
    member: RoomMember;
  }
  export interface RoomReady {
    greeting: string;
    currentTurnUserId: string;
  }
  export interface RoomTurn {
    currentTurnUserId: string;
  }
  export interface RoomPeerUtterance {
    userId: string;
    text: string;
  }
  export interface RoomAiText {
    deltaText: string;
  }
  export type RoomAiDone = Record<string, never>;
  export interface RoomPeerLeft {
    userId: string;
  }
  export type RoomEnded = Record<string, never>;
  export interface RoomError {
    code: string;
    message: string;
  }
}

/** 房间成员（公开信息） */
export interface RoomMember {
  userId: string;
  displayName: string;
  avatarKey: string;
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

export const SCENARIO_CATEGORIES: ScenarioCategory[] = [
  { id: 'career', label: '职场', emoji: '💼' },
  { id: 'life', label: '生活', emoji: '🍽️' },
  { id: 'travel', label: '出行', emoji: '✈️' },
  { id: 'social', label: '社交', emoji: '💬' },
  { id: 'exam', label: '考试', emoji: '🎓' },
];

export const PRESET_SCENARIOS: Scenario[] = [
  {
    id: 'interview',
    title: 'Job Interview',
    description: 'Practice for English job interviews. The AI will act as a hiring manager.',
    difficulty: 'intermediate',
    category: 'career',
    rolePrompt:
      'You are a professional hiring manager conducting a job interview. Be polite but thorough. Ask follow-up questions. Keep the conversation focused on the candidate\'s experience and qualifications. Use moderate-paced, professional English.',
    goal: 'Successfully answer interview questions and demonstrate your qualifications.',
  },
  {
    id: 'meeting',
    title: 'Team Meeting',
    description: 'Practice participating in an English team meeting. The AI will act as your colleague.',
    difficulty: 'advanced',
    category: 'career',
    rolePrompt:
      'You are a senior colleague leading a team meeting. Discuss project updates, ask for opinions, and encourage participation. Use professional but conversational English. Introduce business vocabulary naturally.',
    goal: 'Actively participate in the meeting and contribute your ideas.',
  },
  {
    id: 'presentation',
    title: 'Presentation Q&A',
    description: 'Field questions from the audience after presenting your project in English.',
    difficulty: 'advanced',
    category: 'career',
    rolePrompt:
      'You are an audience member at a professional presentation. The student has just finished a short presentation; ask 1-2 thoughtful follow-up questions per turn. Be polite and curious. Keep questions specific and conversational.',
    goal: 'Confidently answer follow-up questions and clarify your points.',
  },
  {
    id: 'restaurant',
    title: 'Restaurant Ordering',
    description: 'Practice ordering food at an English-speaking restaurant. The AI will act as a server.',
    difficulty: 'beginner',
    category: 'life',
    rolePrompt:
      'You are a friendly server at a casual restaurant. Greet the customer warmly, present the menu, help with recommendations, and take their order. Use simple, everyday English with a warm tone.',
    goal: 'Order a complete meal and handle any questions from the server.',
  },
  {
    id: 'doctor',
    title: 'Doctor Visit',
    description: 'Describe your symptoms to an English-speaking doctor and follow advice.',
    difficulty: 'intermediate',
    category: 'life',
    rolePrompt:
      'You are a friendly general-practice doctor. Greet the patient, ask about their symptoms, ask clarifying medical questions, and explain your diagnosis or advice in clear, simple English.',
    goal: 'Explain your symptoms clearly and understand the doctor\'s advice.',
  },
  {
    id: 'shopping',
    title: 'Shopping',
    description: 'Buy clothes or daily items at an English-speaking store.',
    difficulty: 'beginner',
    category: 'life',
    rolePrompt:
      'You are a helpful shop assistant in a clothing or convenience store. Greet the customer, help them find items, answer questions about size/price, and complete the checkout in simple, friendly English.',
    goal: 'Find what you need, ask questions about it, and complete a purchase.',
  },
  {
    id: 'hotel',
    title: 'Hotel Check-in',
    description: 'Check in, ask about facilities, or report an issue at an English-speaking hotel.',
    difficulty: 'beginner',
    category: 'travel',
    rolePrompt:
      'You are a polite front-desk receptionist at a mid-range hotel. Greet the guest, handle check-in (name, reservation, ID, payment), explain facilities, and respond to any requests in clear, courteous English.',
    goal: 'Check in smoothly and get the information you need about your stay.',
  },
  {
    id: 'smalltalk',
    title: 'Small Talk',
    description: 'Chat about weekends, hobbies, weather and everyday topics.',
    difficulty: 'beginner',
    category: 'social',
    rolePrompt:
      'You are a friendly acquaintance making casual small talk in English. Pick light topics (weather, weekends, hobbies, food), ask short follow-up questions, share brief opinions of your own, and keep the energy warm and easygoing.',
    goal: 'Keep a natural casual conversation going for several turns.',
  },
  {
    id: 'ielts',
    title: 'IELTS Speaking',
    description: 'Simulate an IELTS Speaking test with a friendly examiner.',
    difficulty: 'advanced',
    category: 'exam',
    rolePrompt:
      'You are an IELTS Speaking examiner. Run a brief Part 1 / Part 2 / Part 3 style interview: warm-up questions, a 1-minute long-turn topic, then 2-3 abstract follow-up questions. Stay neutral, polite, and professional. Do not give scores during the conversation.',
    goal: 'Practice an IELTS Speaking-style interaction and improve fluency under prompts.',
  },
];

/** 根据自由话题与难度构造一个 'custom' 场景 */
export function buildFreeTopicScenario(topic: string, difficulty: Difficulty): Scenario {
  const trimmed = topic.trim();
  const safeTopic = trimmed.length > 0 ? trimmed : 'anything you like';
  return {
    id: 'custom',
    title: trimmed.length > 0 ? `Free Topic: ${trimmed}` : 'Free Topic',
    description: `自由话题练习：${safeTopic}`,
    difficulty,
    rolePrompt:
      `You are a friendly English-speaking conversation partner. Chat naturally with the student about: "${safeTopic}". ` +
      `Match a ${difficulty} learner's level: keep sentences appropriately simple/complex, ask follow-up questions, ` +
      `and gently steer back to the topic if the conversation drifts. Stay warm, curious, and encouraging.`,
    goal: `Have a natural conversation about "${safeTopic}".`,
  };
}

// -------------------- 账号 / 持久化 / HTTP API --------------------

/** 用户公开信息（无敏感字段） */
export interface User {
  id: string;
  email: string;
  displayName: string;
}

/** 注册 / 登录成功返回 */
export interface AuthResult {
  token: string;
  user: User;
}

/** 本地或服务端持久化的会话摘要（用于成长曲线） */
export interface StoredSession {
  id: string;
  /** 登录用户的 id；游客本地存储时可省略 */
  userId?: string;
  /** epoch ms */
  timestamp: number;
  scenarioId: string;
  difficulty: Difficulty;
  radar: RadarScores;
  /** 综合分（0-100） */
  overallScore: number;
  /** CEFR 等级估算 */
  cefrEstimate?: string;
  /** 完整报告（本地缓存，用于回溯查看） */
  report?: Report;
}

// -------------------- 瓜友（Melon Buddy） --------------------

/** 练习时段偏好 */
export type PracticeSlot = 'morning' | 'noon' | 'evening' | 'night' | 'any';

/** 可公开 profile 更新（供匹配与卡片展示） */
export interface PublicProfileUpdate {
  avatarKey?: string;
  nativeLang?: string;
  practiceSlot?: PracticeSlot;
  targetScenarios?: string[];
}

/** 瓜友卡片：只露学习数据，无 email / 真人照片 */
export interface BuddyCard {
  userId: string;
  displayName: string;
  avatarKey: string;
  /** 最近一次会话的 CEFR 估算；无则 undefined（前端显示「评估中」） */
  cefr?: string;
  /** 本周（本地周一 0 点起）练习次数 */
  weeklyPracticeCount: number;
  /** 擅长场景 id（近 30 天 Top 2） */
  topScenarios: string[];
  /** 最近一次雷达分数 */
  recentRadar?: RadarScores;
  /** 种子瓜友：约练习对其置灰 */
  isSeed?: boolean;
}

/** 瓜友关系（含派生冷却状态与瓜友连胜） */
export interface BuddyRelation {
  /** Buddy 行 id */
  buddyId: string;
  /** 对方卡片 */
  card: BuddyCard;
  /** active | cooling（派生：lastInteractAt 超过冷却阈值） */
  status: 'active' | 'cooling';
  /** 瓜友连胜天数（双方练习自然日交集，连续计数） */
  mutualStreak: number;
  /** 最近互动时间 epoch ms */
  lastInteractAt: number;
}

/** 收到的瓜友邀请 */
export interface BuddyRequestDTO {
  requestId: string;
  from: BuddyCard;
  createdAt: number;
}

/** 鼓励贴纸枚举（闭合集合，无自由 UGC） */
export type StickerKey =
  | 'nice_job'
  | 'keep_going'
  | 'one_more_melon'
  | 'well_done'
  | 'impressive'
  | 'proud_of_you';

/** 贴纸元信息 */
export interface StickerMeta {
  key: StickerKey;
  /** 中文标签 */
  label: string;
  /** 英文短句（点击经 TTS 朗读） */
  phrase: string;
  /** 前端图标 key */
  iconKey: string;
}

/** 预置贴纸集合 */
export const STICKERS: StickerMeta[] = [
  { key: 'nice_job', label: '干得漂亮', phrase: 'Nice job!', iconKey: 'star' },
  { key: 'keep_going', label: '继续加油', phrase: 'Keep going!', iconKey: 'bolt' },
  { key: 'one_more_melon', label: '再来一颗瓜', phrase: 'One more melon!', iconKey: 'melon' },
  { key: 'well_done', label: '太棒了', phrase: 'Well done!', iconKey: 'party' },
  { key: 'impressive', label: '厉害了', phrase: 'Impressive!', iconKey: 'sparkle' },
  { key: 'proud_of_you', label: '为你骄傲', phrase: 'Proud of you!', iconKey: 'crown' },
];

/** 合法的贴纸 key 集合（用于校验） */
export const STICKER_KEYS: StickerKey[] = STICKERS.map((s) => s.key);

/** 收到的鼓励贴纸 */
export interface EncouragementDTO {
  id: string;
  from: BuddyCard;
  stickerKey: StickerKey;
  createdAt: number;
  read: boolean;
}

/** 排行条目（仅瓜友圈） */
export interface RankingEntry {
  userId: string;
  displayName: string;
  avatarKey: string;
  weeklyPracticeCount: number;
  isSelf: boolean;
}

/** 房间邀请（轮询送达） */
export interface RoomInviteDTO {
  roomId: string;
  from: BuddyCard;
  createdAt: number;
}

/** 冷却阈值（天）：超过则关系标记 cooling */
export const BUDDY_COOL_DAYS = 7;

/** CEFR 等级映射为数字（A1..C2 → 1..6）；无/非法返回 null */
export function cefrToLevel(cefr?: string): number | null {
  if (!cefr) return null;
  const map: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
  return map[cefr.toUpperCase().slice(0, 2)] ?? null;
}

/** 两个 CEFR 是否在 ±1 级以内；任一缺省视为可匹配 */
export function cefrWithinOneLevel(a?: string, b?: string): boolean {
  const la = cefrToLevel(a);
  const lb = cefrToLevel(b);
  if (la === null || lb === null) return true;
  return Math.abs(la - lb) <= 1;
}

/** HTTP API 请求/响应契约 */
export namespace Api {
  export interface RegisterReq {
    email: string;
    password: string;
    displayName?: string;
  }
  export interface LoginReq {
    email: string;
    password: string;
  }
  export interface MergeGuestReq {
    sessions: StoredSession[];
  }
  export interface SubmitSessionReq {
    session: StoredSession;
    report?: Report;
  }
  export interface GrowthResp {
    streak: number;
    totalXp: number;
    sessions: StoredSession[];
  }

  // -------- 瓜友 --------
  export type UpdateProfileReq = PublicProfileUpdate;
  export interface MatchesResp {
    candidates: BuddyCard[];
  }
  export interface SendRequestReq {
    toUserId: string;
  }
  export interface RequestsResp {
    requests: BuddyRequestDTO[];
  }
  export interface BuddyListResp {
    buddies: BuddyRelation[];
  }
  export interface SendEncouragementReq {
    toUserId: string;
    stickerKey: StickerKey;
  }
  export interface EncouragementsResp {
    encouragements: EncouragementDTO[];
  }
  export interface RankingResp {
    ranking: RankingEntry[];
  }
  export interface RoomInviteReq {
    toUserId: string;
    roomId: string;
  }
  export interface RoomInviteResp {
    invites: RoomInviteDTO[];
  }
}

export { normalizeTranscript } from './transcript-normalize';
