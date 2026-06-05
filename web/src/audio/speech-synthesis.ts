/**
 * 浏览器端语音合成（Web Speech API SpeechSynthesis）
 * 实现 ITtsEngine 接口，作为默认 TTS 引擎
 */

import type { EngineId, ITtsEngine, TtsSpeakOptions } from './tts-engine';

export class BrowserSpeechSynthesisEngine implements ITtsEngine {
  readonly id: EngineId = 'browser';

  private utterance: SpeechSynthesisUtterance | null = null;
  private speaking = false;

  speak(text: string, options?: TtsSpeakOptions | (() => void)): void {
    const opts: TtsSpeakOptions | undefined = typeof options === 'function' ? { onEnd: options } : options;
    this.stop();

    if (!text.trim()) {
      opts?.onEnd?.();
      return;
    }

    if (!this.isSupported()) {
      const err = new Error('SpeechSynthesis API is not supported in this browser');
      console.error('[BrowserSpeechSynthesisEngine.speak] unsupported:', err);
      opts?.onError?.(err);
      opts?.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = speechSynthesis.getVoices();
    const englishVoice = voices.find((v) => v.lang.startsWith('en') && v.name.includes('Female'))
      ?? voices.find((v) => v.lang.startsWith('en-US'))
      ?? voices.find((v) => v.lang.startsWith('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => {
      this.speaking = true;
    };

    utterance.onend = () => {
      this.speaking = false;
      opts?.onEnd?.();
    };

    utterance.onerror = (event) => {
      this.speaking = false;
      const err = new Error(`SpeechSynthesis error: ${event.error ?? 'unknown'}`);
      console.error('[BrowserSpeechSynthesisEngine.onerror]', err);
      opts?.onError?.(err);
      opts?.onEnd?.();
    };

    this.utterance = utterance;
    speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    this.speaking = false;
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
