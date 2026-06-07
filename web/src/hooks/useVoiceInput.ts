/**
 * useVoiceInput
 *
 * 封装语音录入的全部底层逻辑：
 *  - BrowserSpeechRecognition（连续识别、interim/final 结果）
 *  - SilenceDetector（VAD 静默自动停止）
 *  - MediaStream 获取与释放
 *  - committedWords / interimWords 词数组拼接（增量预览）
 *
 * 对外暴露：
 *  - isSupported        — 当前浏览器是否支持 Web Speech API
 *  - recordingPreview   — 实时展示字符串（committed + interim 词拼合，向后兼容）
 *  - previewWords       — 当前预览的词数组 { committed, interim }，渲染层用稳定 key 增量拼接
 *  - recordingHasInterim— 当前是否有 interim 文本（控制 "..." 动画）
 *  - startRecording()   — 请求麦克风 + 启动识别 + VAD
 *  - stopRecording()    — 手动停止，收集最终文本并回调 onTranscript
 *
 * 使用方注入：
 *  - onTranscript(text)   — 录音结束且有有效文本时回调（已规范化：句首大写 + 句末标点）
 *  - onAudio(pcm, text)   — 录音结束且采集到 PCM 时回调（供发音评测；不支持/空则不触发）
 *  - onUnsupported()      — 浏览器不支持语音时回调（切换到文字模式）
 *  - beforeStart()        — 每次开始录音前的钩子（如停止 TTS 播放）
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeTranscript } from '@speak-coach/shared';

import { transcribeAudio } from '../api/asr';
import { PcmRecorder, pcmToWavBlob } from '../audio/pcm-recorder';
import { SilenceDetector } from '../audio/silence-detector';
import { BrowserSpeechRecognition } from '../audio/speech-recognition';
import { useSessionStore } from '../store/session';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  /** 录音结束且采集到 16kHz Int16 PCM 时回调（供发音评测） */
  onAudio?: (pcm: Int16Array, transcript: string) => void;
  onUnsupported?: () => void;
  beforeStart?: () => void;
  /** 是否用服务端 SenseVoice 作为最终权威转写（默认 true；失败回退浏览器识别） */
  useServerAsr?: boolean;
}

export interface PreviewWords {
  /** 已 final 化的词（按出现顺序） */
  committed: string[];
  /** 当前 interim 假说的词（每次 interim 推送整体替换） */
  interim: string[];
}

export interface VoiceInputHandle {
  isSupported: boolean;
  recordingPreview: string;
  /** 增量渲染用：committed + interim 词数组；committed 前缀稳定，interim 整体替换 */
  previewWords: PreviewWords;
  recordingHasInterim: boolean;
  /** 录音停止后正在用 SenseVoice 转写中（用于显示"识别中…"） */
  isTranscribing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  /** 组件卸载时调用，释放所有媒体资源 */
  cleanup: () => void;
}

const EMPTY_PREVIEW: PreviewWords = { committed: [], interim: [] };

function splitWords(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/);
}

