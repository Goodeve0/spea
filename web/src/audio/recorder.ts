/**
 * 音频录制模块
 * 采集麦克风音频，支持 VAD 检测说话结束
 */

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
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceThreshold = 700;

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
    this.startVadMonitoring();
  }

  stop(): void {
    if (!this.recording) return;
    this.mediaRecorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.recording = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
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

  private startVadMonitoring(): void {
    if (!this.stream) return;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(this.stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let isSpeaking = false;

    const checkVad = () => {
      if (!this.recording) return;
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;

      if (avg > 15) {
        isSpeaking = true;
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      } else if (isSpeaking && !this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          isSpeaking = false;
          this.silenceTimer = null;
          this.silenceCallbacks.forEach((cb) => cb());
        }, this.silenceThreshold);
      }
      requestAnimationFrame(checkVad);
    };
    checkVad();
  }
}
