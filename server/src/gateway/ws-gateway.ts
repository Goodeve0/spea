import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import type { DialogService } from '../modules/dialog.service';
import type { CorrectionService } from '../modules/correction.service';
import type { ReportService } from '../modules/report.service';
import type { IAsrService, AsrStream } from '../modules/asr.service';
import type { ITtsService } from '../modules/tts.service';
import type { IPronunciationService } from '../modules/pronunciation.service';
import type {
  WsMessage,
  ClientPayload,
  ServerPayload,
  ClientMessageType,
  ServerMessageType,
  Correction,
  Turn,
  PronunciationResult,
  ErrorCode,
  Scenario,
  Difficulty,
  RadarScores,
  RoomMember,
  StoredSession,
} from '@speak-coach/shared';
import { PRESET_SCENARIOS } from '@speak-coach/shared';
import { verifyToken } from '../http/auth.service';
import { submitSession } from '../http/repo';
import { prisma } from '../db/prisma';

/** 房间成员（含连接） */
interface RoomMemberConn {
  userId: string;
  ws: WebSocket;
  displayName: string;
  avatarKey: string;
}

/** 实时练习房间状态（内存态，不落库；结束时为每位有发言者各记一次 Session） */
interface RoomState {
  id: string;
  scenario: Scenario; // 已应用难度
  difficulty: string;
  members: RoomMemberConn[]; // 当前在房
  participants: Map<string, { displayName: string; avatarKey: string }>; // 曾参与
  turns: Turn[]; // 共享对话历史（AI + 两人）
  perUserTurns: Map<string, Turn[]>; // 各自发言，用于结束记会话
  currentTurnUserId: string;
  started: boolean;
  finalized: boolean;
}

/** 会话状态 */
interface SessionState {
  id: string;
  scenarioId: string;
  difficulty: string;
  asrStream: AsrStream | null;
  turns: Turn[];
  corrections: Correction[];
  pronunciations: PronunciationResult[];
  audioChunks: ArrayBuffer[];
}

export class WsGateway {
  private wss: WebSocketServer | null = null;
  private sessions = new Map<string, SessionState>();
  private clientSessions = new Map<WebSocket, string>();
  // 瓜友实时房间
  private rooms = new Map<string, RoomState>();
  private clientRooms = new Map<WebSocket, string>();

  constructor(
    private readonly dialogService: DialogService,
    private readonly correctionService: CorrectionService,
    private readonly reportService: ReportService,
    private readonly asrService: IAsrService,
    private readonly ttsService: ITtsService,
    private readonly pronunciationService: IPronunciationService,
    /** 独立 TTS 服务，专供前端 `tts.request` 通道使用（通常注入讯飞实例） */
    private readonly bridgeTtsService: ITtsService = ttsService,
  ) {}

