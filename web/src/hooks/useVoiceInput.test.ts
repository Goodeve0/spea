/**
 * useVoiceInput 增量预览 + 兜底规范化测试
 *
 * mock 重点：
 *  - BrowserSpeechRecognition：暴露 emitResult/emitError，单测可手工驱动 onResult。
 *  - SilenceDetector：no-op，测试不依赖真实 VAD。
 *  - PcmRecorder：isSupported 返回 false，跳过 PCM 路径，让 finishRecording 命中浏览器兜底分支。
 *  - transcribeAudio：未触发（pcm.length=0），不影响断言。
 *  - useSessionStore：返回带 setRecording 的轻量假实现。
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock 工厂会被提升到文件顶部，外部变量在执行时尚未初始化。
// 用 vi.hoisted 把"实例容器 + Mock 类"一起提升，再在 mock 工厂里返回该类。
const hoisted = vi.hoisted(() => {
  type ResultCb = (r: { text: string; isFinal: boolean }) => void;
  type ErrorCb = (e: string) => void;
  class MockRecognition {
    private resultCbs: ResultCb[] = [];
    private errorCbs: ErrorCb[] = [];
    started = false;

    isSupported(): boolean {
      return true;
    }
    start(): void {
      this.started = true;
    }
    stop(): void {
      this.started = false;
    }
    onResult(cb: ResultCb): () => void {
      this.resultCbs.push(cb);
      return () => {
        this.resultCbs = this.resultCbs.filter((c) => c !== cb);
      };
    }
    onError(cb: ErrorCb): () => void {
      this.errorCbs.push(cb);
      return () => {
        this.errorCbs = this.errorCbs.filter((c) => c !== cb);
      };
    }
    emitResult(text: string, isFinal: boolean): void {
      this.resultCbs.forEach((cb) => cb({ text, isFinal }));
    }
  }
  const instances: MockRecognition[] = [];
  class MockRecognitionWithRegistry extends MockRecognition {
    constructor() {
      super();
      instances.push(this);
    }
  }
  return { instances, MockRecognitionWithRegistry };
});

vi.mock('../audio/speech-recognition', () => ({
  BrowserSpeechRecognition: hoisted.MockRecognitionWithRegistry,
}));

vi.mock('../audio/silence-detector', () => ({
  SilenceDetector: class {
    onSpeech(): () => void {
      return () => {};
    }
    onSilence(): () => void {
      return () => {};
    }
    start(): void {}
    stop(): void {}
    resetSilenceTimer(): void {}
  },
}));

vi.mock('../audio/pcm-recorder', () => ({
  PcmRecorder: class {
    static isSupported(): boolean {
      return false;
    }
    async start(): Promise<void> {}
    async stop(): Promise<Int16Array> {
      return new Int16Array(0);
    }
    dispose(): void {}
  },
  pcmToWavBlob: (): Blob => new Blob(),
}));

vi.mock('../api/asr', () => ({
  transcribeAudio: vi.fn(async () => ''),
}));

vi.mock('../store/session', () => ({
  useSessionStore: Object.assign(
    () => ({ setRecording: vi.fn() }),
    {
      getState: (): { turns: unknown[] } => ({ turns: [] }),
    },
  ),
}));

beforeEach(() => {
  hoisted.instances.length = 0;
  // jsdom 默认无 mediaDevices；提供最小 mock
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({
        getTracks: (): unknown[] => [],
      })),
    },
  });
});

import { useVoiceInput } from './useVoiceInput';

function getRecog(): InstanceType<typeof hoisted.MockRecognitionWithRegistry> {
  const r = hoisted.instances[0];
  if (!r) throw new Error('recognition not constructed');
  return r;
}

describe('useVoiceInput · 增量预览 + 兜底规范化', () => {
  it('A. interim 推送时 previewWords.interim 切词正确，recordingPreview 字符串增长', async () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useVoiceInput({ onTranscript, useServerAsr: false }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    const recog = getRecog();

    act(() => recog.emitResult('holidays', false));
    expect(result.current.previewWords.interim).toEqual(['holidays']);
    expect(result.current.recordingPreview).toBe('holidays');

    act(() => recog.emitResult('holidays this', false));
    expect(result.current.previewWords.interim).toEqual(['holidays', 'this']);
    expect(result.current.recordingPreview).toBe('holidays this');

    act(() => recog.emitResult('holidays this is', false));
    expect(result.current.previewWords.interim).toEqual(['holidays', 'this', 'is']);

    act(() => recog.emitResult('holidays this is my first time to speak', false));
    expect(result.current.previewWords.interim).toEqual([
      'holidays', 'this', 'is', 'my', 'first', 'time', 'to', 'speak',
    ]);
    expect(result.current.recordingPreview).toBe('holidays this is my first time to speak');
    expect(result.current.previewWords.committed).toEqual([]);
  });

  it('B. 关闭服务端 ASR 时，浏览器兜底分支对拼接词流做一次 normalizeTranscript', async () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useVoiceInput({ onTranscript, useServerAsr: false }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    const recog = getRecog();
    // 浏览器 continuous 模式下两个 final 块之间没有标点信号，
    // 兜底走 normalizeTranscript 时按整段无标点处理 → 句首大写 + 句末点。
    act(() => recog.emitResult('hello everyone', true));
    act(() => recog.emitResult('how are you', true));

    await act(async () => {
      result.current.stopRecording();
      // 让 finishRecording 内部的异步 IIFE 跑完
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith('Hello everyone how are you.');
  });

  it('C. interim → final → interim 循环：final 后 interim 清空，committed 累积正确', async () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useVoiceInput({ onTranscript, useServerAsr: false }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    const recog = getRecog();

    act(() => recog.emitResult('hello', false));
    expect(result.current.previewWords).toEqual({ committed: [], interim: ['hello'] });

    act(() => recog.emitResult('hello world', true));
    expect(result.current.previewWords).toEqual({
      committed: ['hello', 'world'],
      interim: [],
    });

    act(() => recog.emitResult('how', false));
    expect(result.current.previewWords).toEqual({
      committed: ['hello', 'world'],
      interim: ['how'],
    });

    act(() => recog.emitResult('how are', false));
    expect(result.current.previewWords).toEqual({
      committed: ['hello', 'world'],
      interim: ['how', 'are'],
    });

    act(() => recog.emitResult('how are you', true));
    expect(result.current.previewWords).toEqual({
      committed: ['hello', 'world', 'how', 'are', 'you'],
      interim: [],
    });
  });
});
