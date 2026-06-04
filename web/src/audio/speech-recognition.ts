/**
 * 浏览器端语音识别（Web Speech API）
 * 替代服务端 ASR，延迟更低、免费
 */

export interface SpeechRecognitionResult {
  text: string;
  isFinal: boolean;
}

type ResultCallback = (result: SpeechRecognitionResult) => void;

export class BrowserSpeechRecognition {
  private recognition: any = null;
  private resultCallbacks: ResultCallback[] = [];
  private errorCallbacks: Array<(error: string) => void> = [];
  private listening = false;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        this.resultCallbacks.forEach((cb) =>
          cb({
            text: result[0].transcript,
            isFinal: result.isFinal,
          }),
        );
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.errorCallbacks.forEach((cb) => cb(event.error));
      if (event.error !== 'no-speech') {
        this.listening = false;
      }
    };

    this.recognition.onend = () => {
      // 如果还在 listening 状态，自动重启（continuous 模式下浏览器可能自动停）
      if (this.listening) {
        try {
          this.recognition.start();
        } catch {
          this.listening = false;
        }
      }
    };
  }

  start(): void {
    if (!this.recognition) return;
    try {
      this.recognition.start();
      this.listening = true;
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }
  }

  stop(): void {
    if (!this.recognition) return;
    this.listening = false;
    try {
      this.recognition.stop();
    } catch {
      // ignore
    }
  }

  onResult(cb: ResultCallback): () => void {
    this.resultCallbacks.push(cb);
    return () => {
      this.resultCallbacks = this.resultCallbacks.filter((h) => h !== cb);
    };
  }

  onError(cb: (error: string) => void): () => void {
    this.errorCallbacks.push(cb);
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter((h) => h !== cb);
    };
  }

  isListening(): boolean {
    return this.listening;
  }

  isSupported(): boolean {
    return !!this.recognition;
  }
}
