/** 难度等级 */
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
/** 练习场景 */
export interface Scenario {
    id: string;
    title: string;
    description: string;
    difficulty: Difficulty;
    rolePrompt: string;
    goal: string;
    category?: ScenarioCategoryId;
}
/** 场景分类 ID（与 SCENARIO_CATEGORIES 一一对应） */
export type ScenarioCategoryId = 'career' | 'life' | 'travel' | 'social' | 'exam';
/** 场景分类元信息 */
export interface ScenarioCategory {
    id: ScenarioCategoryId;
    label: string;
    emoji: string;
}
/** 一次完整练习会话 */
export interface Session {
    id: string;
    scenarioId: string;
    difficulty: Difficulty;
    startedAt: number;
    endedAt?: number;
    overallScore?: number;
}
/** 对话轮次 */
export interface Turn {
    id: string;
    sessionId: string;
    role: 'user' | 'ai';
    text: string;
    audioUrl?: string;
    timestamp: number;
}
/** 单词评分 */
export interface WordScore {
    word: string;
    score: number;
    error?: string;
}
/** 发音评测结果（对应 user turn） */
export interface PronunciationResult {
    turnId: string;
    accuracy: number;
    fluency: number;
    completeness: number;
    prosody: number;
    wordScores: WordScore[];
}
/** 错误严重程度 */
export type ErrorSeverity = 'blocking' | 'major' | 'minor';
/** 纠错结果 */
export interface Correction {
    turnId: string;
    original: string;
    corrected: string;
    errorType: string;
    severity: ErrorSeverity;
    explanation: string;
    betterExpression?: string;
}
/** 雷达图五维分数 */
export interface RadarScores {
    pronunciation: number;
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
    annotatedTurns: Array<Turn & {
        corrections: Correction[];
    }>;
    /** CEFR 等级估算：A1/A2/B1/B2/C1/C2 */
    cefrEstimate?: string;
    /** 本次是否有用户发言（无则不计入成长曲线） */
    hasUserSpeech?: boolean;
}
/** 消息信封格式 */
export interface WsMessage<T = unknown> {
    type: string;
    payload: T;
}
export type ClientMessageType = 'session.start' | 'audio.chunk' | 'audio.end' | 'session.end' | 'tts.request' | 'room.create' | 'room.join' | 'room.utterance' | 'room.leave' | 'room.end';
export type ServerMessageType = 'session.started' | 'asr.partial' | 'asr.final' | 'ai.text' | 'ai.audio' | 'ai.done' | 'report.ready' | 'tts.audio' | 'tts.done' | 'tts.error' | 'error' | 'room.created' | 'room.joined' | 'room.peer.joined' | 'room.ready' | 'room.turn' | 'room.peer.utterance' | 'room.ai.text' | 'room.ai.done' | 'room.peer.left' | 'room.ended' | 'room.error';
export declare namespace ClientPayload {
    interface SessionStart {
        scenarioId: string;
        difficulty: Difficulty;
    }
    interface AudioChunk {
        seq: number;
    }
    type AudioEnd = Record<string, never>;
    type SessionEnd = Record<string, never>;
    interface TtsRequest {
        requestId: string;
        text: string;
        voice?: string;
    }
    interface RoomCreate {
        token: string;
        scenarioId: string;
        difficulty: Difficulty;
    }
    interface RoomJoin {
        token: string;
        roomId: string;
    }
    interface RoomUtterance {
        text: string;
    }
    type RoomLeave = Record<string, never>;
    type RoomEnd = Record<string, never>;
}
export declare namespace ServerPayload {
    interface SessionStarted {
        sessionId: string;
        greeting: string;
    }
    interface AsrPartial {
        text: string;
    }
    interface AsrFinal {
        turnId: string;
        text: string;
    }
    interface AiText {
        turnId: string;
        deltaText: string;
    }
    interface AiAudio {
        turnId: string;
        seq: number;
    }
    interface AiDone {
        turnId: string;
    }
    interface ReportReady {
        report: Report;
    }
    interface ErrorPayload {
        code: ErrorCode;
        message: string;
    }
    interface TtsAudio {
        requestId: string;
        seq: number;
        audio: string;
    }
    interface TtsDone {
        requestId: string;
    }
    interface TtsError {
        requestId: string;
        code: ErrorCode;
        message: string;
    }
    interface RoomCreated {
        roomId: string;
    }
    interface RoomJoined {
        roomId: string;
        members: RoomMember[];
    }
    interface RoomPeerJoined {
        member: RoomMember;
    }
    interface RoomReady {
        greeting: string;
        currentTurnUserId: string;
    }
    interface RoomTurn {
        currentTurnUserId: string;
    }
    interface RoomPeerUtterance {
        userId: string;
        text: string;
    }
    interface RoomAiText {
        deltaText: string;
    }
    type RoomAiDone = Record<string, never>;
    interface RoomPeerLeft {
        userId: string;
    }
    type RoomEnded = Record<string, never>;
    interface RoomError {
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
export declare enum ErrorCode {
    UNKNOWN = "UNKNOWN",
    ASR_FAILED = "ASR_FAILED",
    LLM_FAILED = "LLM_FAILED",
    TTS_FAILED = "TTS_FAILED",
    PRONUNCIATION_FAILED = "PRONUNCIATION_FAILED",
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
    INVALID_MESSAGE = "INVALID_MESSAGE"
}
export declare const SCENARIO_CATEGORIES: ScenarioCategory[];
export declare const PRESET_SCENARIOS: Scenario[];
/** 根据自由话题与难度构造一个 'custom' 场景 */
export declare function buildFreeTopicScenario(topic: string, difficulty: Difficulty): Scenario;
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
export type StickerKey = 'nice_job' | 'keep_going' | 'one_more_melon' | 'well_done' | 'impressive' | 'proud_of_you';
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
export declare const STICKERS: StickerMeta[];
/** 合法的贴纸 key 集合（用于校验） */
export declare const STICKER_KEYS: StickerKey[];
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
export declare const BUDDY_COOL_DAYS = 7;
/** CEFR 等级映射为数字（A1..C2 → 1..6）；无/非法返回 null */
export declare function cefrToLevel(cefr?: string): number | null;
/** 两个 CEFR 是否在 ±1 级以内；任一缺省视为可匹配 */
export declare function cefrWithinOneLevel(a?: string, b?: string): boolean;
/** HTTP API 请求/响应契约 */
export declare namespace Api {
    interface RegisterReq {
        email: string;
        password: string;
        displayName?: string;
    }
    interface LoginReq {
        email: string;
        password: string;
    }
    interface MergeGuestReq {
        sessions: StoredSession[];
    }
    interface SubmitSessionReq {
        session: StoredSession;
        report?: Report;
    }
    interface GrowthResp {
        streak: number;
        totalXp: number;
        sessions: StoredSession[];
    }
    type UpdateProfileReq = PublicProfileUpdate;
    interface MatchesResp {
        candidates: BuddyCard[];
    }
    interface SendRequestReq {
        toUserId: string;
    }
    interface RequestsResp {
        requests: BuddyRequestDTO[];
    }
    interface BuddyListResp {
        buddies: BuddyRelation[];
    }
    interface SendEncouragementReq {
        toUserId: string;
        stickerKey: StickerKey;
    }
    interface EncouragementsResp {
        encouragements: EncouragementDTO[];
    }
    interface RankingResp {
        ranking: RankingEntry[];
    }
    interface RoomInviteReq {
        toUserId: string;
        roomId: string;
    }
    interface RoomInviteResp {
        invites: RoomInviteDTO[];
    }
}
//# sourceMappingURL=contracts.d.ts.map