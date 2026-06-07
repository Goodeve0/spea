import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { getActiveScenario } from '../lib/scenario';
import type { Difficulty } from '@speak-coach/shared';

import { getEngine, getCurrentEngine } from '../audio/tts-engine';
import { initTtsEngines } from '../audio/tts-init';
import SettingsPanel from '../components/SettingsPanel';
import { generateReport, mergeAcousticScores } from '../llm/report-generator';
import { stripMarkdown, stripStageDirections } from '../llm/strip-markdown';
import { useSessionStore } from '../store/session';
import { useSettingsStore } from '../store/settings';
import { useStallDetector } from '../hooks/useStallDetector';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useConversationLlm } from '../hooks/useConversationLlm';
import { useTypewriter } from '../hooks/useTypewriter';
import { generateHints, type Hints } from '../llm/hint-generator';
import { translateToZh } from '../llm/translate';
import { assessPronunciation } from '../api/pronunciation';
import { pcmToWavBlob } from '../audio/pcm-recorder';
import WordableText from '../components/WordableText';
import WordPopover from '../components/WordPopover';

initTtsEngines();

const SCENARIO_EMOJI: Record<string, string> = {
  interview: '💼', meeting: '📋', presentation: '🎤', restaurant: '🍽️',
  doctor: '🩺', shopping: '🛍️', hotel: '🏨', smalltalk: '💬', ielts: '🎓', custom: '✨',
};

// ── 开场白静态映射（LLM 无需为此做一次 round-trip）────────────────────────
const GREETINGS: Record<string, string> = {
  interview: "Hi there! Welcome to your interview. I'm the hiring manager today. Let's start — could you tell me a little bit about yourself?",
  restaurant: "Hi! Welcome to our restaurant! Here's our menu. Can I start you off with something to drink?",
  meeting: "Good morning everyone. Let's get started with our weekly sync. Could you give us an update on your project?",
};

function getGreeting(scenarioId: string): string {
  return (
    GREETINGS[scenarioId] ??
    (scenarioId === 'custom'
      ? "Sure, let's chat! What's on your mind?"
      : "Hi! Let's get started — whenever you're ready, go ahead.")
  );
}

