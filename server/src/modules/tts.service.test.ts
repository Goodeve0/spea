import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

import { IflytekTtsService, MockTtsService } from './tts.service';

describe('TtsService (Mock)', () => {
  it('synthesize 正常路径触发 onChunk 回调', async () => {
    const svc = new MockTtsService();
    const chunks: ArrayBuffer[] = [];
    await svc.synthesize('Hello', (chunk) => chunks.push(chunk));
    expect(chunks.length).toBe(1);
    expect(chunks[0].byteLength).toBeGreaterThan(0);
  });

  it('空文本不触发 onChunk', async () => {
    const svc = new MockTtsService();
    const chunks: ArrayBuffer[] = [];
    await svc.synthesize('', (chunk) => chunks.push(chunk));
    expect(chunks).toEqual([]);
  });

  it('失败时不抛出，静默降级', async () => {
    const svc = new MockTtsService();
    svc.setShouldFail(true);
    const chunks: ArrayBuffer[] = [];
    // 不应抛出
    await svc.synthesize('Hello', (chunk) => chunks.push(chunk));
    expect(chunks).toEqual([]);
  });
});

// ---------------- 讯飞 TTS Mock ----------------

class FakeWs extends EventEmitter {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = FakeWs.CONNECTING;
  sent: string[] = [];

  constructor() {
    super();
    setTimeout(() => {
      this.readyState = FakeWs.OPEN;
      this.emit('open');
    }, 0);
  }

  send(msg: string): void {
    this.sent.push(msg);
  }

  close(): void {
    this.readyState = 3;
  }
}

let lastWs: FakeWs | null = null;

vi.mock('ws', () => {
  const ctor = vi.fn(() => {
    lastWs = new FakeWs();
    return lastWs;
  });
  return {
    default: Object.assign(ctor, { OPEN: 1, CONNECTING: 0 }),
  };
});

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('IflytekTtsService', () => {
  const originalAppId = process.env.XFYUN_APP_ID;
  const originalKey = process.env.XFYUN_API_KEY;
  const originalSecret = process.env.XFYUN_API_SECRET;

  beforeEach(() => {
    process.env.XFYUN_APP_ID = 'app';
    process.env.XFYUN_API_KEY = 'key';
    process.env.XFYUN_API_SECRET = 'secret';
    lastWs = null;
  });

  afterEach(() => {
    if (originalAppId !== undefined) process.env.XFYUN_APP_ID = originalAppId;
    else delete process.env.XFYUN_APP_ID;
    if (originalKey !== undefined) process.env.XFYUN_API_KEY = originalKey;
    else delete process.env.XFYUN_API_KEY;
    if (originalSecret !== undefined) process.env.XFYUN_API_SECRET = originalSecret;
    else delete process.env.XFYUN_API_SECRET;
  });

  it('收到多帧 PCM 时按帧触发 onChunk，最终在 status=2 时 resolve', async () => {
    const svc = new IflytekTtsService();
    const chunks: ArrayBuffer[] = [];
    const promise = svc.synthesize('Hello', (c) => chunks.push(c));

    await flush();
    expect(lastWs).not.toBeNull();
    // 第一条 send 应包含 common/business/data
    const firstMsg = JSON.parse(lastWs!.sent[0]);
    expect(firstMsg.common.app_id).toBe('app');
    expect(firstMsg.business.vcn).toBe('x4_EnUs_Catherine');

    // 模拟讯飞回三帧音频 + 最后一帧 status=2
    lastWs!.emit('message', Buffer.from(JSON.stringify({ code: 0, data: { audio: 'AAAA', status: 1 } })));
    lastWs!.emit('message', Buffer.from(JSON.stringify({ code: 0, data: { audio: 'BBBB', status: 1 } })));
    lastWs!.emit('message', Buffer.from(JSON.stringify({ code: 0, data: { audio: 'CCCC', status: 2 } })));

    await promise;
    expect(chunks.length).toBe(3);
    chunks.forEach((c) => expect(c.byteLength).toBeGreaterThan(0));
  });

  it('voice 参数传递给讯飞 vcn', async () => {
    const svc = new IflytekTtsService();
    const promise = svc.synthesize('Hi', () => {}, 'x4_EnUs_Laura');
    await flush();
    const firstMsg = JSON.parse(lastWs!.sent[0]);
    expect(firstMsg.business.vcn).toBe('x4_EnUs_Laura');
    lastWs!.emit('message', Buffer.from(JSON.stringify({ code: 0, data: { status: 2 } })));
    await promise;
  });

  it('讯飞返回 code != 0 时 reject', async () => {
    const svc = new IflytekTtsService();
    const promise = svc.synthesize('Hello', () => {});
    await flush();
    lastWs!.emit('message', Buffer.from(JSON.stringify({ code: 10005, message: 'invalid app id' })));
    await expect(promise).rejects.toThrow(/Iflytek TTS error: 10005/);
  });

  it('XFYUN_APP_ID 缺失直接抛错', async () => {
    delete process.env.XFYUN_APP_ID;
    const svc = new IflytekTtsService();
    await expect(svc.synthesize('Hi', () => {})).rejects.toThrow('XFYUN_APP_ID is not set');
  });

  it('空文本直接 resolve，不连接 ws', async () => {
    const svc = new IflytekTtsService();
    await svc.synthesize('   ', () => {});
    expect(lastWs).toBeNull();
  });
});
