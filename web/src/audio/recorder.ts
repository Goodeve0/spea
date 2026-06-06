/**
 * 音频录制模块
 * 采集麦克风音频，支持 VAD 检测说话结束
 */

import { SilenceDetector } from './silence-detector';

export interface AudioRecorder {
  start(): Promise<void>;
  stop(): void;
  onData(callback: (chunk: ArrayBuffer) => void): void;
  onVadSilence(callback: () => void): void;
  isRecording(): boolean;
}

/** 基于 Web Audio API + MediaRecorder 的录音实现 */
export class BrowserAudioRecorder implements AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private dataCallbacks: Array<(chunk: ArrayBuffer) => void> = [];
  private silenceCallbacks: Array<() => void> = [];
  private recording = false;
  private silenceDetector: SilenceDetector | null = null;

  async start(): Promise<void> {
    if (this.recording) return;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        event.data.arrayBuffer().then((buffer) => {
          this.dataCallbacks.forEach((cb) => cb(buffer));
        });
      }
    };

    this.mediaRecorder.start(1000);
    this.recording = true;

    this.silenceDetector = new SilenceDetector({ silenceDurationMs: 700 });
    this.silenceDetector.onSilence(() => {
      this.silenceCallbacks.forEach((cb) => cb());
    });
    this.silenceDetector.start(this.stream);
  }

  stop(): void {
    if (!this.recording) return;
    this.mediaRecorder?.stop();
    this.silenceDetector?.stop();
    this.silenceDetector = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.recording = false;
  }

  onData(callback: (chunk: ArrayBuffer) => void): void {
    this.dataCallbacks.push(callback);
  }

  onVadSilence(callback: () => void): void {
    this.silenceCallbacks.push(callback);
  }

  isRecording(): boolean {
    return this.recording;
  }
}
