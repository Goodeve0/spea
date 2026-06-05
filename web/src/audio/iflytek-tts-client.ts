/**
 * 讯飞 TTS 前端引擎
 * - 通过后端 WS 网关中转，发 tts.request 收 tts.audio/tts.done/tts.error
 * - 用 Web Audio API 解码 PCM 16kHz/16bit/mono 并按帧排队播放
 */

import type { ServerPayload, WsMessage } from '@speak-coach/shared';

import { getWsClient } from '../ws-client';
import { DEFAULT_IFLYTEK_VOICE } from './iflytek-voices';
import type { EngineId, ITtsEngine, TtsSpeakOptions } from './tts-engine';

const SAMPLE_RATE = 16000;
const INT16_DIVISOR = 0x8000;
const AVAILABILITY_TIMEOUT_MS = 5000;

interface ActiveRequest {
  requestId: string;
  options: TtsSpeakOptions | undefined;
  nextStartAt: number;
  ended: boolean;
}

export class IflytekTtsEngine implements ITtsEngine {
  readonly id: EngineId = 'iflytek';

  private audioContext: AudioContext | null = null;
  private active: ActiveRequest | null = null;
  private unsubscribe: (() => void) | null = null;
  private disabled = false;

  speak(text: string, options?: TtsSpeakOptions): void {
    this.stop();

    if (!text.trim()) {
      options?.onEnd?.();
      return;
    }

    const client = getWsClient();
    client.connect();

    const requestId = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.active = {
      requestId,
      options,
      nextStartAt: 0,
      ended: false,
    };

    this.ensureSubscription();
    this.ensureAudioContext();

    // #10 等待 WS 就绪后再发送，避免连接未建立时静默丢消息
    client
      .waitForOpen()
      .then(() => {
        // 期间可能已被新的 speak()/stop() 取消
        if (!this.active || this.active.requestId !== requestId) return;
        client.send('tts.request', {
          requestId,
          text,
          voice: options?.voice ?? DEFAULT_IFLYTEK_VOICE,
        });
      })
      .catch((err: Error) => {
        if (!this.active || this.active.requestId !== requestId) return;
        console.error('[IflytekTtsEngine.speak] WS 未就绪:', err);
        this.disabled = true;
        const e = new Error(`讯飞 TTS 不可用：后端 WS 未连接（${err.message}）。请确认服务端已启动。`);
        const opts = this.active.options;
        this.active = null;
        opts?.onError?.(e);
        opts?.onEnd?.();
      });
  }

  stop(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.suspend().catch(() => {});
      } catch (error) {
        console.warn('[IflytekTtsEngine.stop] suspend failed:', error);
      }
    }
    if (this.active) {
      this.active.ended = true;
      this.active = null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (this.disabled) return false;
    const client = getWsClient();
    client.connect();
    return new Promise<boolean>((resolve) => {
      const start = performance.now();
      const probe = (): void => {
        if (client.isOpen()) {
          resolve(true);
          return;
        }
        if (performance.now() - start >= AVAILABILITY_TIMEOUT_MS) {
          resolve(false);
          return;
        }
        setTimeout(probe, 100);
      };
      probe();
    });
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  resetDisabled(): void {
    this.disabled = false;
  }

  dispose(): void {
    this.stop();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  private ensureSubscription(): void {
    if (this.unsubscribe) return;
    const client = getWsClient();
    this.unsubscribe = client.onMessage((msg) => this.handleMessage(msg));
  }

  private ensureAudioContext(): void {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new Ctor({ sampleRate: SAMPLE_RATE });
    } else if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    if (this.active) {
      this.active.nextStartAt = this.audioContext.currentTime;
    }
  }

  private handleMessage(msg: WsMessage): void {
    if (!this.active) return;

    switch (msg.type) {
      case 'tts.audio': {
        const payload = msg.payload as ServerPayload.TtsAudio;
        if (payload.requestId !== this.active.requestId) return;
        this.enqueuePcmFrame(payload.audio);
        break;
      }
      case 'tts.done': {
        const payload = msg.payload as ServerPayload.TtsDone;
        if (payload.requestId !== this.active.requestId) return;
        this.scheduleEnd();
        break;
      }
      case 'tts.error': {
        const payload = msg.payload as ServerPayload.TtsError;
        if (payload.requestId !== this.active.requestId) return;
        this.disabled = true;
        const err = new Error(`[IflytekTtsEngine] ${payload.code}: ${payload.message}`);
        console.error('[IflytekTtsEngine.handleMessage] tts.error, requestId:', payload.requestId, err);
        const opts = this.active.options;
        this.active = null;
        opts?.onError?.(err);
        opts?.onEnd?.();
        break;
      }
      default:
        break;
    }
  }

  private enqueuePcmFrame(base64Audio: string): void {
    if (!this.active || !this.audioContext) return;

    const bytes = base64ToUint8Array(base64Audio);
    if (bytes.byteLength < 2) return;

    const sampleCount = Math.floor(bytes.byteLength / 2);
    const float32 = new Float32Array(sampleCount);
    // bytes 由 atob 构造，底层一定是 ArrayBuffer 而非 SharedArrayBuffer
    const view = new DataView(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < sampleCount; i += 1) {
      float32[i] = view.getInt16(i * 2, true) / INT16_DIVISOR;
    }

    const buffer = this.audioContext.createBuffer(1, sampleCount, SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    const startAt = Math.max(now, this.active.nextStartAt || now);
    source.start(startAt);
    this.active.nextStartAt = startAt + buffer.duration;
  }

  private scheduleEnd(): void {
    if (!this.active || !this.audioContext) return;
    const remainingMs = Math.max(0, (this.active.nextStartAt - this.audioContext.currentTime) * 1000);
    const opts = this.active.options;
    const requestId = this.active.requestId;
    setTimeout(() => {
      if (this.active?.requestId !== requestId) return;
      this.active = null;
      opts?.onEnd?.();
    }, remainingMs + 30);
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
