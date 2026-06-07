/**
 * PcmRecorder
 *
 * 基于 AudioWorklet 采集麦克风原始音频，输出 16kHz / 16bit / 单声道 raw PCM（Int16）。
 * 供讯飞 ISE 发音评测使用（要求 audio/L16;rate=16000）。
 *
 * 关键设计（见 openspec/changes/add-pronunciation-assessment/design.md）：
 *  - D1：用 AudioWorklet（非废弃的 ScriptProcessorNode）在音频线程采集，不阻塞主线程
 *  - D2：降采样前先做抗混叠低通（滑动平均近似），避免 48k→16k 抽取产生混叠失真
 *
 * 用法：
 *   const rec = new PcmRecorder();
 *   if (PcmRecorder.isSupported()) {
 *     await rec.start(mediaStream);   // 复用已有 MediaStream，不二次申请麦克风
 *     ...
 *     const pcm = await rec.stop();   // Int16Array @ 16kHz
 *     rec.dispose();
 *   }
 */

const TARGET_SAMPLE_RATE = 16000;
/** 抗混叠低通截止频率（Hz），略低于目标奈奎斯特频率 8kHz，给滚降留余量 */
const LOWPASS_CUTOFF_HZ = 7200;

export class PcmRecorder {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private chunks: Float32Array[] = [];
  private nativeSampleRate = 48000;
  private capturing = false;

  /** 当前环境是否支持 AudioWorklet 采集 */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.AudioContext !== 'undefined' &&
      typeof AudioWorkletNode !== 'undefined'
    );
  }

  /** 开始采集（复用传入的 MediaStream） */
  async start(stream: MediaStream): Promise<void> {
    if (this.capturing) return;
    this.chunks = [];

    const Ctx = window.AudioContext;
    this.audioContext = new Ctx();
    this.nativeSampleRate = this.audioContext.sampleRate;

    await this.audioContext.audioWorklet.addModule('/pcm-worklet.js');

    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-capture-processor');

    this.workletNode.port.onmessage = (ev: MessageEvent<Float32Array>) => {
      if (!this.capturing) return;
      this.chunks.push(ev.data);
    };

    // source → worklet（不接 destination，避免回声/外放）
    this.sourceNode.connect(this.workletNode);
    this.capturing = true;
  }

  /**
   * 停止采集并返回 16kHz Int16 PCM。
   * 内部：合并帧 → 抗混叠低通 → 降采样 → Float32 转 Int16。
   */
  async stop(): Promise<Int16Array> {
    this.capturing = false;

    const merged = mergeFloat32(this.chunks);
    this.chunks = [];

    if (merged.length === 0) {
      return new Int16Array(0);
    }

    const filtered = lowPassFilter(merged, this.nativeSampleRate, LOWPASS_CUTOFF_HZ);
    const downsampled = downsample(filtered, this.nativeSampleRate, TARGET_SAMPLE_RATE);
    return floatToInt16(downsampled);
  }

  /** 释放音频资源 */
  dispose(): void {
    this.capturing = false;
    try {
      this.workletNode?.port.close();
      this.workletNode?.disconnect();
      this.sourceNode?.disconnect();
    } catch {
      /* ignore */
    }
    this.workletNode = null;
    this.sourceNode = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
    }
    this.audioContext = null;
    this.chunks = [];
  }
}

/** 合并多段 Float32Array 为一段 */
export function mergeFloat32(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * 抗混叠低通滤波（滑动平均近似）。
 * 窗口大小由采样率与截止频率推导：window ≈ sampleRate / cutoff。
 * 这是对理想 sinc 滤波的轻量近似，对语音主频段足够，且代码量极小（见 design.md D2 折中）。
 */
export function lowPassFilter(
  input: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): Float32Array {
  if (input.length === 0) return input;
  const windowSize = Math.max(1, Math.round(sampleRate / cutoffHz));
  if (windowSize <= 1) return input;

  const out = new Float32Array(input.length);
  let acc = 0;
  for (let i = 0; i < input.length; i++) {
    acc += input[i];
    if (i >= windowSize) {
      acc -= input[i - windowSize];
    }
    const count = Math.min(i + 1, windowSize);
    out[i] = acc / count;
  }
  return out;
}

/**
 * 线性插值降采样。fromRate → toRate（要求 toRate <= fromRate）。
 * 返回长度约为 input.length * toRate / fromRate。
 */
export function downsample(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (input.length === 0) return input;
  if (toRate >= fromRate) return input;

  const ratio = fromRate / toRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const a = input[idx];
    const b = idx + 1 < input.length ? input[idx + 1] : a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** Float32（[-1,1]）转 Int16 PCM，clamp 防溢出 */
export function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let s = input[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/**
 * 把 16bit 单声道 Int16 PCM 封装成可播放的 WAV Blob（供录音回放）。
 * @param pcm Int16 PCM 采样
 * @param sampleRate 采样率（默认 16000，与采集一致）
 */
export function pcmToWavBlob(pcm: Int16Array, sampleRate = 16000): Blob {
  const dataLength = pcm.length * 2; // 16bit = 2 bytes/sample
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    view.setInt16(offset, pcm[i], true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
