import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WsMessage } from '@speak-coach/shared';

import { IflytekTtsEngine } from './iflytek-tts-client';

vi.mock('../store/settings', () => ({
  useSettingsStore: {
    getState: () => ({ playbackSpeed: 1 }),
  },
}));

const sendMock = vi.fn();
const onMessageHandlers: Array<(msg: WsMessage) => void> = [];

vi.mock('../ws-client', () => ({
  getWsClient: () => ({
    connect: vi.fn(),
    isOpen: () => true,
    waitForOpen: () => Promise.resolve(),
    send: sendMock,
    onMessage: (handler: (msg: WsMessage) => void) => {
      onMessageHandlers.push(handler);
      return () => {
        const idx = onMessageHandlers.indexOf(handler);
        if (idx >= 0) onMessageHandlers.splice(idx, 1);
      };
    },
  }),
}));

function emitMessage(msg: WsMessage): void {
  onMessageHandlers.forEach((h) => h(msg));
}

/** 最小 PCM：2 字节 silence */
const MIN_PCM_B64 = btoa(String.fromCharCode(0, 0));

describe('IflytekTtsEngine', () => {
  let sourceStart: ReturnType<typeof vi.fn>;
  let sourceStop: ReturnType<typeof vi.fn>;
  let contextClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    sendMock.mockClear();
    onMessageHandlers.length = 0;
    sourceStart = vi.fn();
    sourceStop = vi.fn();

    contextClose = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal(
      'AudioContext',
      vi.fn().mockImplementation(() => ({
        state: 'running',
        currentTime: 0,
        destination: {},
        close: contextClose,
        createBuffer: vi.fn().mockReturnValue({
          copyToChannel: vi.fn(),
          duration: 0.1,
        }),
        createBufferSource: vi.fn().mockReturnValue({
          buffer: null,
          playbackRate: { value: 1 },
          connect: vi.fn(),
          start: sourceStart,
          stop: sourceStop,
          disconnect: vi.fn(),
          onended: null as (() => void) | null,
        }),
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stop 后不再入队 PCM 帧', async () => {
    const engine = new IflytekTtsEngine();
    engine.speak('Hello');
    await Promise.resolve();

    const requestId = sendMock.mock.calls[0][1].requestId as string;
    engine.stop();

    emitMessage({
      type: 'tts.audio',
      payload: { requestId, audio: MIN_PCM_B64 },
    });

    expect(sourceStart).not.toHaveBeenCalled();
    expect(contextClose).toHaveBeenCalled();
  });

  it('stop 后 scheduleEnd 的 onEnd 不触发', async () => {
    const onEnd = vi.fn();
    const engine = new IflytekTtsEngine();
    engine.speak('Hello', { onEnd });
    await Promise.resolve();

    const requestId = sendMock.mock.calls[0][1].requestId as string;
    emitMessage({ type: 'tts.done', payload: { requestId } });

    engine.stop();
    vi.advanceTimersByTime(500);

    expect(onEnd).not.toHaveBeenCalled();
  });

  it('连续 speak 仅最后一次 onEnd 触发', async () => {
    const onEndFirst = vi.fn();
    const onEndSecond = vi.fn();
    const engine = new IflytekTtsEngine();

    engine.speak('First', { onEnd: onEndFirst });
    await Promise.resolve();
    const requestIdFirst = sendMock.mock.calls[0][1].requestId as string;

    engine.speak('Second', { onEnd: onEndSecond });
    await Promise.resolve();
    const requestIdSecond = sendMock.mock.calls[1][1].requestId as string;

    emitMessage({ type: 'tts.done', payload: { requestId: requestIdFirst } });
    vi.advanceTimersByTime(500);
    emitMessage({ type: 'tts.done', payload: { requestId: requestIdSecond } });
    vi.advanceTimersByTime(500);

    expect(onEndFirst).not.toHaveBeenCalled();
    expect(onEndSecond).toHaveBeenCalledTimes(1);
  });
});