export default function Conversation() {
  const navigate = useNavigate();
  const {
    setSession, addTurn, setRecording,
    isAiSpeaking, setAiSpeaking, currentAiText,
    resetAiText, setReport,
    readingTurnId, setReadingTurnId,
    addPronunciation,
  } = useSessionStore();
  const pronunciationScores = useSessionStore((s) => s.pronunciationScores);

  const setIflytekDisabled = useSettingsStore((s) => s.setIflytekDisabled);
  const setIflytekLastError = useSettingsStore((s) => s.setIflytekLastError);
  const hintEnabled = useSettingsStore((s) => s.hintEnabled);

  const isRecording = useSessionStore((s) => s.isRecording);
  const turns = useSessionStore((s) => s.turns);

  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [hints, setHints] = useState<Hints | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  /** 各 AI 消息的中文翻译（turnId → 译文）；存在即展示 */
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  /** 各用户发言的录音回放 URL（turnId → wav object URL） */
  const [recordings, setRecordings] = useState<Record<string, string>>({});
  /** 正在评测中的用户发言 turnId 集合（用于显示"评分中…"） */
  const [assessingIds, setAssessingIds] = useState<string[]>([]);
  /** 查词弹层（点击对话单词时打开） */
  const [wordPopover, setWordPopover] = useState<{ word: string; context: string; rect: DOMRect } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  /** 朗读操作锁，防止重复点击导致多次 speak */
  const readingBusyRef = useRef(false);
  /** 打断代际：stopSpeaking 时递增，作废旧 speakReply 异步回调 */
  const interruptEpochRef = useRef(0);

  const activeScenario = getActiveScenario();

  // ── TTS 控制 ──────────────────────────────────────────────────────────────
  const stopAllTts = useCallback(() => {
    getEngine('browser')?.stop();
    getEngine('iflytek')?.stop();
  }, []);

  const stopSpeaking = useCallback(() => {
    interruptEpochRef.current += 1;
    stopAllTts();
    setAiSpeaking(false);
    setReadingTurnId(null);
    readingBusyRef.current = false;
  }, [stopAllTts, setAiSpeaking, setReadingTurnId]);

  const speakReply = useCallback((turnId: string, text: string, onEnd?: () => void) => {
    stopAllTts();
    const speakEpoch = interruptEpochRef.current;
    const settings = useSettingsStore.getState();
    const engineId = settings.ttsEngine;
    const engine = getEngine(engineId) ?? getCurrentEngine();

    setReadingTurnId(turnId);
    engine.speak(text, {
      voice: settings.iflytekVoice,
      onEnd: () => {
        if (speakEpoch !== interruptEpochRef.current) return;
        setReadingTurnId(null);
        onEnd?.();
      },
      onError: (err) => {
        if (speakEpoch !== interruptEpochRef.current) return;
        console.error('[Conversation.speakReply] tts error, engineId:', engineId, err);
        setReadingTurnId(null);
        if (engineId !== 'iflytek') return;

        setIflytekLastError(err.message);
        const isVoiceIssue = /11119|vcn|voice|发音人/i.test(err.message);
        if (!isVoiceIssue) setIflytekDisabled(true);

        if (speakEpoch !== interruptEpochRef.current) return;
        stopAllTts();
        if (speakEpoch !== interruptEpochRef.current) return;
        // 浏览器引擎兜底
        setReadingTurnId(turnId);
        getEngine('browser')?.speak(text, {
          onEnd: () => {
            if (speakEpoch !== interruptEpochRef.current) return;
            setReadingTurnId(null);
            onEnd?.();
          },
        });
      },
    });
  }, [stopAllTts, setReadingTurnId, setIflytekDisabled, setIflytekLastError]);

  /** 朗读指定消息（按 turnId 切换播放/停止） */
  const handleReadAloud = useCallback((turnId: string, text: string) => {
    if (readingTurnId === turnId) {
      interruptEpochRef.current += 1;
      stopAllTts();
      setReadingTurnId(null);
      setAiSpeaking(false);
      readingBusyRef.current = false;
      return;
    }
    if (readingBusyRef.current) return;
    readingBusyRef.current = true;

    if (readingTurnId) {
      interruptEpochRef.current += 1;
      stopAllTts();
      if (isAiSpeaking) setAiSpeaking(false);
      setReadingTurnId(null);
    }
    if (!text.trim()) {
      readingBusyRef.current = false;
      return;
    }

    const settings = useSettingsStore.getState();
    const engineId = settings.ttsEngine;
    const engine = getEngine(engineId) ?? getCurrentEngine();
    setReadingTurnId(turnId);

    // 浏览器引擎兜底：讯飞失败时回退；浏览器再失败则给出可见提示
    const playBrowserFallback = () => {
      const browser = getEngine('browser');
      if (!browser) {
        setReadingTurnId(null);
        readingBusyRef.current = false;
        setNotice('当前浏览器不支持朗读功能。');
        return;
      }
      setReadingTurnId(turnId);
      browser.speak(text, {
        rate: settings.playbackSpeed,
        onEnd: () => { setReadingTurnId(null); readingBusyRef.current = false; },
        onError: (e) => {
          console.error('[Conversation.handleReadAloud] browser fallback failed:', e);
          setReadingTurnId(null);
          readingBusyRef.current = false;
          setNotice('朗读失败：浏览器语音合成不可用。请确认系统已安装英文语音，或刷新页面重试。');
        },
      });
    };

    engine.speak(text, {
      voice: settings.iflytekVoice,
      rate: settings.playbackSpeed,
      onEnd: () => { setReadingTurnId(null); readingBusyRef.current = false; },
      onError: (err) => {
        console.error('[Conversation.handleReadAloud] tts error, engineId:', engineId, err);
        if (engineId === 'iflytek') {
          setIflytekLastError(err.message);
          const isVoiceIssue = /11119|vcn|voice|发音人/i.test(err.message);
          if (!isVoiceIssue) setIflytekDisabled(true);
          stopAllTts();
          playBrowserFallback();
        } else {
          // 已是浏览器引擎仍失败 → 可见提示，便于定位
          setReadingTurnId(null);
          readingBusyRef.current = false;
          setNotice('朗读失败：浏览器语音合成不可用。请确认系统已安装英文语音，或刷新页面重试。');
        }
      },
    });
  }, [readingTurnId, setReadingTurnId, stopAllTts, isAiSpeaking, setAiSpeaking, setIflytekDisabled, setIflytekLastError]);

  /** 翻译/收起某条 AI 消息的中文（已展示则收起；未翻译则请求） */
  const handleTranslate = useCallback(async (turnId: string, text: string) => {
    // 已显示 → 收起
    if (translations[turnId] !== undefined) {
      setTranslations((m) => {
        const next = { ...m };
        delete next[turnId];
        return next;
      });
      return;
    }
    if (!text.trim()) return;
    setTranslatingId(turnId);
    try {
      const zh = await translateToZh(text);
      setTranslations((m) => ({ ...m, [turnId]: zh }));
    } catch (err) {
      console.error('[Conversation.handleTranslate] 翻译失败:', err);
      setNotice('翻译失败，请稍后重试。');
    } finally {
      setTranslatingId(null);
    }
  }, [translations]);

  /** 播放某条用户发言的录音回放 */
  const playRecording = useCallback((turnId: string) => {
    const url = recordings[turnId];
    if (!url) return;
    const audio = new Audio(url);
    audio.play().catch((e) => console.warn('[Conversation] 录音回放失败:', e));
  }, [recordings]);

  // 卸载时回收所有录音 object URL，避免内存泄漏
  const recordingsRef = useRef(recordings);
  recordingsRef.current = recordings;
  useEffect(
    () => () => {
      Object.values(recordingsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  // ── Hook：语音输入 ─────────────────────────────────────────────────────────
  const {
    isSupported: speechSupported,
    recordingPreview,
    recordingHasInterim,
    startRecording: startVoice,
    stopRecording: stopVoice,
    cleanup: cleanupVoice,
  } = useVoiceInput({
    onTranscript: (text) => void handleUserMessage(text),
    onAudio: (pcm, transcript) => {
      // onTranscript 已同步创建用户 turn，这里按文本匹配回填 turnId
      const turns = useSessionStore.getState().turns;
      const userTurn = [...turns].reverse().find(
        (t) => t.role === 'user' && t.text === transcript,
      );
      const turnId = userTurn?.id ?? '';
      if (!turnId) return;

      // 录音回放：PCM → WAV object URL，按 turnId 存储
      try {
        const url = URL.createObjectURL(pcmToWavBlob(pcm, 16000));
        setRecordings((m) => ({ ...m, [turnId]: url }));
      } catch (e) {
        console.warn('[Conversation] 录音封装失败:', e);
      }

      // 异步评测，不阻塞对话；成功则累积声学分（实时显示在该句下方）
      setAssessingIds((ids) => [...ids, turnId]);
      void assessPronunciation(pcm, transcript, turnId)
        .then((result) => {
          if (result) addPronunciation(result);
        })
        .finally(() => {
          setAssessingIds((ids) => ids.filter((id) => id !== turnId));
        });
    },
    onUnsupported: () => {
      setInputMode('text');
      setNotice('当前浏览器不支持语音识别，已自动切换到文字模式。如需语音，请使用 Chrome。');
    },
    beforeStart: () => stopSpeaking(),
  });

  // ── Hook：LLM 交互 ─────────────────────────────────────────────────────────
  const { isLoading, handleUserMessage } = useConversationLlm({
    scenario: activeScenario,
    onAiReply: (turnId, text) => speakReply(turnId, text, () => setAiSpeaking(false)),
    onError: (msg) => setNotice(msg),
    onBeforeMessage: () => {
      setHints(null);
      stopSpeaking();
    },
  });

  // ── 初始化：开场白 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!speechSupported) {
      setInputMode('text');
      setNotice('当前浏览器不支持语音识别，已自动切换到文字模式。如需语音，请使用 Chrome。');
    }

    if (useSessionStore.getState().turns.length === 0) {
      const difficulty = (localStorage.getItem('difficulty') ?? 'intermediate') as Difficulty;
      setSession('local-session', activeScenario.id, difficulty);

      const greeting = getGreeting(activeScenario.id);
      const greetingId = `greeting-${Date.now()}`;
      addTurn({ id: greetingId, sessionId: 'local-session', role: 'ai', text: greeting, timestamp: Date.now() });
      setAiSpeaking(true);
      speakReply(greetingId, greeting, () => setAiSpeaking(false));
    }

    return () => {
      cleanupVoice();
      stopAllTts();
      setRecording(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 流式文本打字机平滑（把多词块跳变变成逐字递增）
  const typedAiText = useTypewriter(currentAiText);

  // ── 自动滚动 ───────────────────────────────────────────────────────────────
  // 流式打字过程中用即时滚动（避免每帧 smooth 动画相互打断造成"抖动"感）；
  // 轮次变化时用平滑滚动。
  useEffect(() => {
    const streaming = currentAiText.length > 0;
    chatEndRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' });
  }, [turns, typedAiText, recordingPreview, currentAiText]);

  // ── 语音操作（含错误提示）─────────────────────────────────────────────────
  const handleStartRecording = useCallback(async () => {
    try {
      await startVoice();
    } catch {
      setNotice('无法访问麦克风，请检查权限。');
    }
  }, [startVoice]);

  const handleStopRecording = useCallback(() => stopVoice(), [stopVoice]);

  // ── 结束会话 ───────────────────────────────────────────────────────────────
  const handleEndSession = async () => {
    if (isEnding) return;
    setIsEnding(true);

    stopSpeaking();
    cleanupVoice();
    setRecording(false);

    setNotice('正在生成报告…');
    try {
      const latestTurns = useSessionStore.getState().turns;
      const baseReport = await generateReport(latestTurns, 'local-session');
      // 用真实声学评测分覆盖 LLM 估算的发音分（无录音则标记 'none'）
      const acoustic = useSessionStore.getState().pronunciationScores.map((p) => ({
        accuracy: p.accuracy,
        fluency: p.fluency,
        wordScores: p.wordScores,
      }));
      const report = mergeAcousticScores(baseReport, acoustic);
      setReport(report as never);
      navigate('/report');
    } catch (err) {
      console.error('[Conversation] 生成报告失败:', err);
      setNotice('生成报告失败，请重试。');
      setIsEnding(false);
    }
  };

  // ── 卡壳提示 ───────────────────────────────────────────────────────────────
  const handleStall = useCallback(async () => {
    const latestTurns = useSessionStore.getState().turns;
    const lastAi = [...latestTurns].reverse().find((t) => t.role === 'ai');
    if (!lastAi) return;
    const diff = (localStorage.getItem('difficulty') ?? 'intermediate') as Difficulty;
    setHintLoading(true);
    const result = await generateHints(activeScenario, lastAi.text, diff);
    setHintLoading(false);
    if (result && !useSessionStore.getState().isRecording) setHints(result);
  }, [activeScenario]);

  const lastTurn = turns[turns.length - 1];
  const idleForHint =
    !!lastTurn && lastTurn.role === 'ai' &&
    !isRecording && !isLoading && !isAiSpeaking &&
    textInput.trim() === '' && !hints && !hintLoading;
  useStallDetector({ active: hintEnabled && idleForHint, resetKey: turns.length, onStall: handleStall });

  const micDisabled = isLoading;
  const sendDisabled = isLoading;
  const scenarioId = activeScenario.id;
  const scenarioName = activeScenario.title;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      <div className="max-w-3xl mx-auto px-4 py-4 h-screen flex flex-col w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-lg">
              {SCENARIO_EMOJI[scenarioId] ?? '🎯'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{scenarioName}</h1>
              <p className="text-xs text-gray-400">Speak or type in English</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              title="设置"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              ⚙️
            </button>
            <button
              onClick={handleEndSession}
              disabled={isEnding}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors border border-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isEnding ? '生成报告中…' : 'End Session'}
            </button>
          </div>
        </div>

        {/* Notice banner */}
        {notice && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
            <span>⚠️</span>
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} className="text-amber-500 hover:text-amber-700">×</button>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-3 px-1 py-2">
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'} items-center gap-2`}
            >
              {turn.role === 'ai' && (
                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                  🤖
                </div>
              )}
              {turn.role === 'ai' ? (
                <div className="flex flex-col items-start gap-1 max-w-[75%]">
                  <div className="px-4 py-2.5 rounded-2xl bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-md">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      <WordableText
                        text={turn.text}
                        onWordClick={(word, context, rect) => setWordPopover({ word, context, rect })}
                      />
                    </p>
                    {translations[turn.id] && (
                      <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap mt-1.5 pt-1.5 border-t border-gray-100">
                        {translations[turn.id]}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleReadAloud(turn.id, turn.text)}
                      disabled={isLoading}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                        readingTurnId === turn.id
                          ? 'text-indigo-600 bg-indigo-50'
                          : isLoading
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                      }`}
                      title={readingTurnId === turn.id ? '停止朗读' : '朗读'}
                    >
                      <span>{readingTurnId === turn.id ? '🔊' : '🔈'}</span>
                      <span>{readingTurnId === turn.id ? '正在朗读…' : '朗读'}</span>
                    </button>
                    <button
                      onClick={() => void handleTranslate(turn.id, turn.text)}
                      disabled={translatingId === turn.id}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                        translations[turn.id]
                          ? 'text-indigo-600 bg-indigo-50'
                          : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                      }`}
                      title="中文翻译"
                    >
                      <span>🌐</span>
                      <span>
                        {translatingId === turn.id ? '翻译中…' : translations[turn.id] ? '隐藏翻译' : '译'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                (() => {
                  const pron = pronunciationScores.find((p) => p.turnId === turn.id);
                  const assessing = assessingIds.includes(turn.id);
                  const hasRecording = !!recordings[turn.id];
                  const scoreColor = pron
                    ? pron.accuracy >= 80
                      ? 'text-green-600'
                      : pron.accuracy >= 60
                        ? 'text-amber-600'
                        : 'text-red-500'
                    : '';
                  return (
                    <div className="flex flex-col items-end gap-1 max-w-[75%]">
                      <div className="px-4 py-2.5 rounded-2xl bg-indigo-600 text-white rounded-br-md">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>
                      </div>
                      {(pron || assessing || hasRecording) && (
                        <div className="flex items-center gap-2">
                          {hasRecording && (
                            <button
                              onClick={() => playRecording(turn.id)}
                              className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="回放我的录音"
                            >
                              <span>▶️</span>
                              <span>回放</span>
                            </button>
                          )}
                          {assessing && (
                            <span className="text-xs text-gray-400">发音评分中…</span>
                          )}
                          {pron && (
                            <span className={`text-xs font-bold ${scoreColor}`} title="本句发音评分（声学）">
                              🎙️ 发音 {pron.accuracy} 分
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
              {turn.role === 'user' && (
                <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                  👤
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && !currentAiText && (
            <div className="flex justify-start items-center gap-2">
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                🤖
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white shadow-sm border border-gray-100 rounded-bl-md">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}

          {/* 当前 AI 流式文本 */}
          {currentAiText && (
            <div className="flex justify-start items-center gap-2">
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                🤖
              </div>
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-md">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {stripStageDirections(stripMarkdown(typedAiText))}
                  <span className="animate-pulse text-indigo-400">|</span>
                </p>
              </div>
            </div>
          )}

          {/* 录音中的识别预览 */}
          {isRecording && recordingPreview && (
            <div className="flex justify-end items-center gap-2">
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl bg-indigo-100 text-indigo-900 rounded-br-md opacity-70">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {recordingPreview}
                  {recordingHasInterim && <span className="italic">...</span>}
                </p>
              </div>
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                👤
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 递台阶提示 */}
        {hints && (
          <div className="mb-2 animate-pop-in rounded-2xl border border-primary/40 bg-primary-light/70 p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-primary-dark">
              <span>💡 卡住了？试试这样说</span>
              {hints.opener && <span className="font-normal text-sub">「{hints.opener}…」</span>}
              <button onClick={() => setHints(null)} className="ml-auto text-sub hover:text-ink" aria-label="关闭提示">×</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {hints.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setHints(null); void handleUserMessage(s); }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-line text-sm text-ink hover:border-primary hover:bg-primary-light transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="bg-white/80 backdrop-blur-sm rounded-t-2xl border-t border-gray-200 pt-3 pb-3 px-2">
          {/* Mode toggle */}
          <div className="flex justify-center gap-2 mb-3">
            <button
              onClick={() => { setInputMode('voice'); handleStopRecording(); }}
              disabled={!speechSupported}
              title={speechSupported ? undefined : '当前浏览器不支持语音识别'}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                inputMode === 'voice' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
              } ${!speechSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              🎤 Voice
            </button>
            <button
              onClick={() => { setInputMode('text'); handleStopRecording(); }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                inputMode === 'text' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              ⌨️ Type
            </button>
          </div>

          {inputMode === 'voice' ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={micDisabled}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all shadow-lg ${
                  isRecording
                    ? 'bg-red-500 text-white scale-110 shadow-red-200 animate-pulse'
                    : micDisabled
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {isRecording ? '⏹' : '🎤'}
              </button>
              <span className="text-xs text-gray-400">
                {isRecording ? 'Tap to stop' : micDisabled ? 'Thinking...' : isAiSpeaking ? 'Tap to interrupt & speak' : 'Tap to speak'}
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => { setTextInput(e.target.value); if (e.target.value) setHints(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && textInput.trim() && !sendDisabled) {
                    e.preventDefault();
                    void handleUserMessage(textInput.trim());
                    setTextInput('');
                  }
                }}
                placeholder="Type your message in English..."
                disabled={sendDisabled}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm disabled:opacity-50"
              />
              <button
                onClick={() => {
                  if (textInput.trim() && !sendDisabled) {
                    void handleUserMessage(textInput.trim());
                    setTextInput('');
                  }
                }}
                disabled={sendDisabled || !textInput.trim()}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center text-xs text-gray-400 pb-1 h-5 mt-1">
          {isRecording && '🔴 Listening...'}
          {isAiSpeaking && !isRecording && !isLoading && '🔊 AI is speaking...'}
          {isLoading && !isRecording && '💭 Thinking...'}
        </div>
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {wordPopover && (
        <WordPopover
          word={wordPopover.word}
          context={wordPopover.context}
          rect={wordPopover.rect}
          scenarioId={scenarioId}
          onClose={() => setWordPopover(null)}
        />
      )}
    </div>
  );
}
