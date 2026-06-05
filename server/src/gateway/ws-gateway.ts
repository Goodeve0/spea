import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
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
} from '@speak-coach/shared';
import { PRESET_SCENARIOS } from '@speak-coach/shared';

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
    const server = createServer();
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
      });
    });

    server.listen(port, () => {
      console.log(`WebSocket server listening on port ${port}`);
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