export function useVoiceInput({
  onTranscript,
  onAudio,
  onUnsupported,
  beforeStart,
  useServerAsr = true,
}: UseVoiceInputOptions): VoiceInputHandle {
  const { setRecording } = useSessionStore();
  const [recordingPreview, setRecordingPreview] = useState('');
  const [previewWords, setPreviewWords] = useState<PreviewWords>(EMPTY_PREVIEW);
  const [recordingHasInterim, setRecordingHasInterim] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recogUnsubsRef = useRef<Array<() => void>>([]);
  const vadUnsubsRef = useRef<Array<() => void>>([]);
  const silenceDetectorRef = useRef<SilenceDetector | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  /** PCM 录制器（发音评测用），仅在支持 AudioWorklet 时启用 */
  const pcmRecorderRef = useRef<PcmRecorder | null>(null);

  /** 已 final 化的词，按出现顺序追加 */
  const committedWordsRef = useRef<string[]>([]);
  /** 当前 interim 词数组，每次 interim 整体替换 */
  const interimWordsRef = useRef<string[]>([]);
  const hasSpokenRef = useRef(false);
  const finishingRef = useRef(false);

  // 初始化 recognition 实例（单例，组件生命周期内复用）
  // 注意：必须在 useEffect 外同步初始化，否则首次 render 时 ref 为 null，
  // 导致 isSupported 误判为 false 并错误触发"不支持语音"toast。
  if (!recognitionRef.current) {
    recognitionRef.current = new BrowserSpeechRecognition();
  }
  useEffect(() => {
    return () => {
      cleanupMedia();
      recognitionRef.current?.stop();
    };
  }, []);

  const getCombinedTranscript = (): string => {
    const all = [...committedWordsRef.current, ...interimWordsRef.current];
    return all.join(' ');
  };

  const syncPreview = (): void => {
    const committed = [...committedWordsRef.current];
    const interim = [...interimWordsRef.current];
    setPreviewWords({ committed, interim });
    setRecordingHasInterim(interim.length > 0);
    setRecordingPreview([...committed, ...interim].join(' '));
  };

  const cleanupMedia = useCallback((): void => {
    recogUnsubsRef.current.forEach((fn) => fn());
    recogUnsubsRef.current = [];
    vadUnsubsRef.current.forEach((fn) => fn());
    vadUnsubsRef.current = [];
    recognitionRef.current?.stop();
    silenceDetectorRef.current?.stop();
    silenceDetectorRef.current = null;
    // PCM 录制器：安全网释放（正常路径已在 finishRecording 中抽取并置空）
    pcmRecorderRef.current?.dispose();
    pcmRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  const finishRecording = useCallback((): void => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    const browserText = getCombinedTranscript();
    const pcmRecorder = pcmRecorderRef.current;
    pcmRecorderRef.current = null;

    cleanupMedia();

    committedWordsRef.current = [];
    interimWordsRef.current = [];
    hasSpokenRef.current = false;
    setRecordingPreview('');
    setPreviewWords(EMPTY_PREVIEW);
    setRecordingHasInterim(false);
    setRecording(false);
    finishingRef.current = false;

    // 异步：抽取 PCM → SenseVoice 转写（更准，失败回退浏览器识别）→ 回调
    void (async () => {
      let pcm: Int16Array = new Int16Array(0);
      if (pcmRecorder) {
        try {
          pcm = await pcmRecorder.stop();
        } catch (err) {
          console.warn('[useVoiceInput] PCM 抽取失败:', err);
        } finally {
          pcmRecorder.dispose();
        }
      }

      // 服务端 ASR 走通：服务端已经做过 normalizeTranscript，直接采用。
      // 失败 / 未启用：对浏览器拼出的 browserText 在前端做一次规范化作为兜底。
      let finalText = normalizeTranscript(browserText);
      if (useServerAsr && pcm.length > 0) {
        setIsTranscribing(true);
        try {
          const sense = await transcribeAudio(pcmToWavBlob(pcm, 16000));
          if (sense) finalText = sense;
        } catch (err) {
          console.warn('[useVoiceInput] SenseVoice 转写失败，回退浏览器识别:', err);
        } finally {
          setIsTranscribing(false);
        }
      }

      // 发音评测用最终（更准）转写作为参考文本
      if (pcm.length > 0 && onAudio && finalText.trim()) {
        onAudio(pcm, finalText);
      }
      if (finalText.trim()) {
        onTranscript(finalText);
      }
    })();
  }, [cleanupMedia, onAudio, onTranscript, setRecording, useServerAsr]);

  const isSupported = recognitionRef.current?.isSupported() ?? true;

  const startRecording = useCallback(async (): Promise<void> => {
    const recognition = recognitionRef.current;
    if (!recognition?.isSupported()) {
      onUnsupported?.();
      return;
    }

    beforeStart?.();
    cleanupMedia();

    committedWordsRef.current = [];
    interimWordsRef.current = [];
    hasSpokenRef.current = false;
    finishingRef.current = false;
    setRecordingPreview('');
    setPreviewWords(EMPTY_PREVIEW);
    setRecordingHasInterim(false);
    setRecording(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 并行启动 PCM 采集（发音评测 + SenseVoice 转写用），复用同一 MediaStream，不二次申请麦克风。
      // 失败/不支持不影响语音识别主流程。
      if ((onAudio || useServerAsr) && PcmRecorder.isSupported()) {
        const pcmRec = new PcmRecorder();
        try {
          await pcmRec.start(stream);
          pcmRecorderRef.current = pcmRec;
        } catch (err) {
          console.warn('[useVoiceInput] PCM 采集启动失败，跳过发音评测:', err);
          pcmRec.dispose();
          pcmRecorderRef.current = null;
        }
      }

      const detector = new SilenceDetector();
      silenceDetectorRef.current = detector;

      const offSpeech = detector.onSpeech(() => {
        hasSpokenRef.current = true;
      });
      const offSilence = detector.onSilence(() => {
        finishRecording();
      });
      vadUnsubsRef.current = [offSpeech, offSilence];
      detector.start(stream);

      const offResult = recognition.onResult((result) => {
        if (result.isFinal) {
          const words = splitWords(result.text);
          if (words.length > 0) {
            hasSpokenRef.current = true;
            committedWordsRef.current.push(...words);
          }
          interimWordsRef.current = [];
          syncPreview();
          silenceDetectorRef.current?.resetSilenceTimer();
        } else {
          const words = splitWords(result.text);
          // 同前一次 interim 切词完全一致时跳过 setState，避免 React 重渲染抖动。
          const prev = interimWordsRef.current;
          const same = words.length === prev.length && words.every((w, i) => w === prev[i]);
          if (same) return;
          interimWordsRef.current = words;
          if (words.length > 0) hasSpokenRef.current = true;
          syncPreview();
          silenceDetectorRef.current?.resetSilenceTimer();
        }
      });

      const offError = recognition.onError((error) => {
        if (error === 'no-speech' || error === 'aborted') {
          if (error === 'no-speech') finishRecording();
          return;
        }
        console.error('[useVoiceInput] recognition error:', error);
        finishRecording();
      });

      recogUnsubsRef.current = [offResult, offError];
      recognition.start();
    } catch (error) {
      console.error('[useVoiceInput] getUserMedia failed:', error);
      cleanupMedia();
      setRecording(false);
      throw error; // 让调用方展示错误提示
    }
  }, [beforeStart, cleanupMedia, finishRecording, onAudio, onUnsupported, setRecording, useServerAsr]);

  const stopRecording = useCallback((): void => {
    finishRecording();
  }, [finishRecording]);

  return {
    isSupported: recognitionRef.current?.isSupported() ?? false,
    recordingPreview,
    previewWords,
    recordingHasInterim,
    isTranscribing,
    startRecording,
    stopRecording,
    cleanup: cleanupMedia,
  };
}
