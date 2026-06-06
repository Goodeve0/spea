import { describe, it, expect, beforeEach } from 'vitest';
import { WsGateway } from './ws-gateway';
import { DialogService } from '../modules/dialog.service';
import { CorrectionService } from '../modules/correction.service';
import { ReportService } from '../modules/report.service';
import { MockAsrService } from '../modules/asr.service';
import { MockTtsService } from '../modules/tts.service';
import { MockPronunciationService } from '../modules/pronunciation.service';
import { createMockLlmClient } from '../lib/llm-client.test';

/**
 * 集成测试：验证 WsGateway 内部消息流转逻辑（不启动真实 WebSocket）
 * 通过直接调用 handleMessage 模拟客户端消息
 */
describe('WsGateway 集成测试', () => {
  let gateway: WsGateway;
  let llm: ReturnType<typeof createMockLlmClient>;
  let mockAsr: MockAsrService;
  let sentMessages: Array<{ type: string; payload: any }>;
  let mockWs: any;

  beforeEach(() => {
    llm = createMockLlmClient();
    const dialogService = new DialogService(llm);
    const correctionService = new CorrectionService(llm);
    const reportService = new ReportService(llm);
    mockAsr = new MockAsrService();
    const mockTts = new MockTtsService();
    const mockPron = new MockPronunciationService();

    gateway = new WsGateway(
      dialogService, correctionService, reportService,
      mockAsr, mockTts, mockPron,
    );

    // Mock WebSocket
    sentMessages = [];
    mockWs = {
      readyState: 1, // OPEN
      send: (data: string) => sentMessages.push(JSON.parse(data)),
    };
  });

  it('session.start → 收到 session.started + greeting', async () => {
    mockAsr.setMockResults([]);
    (llm.complete as any).mockResolvedValue('Hello! Welcome to the interview.');

    await (gateway as any).handleMessage(mockWs, {
      type: 'session.start',
      payload: { scenarioId: 'interview', difficulty: 'intermediate' },
    });

    const started = sentMessages.find((m) => m.type === 'session.started');
    expect(started).toBeTruthy();
    expect(started!.payload.sessionId).toBeTruthy();
    expect(started!.payload.greeting).toBe('Hello! Welcome to the interview.');
  });

  it('非法 scenario → 收到 error', async () => {
    await (gateway as any).handleMessage(mockWs, {
      type: 'session.start',
      payload: { scenarioId: 'nonexistent', difficulty: 'beginner' },
    });

    const error = sentMessages.find((m) => m.type === 'error');
    expect(error).toBeTruthy();
    expect(error!.payload.code).toBe('SESSION_NOT_FOUND');
  });

  it('未知消息类型 → 收到 error INVALID_MESSAGE', async () => {
    await (gateway as any).handleMessage(mockWs, {
      type: 'unknown.type',
      payload: {},
    });

    const error = sentMessages.find((m) => m.type === 'error');
    expect(error).toBeTruthy();
    expect(error!.payload.code).toBe('INVALID_MESSAGE');
  });

  it('audio.end 无 session → 收到 error', async () => {
    await (gateway as any).handleMessage(mockWs, {
      type: 'audio.end',
      payload: {},
    });

    const error = sentMessages.find((m) => m.type === 'error');
    expect(error).toBeTruthy();
  });
});
