import { SILENCE_DURATION_MS, VAD_ENERGY_THRESHOLD } from './voice-input-constants';

export interface SilenceDetectorOptions {
  silenceDurationMs?: number;
  energyThreshold?: number;
}

/**
 * 基于 Web Audio Analyser 的 VAD 静音检测。
 * 检测到说话后，连续静音达到阈值时触发 onSilence。
 */
export class SilenceDetector {
  private active = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private isSpeaking = false;
  private rafId: number | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private speechCallbacks: Array<() => void> = [];
  private silenceCallbacks: Array<() => void> = [];
  private readonly silenceDurationMs: number;
  private readonly energyThreshold: number;

  constructor(options: SilenceDetectorOptions = {}) {
    this.silenceDurationMs = options.silenceDurationMs ?? SILENCE_DURATION_MS;
    this.energyThreshold = options.energyThreshold ?? VAD_ENERGY_THRESHOLD;
  }

  start(stream: MediaStream): void {
    this.stop();
    this.active = true;
    this.isSpeaking = false;

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const checkVad = (): void => {
      if (!this.active || !this.analyser || !this.dataArray) return;

      this.analyser.getByteFrequencyData(this.dataArray);
      const avg = this.dataArray.reduce((sum, value) => sum + value, 0) / this.dataArray.length;

      if (avg > this.energyThreshold) {
        if (!this.isSpeaking) {
          this.speechCallbacks.forEach((cb) => cb());
        }
        this.isSpeaking = true;
        this.clearSilenceTimer();
      } else if (this.isSpeaking && !this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.silenceTimer = null;
          this.isSpeaking = false;
          if (this.active) {
            this.silenceCallbacks.forEach((cb) => cb());
          }
        }, this.silenceDurationMs);
      }

      this.rafId = requestAnimationFrame(checkVad);
    };

    this.rafId = requestAnimationFrame(checkVad);
  }

  stop(): void {
    this.active = false;
    this.clearSilenceTimer();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    void this.audioContext?.close();
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.isSpeaking = false;
  }

  /** ASR 有活动时重置静音倒计时（视为用户仍在说话） */
  resetSilenceTimer(): void {
    if (!this.active) return;
    this.isSpeaking = true;
    this.clearSilenceTimer();
  }

  onSpeech(callback: () => void): () => void {
    this.speechCallbacks.push(callback);
    return () => {
      this.speechCallbacks = this.speechCallbacks.filter((cb) => cb !== callback);
    };
  }

  onSilence(callback: () => void): () => void {
    this.silenceCallbacks.push(callback);
    return () => {
      this.silenceCallbacks = this.silenceCallbacks.filter((cb) => cb !== callback);
    };
  }

  isActive(): boolean {
    return this.active;
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}
