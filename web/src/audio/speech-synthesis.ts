/**
 * 浏览器端语音合成（Web Speech API SpeechSynthesis）
 * 实现 ITtsEngine 接口，作为默认 TTS 引擎
 */

import type { EngineId, ITtsEngine, TtsSpeakOptions } from './tts-engine';
import { BROWSER_START_TIMEOUT_MS } from './tts-engine';
import { useSettingsStore } from '../store/settings';

/** 启动超时未触发 onstart 时的最大重试次数（除首次外）。 */
const MAX_START_RETRIES = 2;

interface UtteranceParams {
  text: string;
  rate: number;
  voice: SpeechSynthesisVoice | undefined;
}

export class BrowserSpeechSynthesisEngine implements ITtsEngine {
  readonly id: EngineId = 'browser';

  private utterance: SpeechSynthesisUtterance | null = null;
  private speaking = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  /** 播放代际：stop 或新 speak 时递增，作废旧 utterance / 重试 setTimeout 回调 */
  private generation = 0;
  /** 启动超时计时器：speak 后未在阈值内触发 onstart 时主动取消并通知上层 */
  private startTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // #8 voices 在 Chrome 中异步加载，首次 getVoices() 可能为空。
    // 预加载一次，并监听 voiceschanged 持续刷新缓存。
    if (this.isSupported()) {
      this.cachedVoices = speechSynthesis.getVoices();
      speechSynthesis.addEventListener?.('voiceschanged', () => {
        this.cachedVoices = speechSynthesis.getVoices();
      });
    }
  }

  /** 选取英文音色，优先美式女声；缓存为空时回退到实时查询 */
  private pickEnglishVoice(): SpeechSynthesisVoice | undefined {
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang.startsWith('en') && /female/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith('en-US')) ??
      voices.find((v) => v.lang.startsWith('en'))
    );
  }

  speak(text: string, options?: TtsSpeakOptions | (() => void)): void {
    const opts: TtsSpeakOptions | undefined = typeof options === 'function' ? { onEnd: options } : options;
    this.stop();
    const gen = ++this.generation;

    if (!text.trim()) {
      if (gen === this.generation) {
        opts?.onEnd?.();
      }
      return;
    }

    if (!this.isSupported()) {
      const err = new Error('SpeechSynthesis API is not supported in this browser');
      console.error('[BrowserSpeechSynthesisEngine.speak] unsupported:', err);
      if (gen === this.generation) {
        opts?.onError?.(err);
        opts?.onEnd?.();
      }
      return;
    }

    // 解 paused 残留态；不再 cancel/setTimeout，因 stop() 内已 cancel，
    // 且首次 speak 必须与调用栈同任务以保住 user-gesture token
    try {
      speechSynthesis.resume();
    } catch (error) {
      console.warn('[BrowserSpeechSynthesisEngine.speak] resume failed:', error);
    }

    const params: UtteranceParams = {
      text,
      rate: opts?.rate ?? useSettingsStore.getState().playbackSpeed,
      voice: this.pickEnglishVoice(),
    };

    // 首次同步执行，保留用户手势上下文（Chrome/Safari 自动播放策略要求）
    this.tryStart(gen, params, opts, 0);
  }

  /**
   * 创建一个新的 utterance 并尝试发声；若启动超时则递归重试，达到上限后触发 onError + onEnd。
   * 每次调用都会创建一份**全新**的 SpeechSynthesisUtterance —— 旧 utterance 不能复用。
   */
  private tryStart(
    gen: number,
    params: UtteranceParams,
    opts: TtsSpeakOptions | undefined,
    retryCount: number,
  ): void {
    if (gen !== this.generation) return;

    const utterance = new SpeechSynthesisUtterance(params.text);
    utterance.lang = 'en-US';
    utterance.rate = params.rate;
    utterance.pitch = 1.0;
    if (params.voice) {
      utterance.voice = params.voice;
    }

    utterance.onstart = () => {
      if (gen !== this.generation) return;
      this.clearStartTimer();
      this.speaking = true;
      opts?.onStart?.();
    };

    utterance.onend = () => {
      if (gen !== this.generation) return;
      this.clearStartTimer();
      this.speaking = false;
      opts?.onEnd?.();
    };

    utterance.onerror = (event) => {
      if (gen !== this.generation) return;
      this.clearStartTimer();
      this.speaking = false;
      if (event.error === 'interrupted') {
        // cancel 后 Chrome 可能对未播 utterance 触发 interrupted，仍需 onEnd 释放 UI/锁
        opts?.onEnd?.();
        return;
      }
      const err = new Error(`SpeechSynthesis error: ${event.error ?? 'unknown'}`);
      console.error('[BrowserSpeechSynthesisEngine.onerror]', err);
      opts?.onError?.(err);
      opts?.onEnd?.();
    };

    this.utterance = utterance;
    speechSynthesis.speak(utterance);

    this.clearStartTimer();
    this.startTimer = setTimeout(() => {
      if (gen !== this.generation) return;
      this.startTimer = null;

      if (retryCount < MAX_START_RETRIES) {
        // 没声音 → 清队列、解 paused、重建 utterance 重试
        console.warn(
          '[BrowserSpeechSynthesisEngine.speak] start retry, attempt:',
          retryCount + 1,
          'text:',
          params.text.slice(0, 60),
        );
        this.resetSynthesisState();
        // 重试已脱离首次手势，可异步入队让浏览器先消化 cancel
        setTimeout(() => {
          if (gen !== this.generation) return;
          this.tryStart(gen, params, opts, retryCount + 1);
        }, 0);
        return;
      }

      // 重试预算用尽 → 终态失败
      ++this.generation;
      console.error(
        '[BrowserSpeechSynthesisEngine.speak] start timeout, attempts:',
        retryCount + 1,
        'text:',
        params.text.slice(0, 60),
      );
      try {
        speechSynthesis.cancel();
      } catch (error) {
        console.error('[BrowserSpeechSynthesisEngine.speak] cancel after timeout failed:', error);
      }
      this.speaking = false;
      this.utterance = null;
      const err = new Error('SpeechSynthesis start timeout');
      opts?.onError?.(err);
      opts?.onEnd?.();
    }, BROWSER_START_TIMEOUT_MS);
  }

  /** 清挂起的 paused 态 + 清空残留 utterance 队列，安全可在空闲时调用。 */
  private resetSynthesisState(): void {
    if (typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.resume();
    } catch (error) {
      console.warn('[BrowserSpeechSynthesisEngine.resetSynthesisState] resume failed:', error);
    }
    try {
      speechSynthesis.cancel();
    } catch (error) {
      console.warn('[BrowserSpeechSynthesisEngine.resetSynthesisState] cancel failed:', error);
    }
  }

  private clearStartTimer(): void {
    if (this.startTimer !== null) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }
  }

  stop(): void {
    ++this.generation;
    this.clearStartTimer();
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    this.speaking = false;
    this.utterance = null;
  }

  isSpeaking(): boolean {
    return typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  async isAvailable(): Promise<boolean> {
    return this.isSupported();
  }

  dispose(): void {
    this.stop();
    this.utterance = null;
  }
}

/** @deprecated 使用 BrowserSpeechSynthesisEngine */
export { BrowserSpeechSynthesisEngine as BrowserSpeechSynthesis };