  /** 启动 WebSocket 服务 */
  start(port: number): void {
    const server = createServer((req, res) => {
      this.handleHttp(req, res).catch((err) => {
        console.error('[WsGateway.handleHttp] unhandled error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ error: 'Internal proxy error' }));
      });
    });
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws) => {
      console.log('Client connected');

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as WsMessage;
          this.handleMessage(ws, msg);
        } catch {
          this.sendError(ws, 'INVALID_MESSAGE', 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        this.cleanupClient(ws);
        this.removeFromRoom(ws).catch((err) => console.error('[room cleanup]', err));
      });
    });

    server.listen(port, () => {
      console.log(`WebSocket server listening on port ${port}`);
    });
  }

  /** HTTP 路由：仅用于 LLM 代理，保证 API Key 不下发到前端 */
  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS（前端与后端不同端口）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? '';
    if (req.method === 'POST' && url === '/api/chat/completions') {
      await this.proxyChatCompletions(req, res);
      return;
    }

    if (req.method === 'GET' && url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, hasApiKey: Boolean(process.env.OPENAI_API_KEY) }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * 透明代理 /chat/completions：
   * - 注入后端的 Authorization（API Key 留在服务端）
   * - 原样转发请求体（messages/model/stream/temperature 等）
   * - 流式响应按 SSE 字节流回传，非流式则整体回传
   */
  private async proxyChatCompletions(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';

    if (!apiKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OPENAI_API_KEY is not set on the server' }));
      return;
    }

    // 读取请求体
    const rawBody = await this.readRequestBody(req);

    let upstream: Response;
    try {
      upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: rawBody,
      });
    } catch (err) {
      console.error('[WsGateway.proxyChatCompletions] upstream fetch failed:', err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upstream LLM request failed' }));
      return;
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/json';
    res.writeHead(upstream.status, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });

    if (!upstream.body) {
      res.end();
      return;
    }

    // 逐块回传（同时支持 SSE 流与普通 JSON）
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
    } catch (err) {
      console.error('[WsGateway.proxyChatCompletions] stream relay error:', err);
    } finally {
      res.end();
    }
  }

  /** 读取 HTTP 请求体为字符串 */
  private readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }

  private async handleMessage(ws: WebSocket, msg: WsMessage): Promise<void> {
    const type = msg.type as ClientMessageType;
    const payload = msg.payload;

    switch (type) {
      case 'session.start':
        await this.handleSessionStart(ws, payload as ClientPayload.SessionStart);
        break;
      case 'audio.chunk':
        await this.handleAudioChunk(ws, payload as ClientPayload.AudioChunk);
        break;
      case 'audio.end':
        await this.handleAudioEnd(ws);
        break;
      case 'session.end':
        await this.handleSessionEnd(ws);
        break;
      case 'tts.request':
        await this.handleTtsRequest(ws, payload as ClientPayload.TtsRequest);
        break;
      case 'room.create':
        await this.handleRoomCreate(ws, payload as ClientPayload.RoomCreate);
        break;
      case 'room.join':
        await this.handleRoomJoin(ws, payload as ClientPayload.RoomJoin);
        break;
      case 'room.utterance':
        await this.handleRoomUtterance(ws, payload as ClientPayload.RoomUtterance);
        break;
      case 'room.leave':
        await this.removeFromRoom(ws);
        break;
      case 'room.end':
        await this.handleRoomEnd(ws);
        break;
      default:
        this.sendError(ws, 'INVALID_MESSAGE', `Unknown message type: ${type}`);
    }
  }

  private async handleSessionStart(ws: WebSocket, payload: ClientPayload.SessionStart): Promise<void> {
    const sessionId = this.generateId();
    const scenario = PRESET_SCENARIOS.find((s) => s.id === payload.scenarioId);
    if (!scenario) {
      this.sendError(ws, 'SESSION_NOT_FOUND', `Scenario not found: ${payload.scenarioId}`);
      return;
    }

    // 覆盖难度
    const adjustedScenario = { ...scenario, difficulty: payload.difficulty };

    const session: SessionState = {
      id: sessionId,
      scenarioId: payload.scenarioId,
      difficulty: payload.difficulty,
      asrStream: null,
      turns: [],
      corrections: [],
      pronunciations: [],
      audioChunks: [],
    };
    this.sessions.set(sessionId, session);
    this.clientSessions.set(ws, sessionId);

    // 生成开场白
    const greeting = await this.dialogService.greet(adjustedScenario);

    // 记录 AI 开场白为 turn
    session.turns.push({
      id: this.generateId(),
      sessionId,
      role: 'ai',
      text: greeting,
      timestamp: Date.now(),
    });

    // TTS 合成开场白
    const audioChunks: ArrayBuffer[] = [];
    await this.ttsService.synthesize(greeting, (chunk) => audioChunks.push(chunk));

    this.send(ws, 'session.started', { sessionId, greeting });
    if (audioChunks.length > 0) {
      for (let i = 0; i < audioChunks.length; i++) {
        this.send(ws, 'ai.audio', { turnId: session.turns[0].id, seq: i });
      }
      this.send(ws, 'ai.done', { turnId: session.turns[0].id });
    }
  }

  private async handleAudioChunk(ws: WebSocket, payload: ClientPayload.AudioChunk): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    // 收集音频（实际场景下推给 ASR stream）
    session.audioChunks.push(new ArrayBuffer(256)); // 简化：实际应传 payload.data
  }

  private async handleAudioEnd(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    // 黑客松简化：用 ASR 识别
    const asrStream = this.asrService.createStream();
    for (const chunk of session.audioChunks) {
      asrStream.push(chunk);
    }
    session.audioChunks = [];

    const userTurnId = this.generateId();

    asrStream.onFinal(async (text) => {
      if (!text.trim()) return;

      // 记录用户 turn
      const userTurn: Turn = {
        id: userTurnId,
        sessionId: session.id,
        role: 'user',
        text,
        timestamp: Date.now(),
      };
      session.turns.push(userTurn);
      this.send(ws, 'asr.final', { turnId: userTurnId, text });

      // 异步纠错（不阻塞主链路）
      this.correctionService.analyzeForTurn(text, userTurnId).then((corrections) => {
        session.corrections.push(...corrections);
      }).catch(() => {});

      // 异步发音评测
      this.pronunciationService.assess(new ArrayBuffer(0), text).then((result) => {
        session.pronunciations.push({ ...result, turnId: userTurnId });
      }).catch(() => {});

      // LLM 流式生成回复
      const aiTurnId = this.generateId();
      let fullReply = '';

      await this.dialogService.reply(session.id, text, (delta) => {
        fullReply += delta;
        this.send(ws, 'ai.text', { turnId: aiTurnId, deltaText: delta });
      });

      // 记录 AI turn
      const aiTurn: Turn = {
        id: aiTurnId,
        sessionId: session.id,
        role: 'ai',
        text: fullReply,
        timestamp: Date.now(),
      };
      session.turns.push(aiTurn);

      // TTS 合成
      await this.ttsService.synthesize(fullReply, (chunk) => {
        this.send(ws, 'ai.audio', { turnId: aiTurnId, seq: 0 });
      });

      this.send(ws, 'ai.done', { turnId: aiTurnId });
    });

    await asrStream.close();
  }

  private async handleSessionEnd(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    try {
      const report = await this.reportService.generate(
        session.id,
        session.turns,
        session.corrections,
        session.pronunciations,
      );
      this.send(ws, 'report.ready', { report });
    } catch {
      this.sendError(ws, 'UNKNOWN', 'Failed to generate report');
    }

    this.sessions.delete(session.id);
    this.clientSessions.delete(ws);
  }

  /**
   * 独立的 TTS 通道：前端无需 session.start 即可请求合成。
   * 按帧把音频回推为 `tts.audio`，结束后发 `tts.done`，失败发 `tts.error`。
   */
  private async handleTtsRequest(ws: WebSocket, payload: ClientPayload.TtsRequest): Promise<void> {
    const requestId = payload?.requestId;
    const text = payload?.text ?? '';
    const voice = payload?.voice;

    if (!requestId) {
      this.sendError(ws, 'INVALID_MESSAGE', 'tts.request missing requestId');
      return;
    }

    if (!text.trim()) {
      this.send(ws, 'tts.done', { requestId });
      return;
    }

    let seq = 0;
    try {
      await this.bridgeTtsService.synthesize(
        text,
        (chunk) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const audio = Buffer.from(chunk).toString('base64');
          this.send(ws, 'tts.audio', { requestId, seq, audio });
          seq += 1;
        },
        voice,
      );
      this.send(ws, 'tts.done', { requestId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[WsGateway.handleTtsRequest] failed, requestId:', requestId, err);
      this.send(ws, 'tts.error', { requestId, code: 'TTS_FAILED', message });
    }
  }

  // ==================== 瓜友实时房间 ====================

  /** 加载房间成员的公开信息 */
  private async loadMember(userId: string, ws: WebSocket): Promise<RoomMemberConn> {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    return {
      userId,
      ws,
      displayName: u?.displayName ?? 'Guest',
      avatarKey: u?.avatarKey ?? 'melon',
    };
  }

  private toPublicMember(m: RoomMemberConn): RoomMember {
    return { userId: m.userId, displayName: m.displayName, avatarKey: m.avatarKey };
  }

  private publicMembers(room: RoomState): RoomMember[] {
    return room.members.map((m) => this.toPublicMember(m));
  }

  private getRoomByClient(ws: WebSocket): RoomState | undefined {
    const id = this.clientRooms.get(ws);
    return id ? this.rooms.get(id) : undefined;
  }

  private broadcast(room: RoomState, type: ServerMessageType, payload: unknown): void {
    for (const m of room.members) this.send(m.ws, type, payload);
  }

  private broadcastExcept(room: RoomState, ws: WebSocket, type: ServerMessageType, payload: unknown): void {
    for (const m of room.members) if (m.ws !== ws) this.send(m.ws, type, payload);
  }

  /** 创建房间并入房（鉴权） */
  private async handleRoomCreate(ws: WebSocket, payload: ClientPayload.RoomCreate): Promise<void> {
    let userId: string;
    try {
      userId = verifyToken(payload.token);
    } catch {
      this.send(ws, 'room.error', { code: 'UNAUTHORIZED', message: '登录已失效，请重新登录' });
      return;
    }
    const scenario = PRESET_SCENARIOS.find((s) => s.id === payload.scenarioId);
    if (!scenario) {
      this.send(ws, 'room.error', { code: 'SESSION_NOT_FOUND', message: `场景不存在: ${payload.scenarioId}` });
      return;
    }
    const roomId = this.generateId();
    const member = await this.loadMember(userId, ws);
    const room: RoomState = {
      id: roomId,
      scenario: { ...scenario, difficulty: payload.difficulty },
      difficulty: payload.difficulty,
      members: [member],
      participants: new Map([[userId, { displayName: member.displayName, avatarKey: member.avatarKey }]]),
      turns: [],
      perUserTurns: new Map(),
      currentTurnUserId: userId,
      started: false,
      finalized: false,
    };
    this.rooms.set(roomId, room);
    this.clientRooms.set(ws, roomId);
    this.send(ws, 'room.created', { roomId });
    this.send(ws, 'room.joined', { roomId, members: this.publicMembers(room) });
  }

  /** 加入已有房间（鉴权 + 满员校验） */
  private async handleRoomJoin(ws: WebSocket, payload: ClientPayload.RoomJoin): Promise<void> {
    let userId: string;
    try {
      userId = verifyToken(payload.token);
    } catch {
      this.send(ws, 'room.error', { code: 'UNAUTHORIZED', message: '登录已失效，请重新登录' });
      return;
    }
    const room = this.rooms.get(payload.roomId);
    if (!room || room.finalized) {
      this.send(ws, 'room.error', { code: 'ROOM_NOT_FOUND', message: '房间不存在或已结束' });
      return;
    }
    if (room.members.length >= 2) {
      this.send(ws, 'room.error', { code: 'ROOM_FULL', message: '房间已满' });
      return;
    }
    const member = await this.loadMember(userId, ws);
    room.members.push(member);
    room.participants.set(userId, { displayName: member.displayName, avatarKey: member.avatarKey });
    this.clientRooms.set(ws, room.id);
    this.send(ws, 'room.joined', { roomId: room.id, members: this.publicMembers(room) });
    this.broadcastExcept(room, ws, 'room.peer.joined', { member: this.toPublicMember(member) });

    if (room.members.length === 2 && !room.started) {
      await this.startRoom(room);
    }
  }

  /** 两人到齐：AI 开场，轮次给创建者（members[0]） */
  private async startRoom(room: RoomState): Promise<void> {
    room.started = true;
    const greeting = await this.dialogService.greet(room.scenario);
    room.turns.push({
      id: this.generateId(),
      sessionId: room.id,
      role: 'ai',
      text: greeting,
      timestamp: Date.now(),
    });
    room.currentTurnUserId = room.members[0].userId;
    this.broadcast(room, 'room.ready', { greeting, currentTurnUserId: room.currentTurnUserId });
  }

  /** 当前轮用户发言：广播 + AI 回复 + 切轮 */
  private async handleRoomUtterance(ws: WebSocket, payload: ClientPayload.RoomUtterance): Promise<void> {
    const room = this.getRoomByClient(ws);
    if (!room) {
      this.send(ws, 'room.error', { code: 'ROOM_NOT_FOUND', message: '不在任何房间中' });
      return;
    }
    const member = room.members.find((m) => m.ws === ws);
    if (!member) return;
    if (room.currentTurnUserId !== member.userId) {
      this.send(ws, 'room.error', { code: 'NOT_YOUR_TURN', message: '还没轮到你说' });
      return;
    }
    const text = (payload?.text ?? '').trim();
    if (!text) return;

    // 记录该用户发言
    const userTurn: Turn = {
      id: this.generateId(),
      sessionId: room.id,
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    room.turns.push(userTurn);
    const arr = room.perUserTurns.get(member.userId) ?? [];
    arr.push(userTurn);
    room.perUserTurns.set(member.userId, arr);

    // 广播给另一人
    this.broadcastExcept(room, ws, 'room.peer.utterance', { userId: member.userId, text });

    // AI 流式回复（共享上下文 keyed by room.id）
    let full = '';
    await this.dialogService.reply(room.id, text, (delta) => {
      full += delta;
      this.broadcast(room, 'room.ai.text', { deltaText: delta });
    });
    room.turns.push({
      id: this.generateId(),
      sessionId: room.id,
      role: 'ai',
      text: full,
      timestamp: Date.now(),
    });
    this.broadcast(room, 'room.ai.done', {});

    // 切换轮次给另一人；降级独自时轮次恒为自己
    const other = room.members.find((m) => m.userId !== member.userId);
    room.currentTurnUserId = other ? other.userId : member.userId;
    this.broadcast(room, 'room.turn', { currentTurnUserId: room.currentTurnUserId });
  }

  /** 主动结束房间：记会话 + 广播 + 清理 */
  private async handleRoomEnd(ws: WebSocket): Promise<void> {
    const room = this.getRoomByClient(ws);
    if (!room) return;
    await this.finalizeRoom(room);
    this.broadcast(room, 'room.ended', {});
    for (const m of room.members) this.clientRooms.delete(m.ws);
    this.rooms.delete(room.id);
  }

  /** 成员离开（主动 leave 或掉线）：通知对方，空房则结算清理 */
  private async removeFromRoom(ws: WebSocket): Promise<void> {
    const roomId = this.clientRooms.get(ws);
    if (!roomId) return;
    this.clientRooms.delete(ws);
    const room = this.rooms.get(roomId);
    if (!room) return;
    const idx = room.members.findIndex((m) => m.ws === ws);
    if (idx === -1) return;
    const [left] = room.members.splice(idx, 1);

    this.broadcast(room, 'room.peer.left', { userId: left.userId });

    if (room.members.length === 0) {
      await this.finalizeRoom(room);
      this.rooms.delete(room.id);
    } else {
      // 降级：剩余者轮次恒为自己
      room.currentTurnUserId = room.members[0].userId;
      this.broadcast(room, 'room.turn', { currentTurnUserId: room.currentTurnUserId });
    }
  }

  /** 结算：为每位有发言的参与者各记一次 Session（计入个人成长） */
  private async finalizeRoom(room: RoomState): Promise<void> {
    if (room.finalized) return;
    room.finalized = true;
    const aiTurns = room.turns.filter((t) => t.role === 'ai');
    for (const [userId, turns] of room.perUserTurns.entries()) {
      if (turns.length === 0) continue;
      const merged = [...turns, ...aiTurns].sort((a, b) => a.timestamp - b.timestamp);
      let report;
      try {
        report = await this.reportService.generate(room.id, merged, [], []);
      } catch (err) {
        console.error('[finalizeRoom] report failed for', userId, err);
        continue;
      }
      const overallScore = this.avgRadar(report.radar);
      const sessionId = this.generateId();
      const stored: StoredSession = {
        id: sessionId,
        userId,
        timestamp: Date.now(),
        scenarioId: room.scenario.id,
        difficulty: room.difficulty as Difficulty,
        radar: report.radar,
        overallScore,
        cefrEstimate: report.cefrEstimate,
      };
      try {
        await submitSession(userId, stored, { ...report, sessionId });
      } catch (err) {
        console.error('[finalizeRoom] submitSession failed for', userId, err);
      }
    }
  }

  private avgRadar(r: RadarScores): number {
    const vals = [r.pronunciation, r.fluency, r.grammar, r.vocabulary, r.taskCompletion];
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  private getSession(ws: WebSocket): SessionState | undefined {
    const sessionId = this.clientSessions.get(ws);
    if (!sessionId) {
      this.sendError(ws, 'SESSION_NOT_FOUND', 'No active session');
      return undefined;
    }
    return this.sessions.get(sessionId);
  }

  private send(ws: WebSocket, type: ServerMessageType, payload: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, 'error', { code, message });
  }

  private cleanupClient(ws: WebSocket): void {
    const sessionId = this.clientSessions.get(ws);
    if (sessionId) {
      this.sessions.delete(sessionId);
      this.clientSessions.delete(ws);
    }
  }

  private generateId(): string {
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
