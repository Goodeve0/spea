/**
 * PCM 采集 AudioWorklet Processor
 *
 * 在音频渲染线程运行，每次 process() 把输入声道的 Float32 帧拷贝一份，
 * 通过 port.postMessage 回传主线程累积。仅采集单声道（取第一个声道）。
 *
 * 注意：此文件必须以独立 JS 文件形式存在于 public/ 下，
 * 通过 audioContext.audioWorklet.addModule('/pcm-worklet.js') 加载。
 * 不能使用 TS / import，AudioWorklet 全局作用域独立于主线程。
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    // 无输入（如静音帧）时跳过
    if (!input || input.length === 0) {
      return true;
    }
    const channel = input[0];
    if (!channel || channel.length === 0) {
      return true;
    }
    // 拷贝一份回传（channel 是复用缓冲，不能直接传引用）
    const copy = new Float32Array(channel.length);
    copy.set(channel);
    this.port.postMessage(copy, [copy.buffer]);
    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
