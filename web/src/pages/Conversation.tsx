import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { getActiveScenario } from '../lib/scenario';
import type { Scenario, Difficulty } from '@speak-coach/shared';

import { BrowserSpeechRecognition } from '../audio/speech-recognition';
import { SilenceDetector } from '../audio/silence-detector';
import { getCurrentEngine, getEngine } from '../audio/tts-engine';
import { initTtsEngines } from '../audio/tts-init';
import SettingsPanel from '../components/SettingsPanel';
import { streamChat, type ChatMessage } from '../llm/client';
import { generateReport } from '../llm/report-generator';
import { stripMarkdown } from '../llm/strip-markdown';
import { useSessionStore } from '../store/session';
import { useSettingsStore } from '../store/settings';
import { useStallDetector } from '../hooks/useStallDetector';
import { generateHints, type Hints } from '../llm/hint-generator';

initTtsEngines();

// 递台阶提示气泡暂时关闭（逻辑保留，后续再决定何时出现更合适）。设为 true 即可恢复。
const HINT_ENABLED = false;

const SCENARIO_EMOJI: Record<string, string> = {
  interview: '💼', meeting: '📋', presentation: '🎤', restaurant: '🍽️',
  doctor: '🩺', shopping: '🛍️', hotel: '🏨', smalltalk: '💬', ielts: '🎓', custom: '✨',
};

export default function Conversation() {
  const navigate = useNavigate();
  const {
    setSession, addTurn, setRecording,
    isAiSpeaking, setAiSpeaking, currentAiText,
    appendAiText, resetAiText, setReport,
    readingTurnId, setReadingTurnId,
  } = useSessionStore();

  const ttsEngineId = useSettingsStore((s) => s.ttsEngine);
  const setIflytekDisabled = useSettingsStore((s) => s.setIflytekDisabled);
  const setIflytekLastError = useSettingsStore((s) => s.setIflytekLastError);

  const isRecording = useSessionStore((s) => s.isRecording);
  const turns = useSessionStore((s) => s.turns);
  const [recordingPreview, setRecordingPreview] = useState('');
  const [recordingHasInterim, setRecordingHasInterim] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [hints, setHints] = useState<Hints | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recogUnsubsRef = useRef<Array<() => void>>([]);
  const vadUnsubsRef = useRef<Array<() => void>>([]);
  const silenceDetectorRef = useRef<SilenceDetector | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pendingTranscriptRef = useRef('');
  const lastInterimRef = useRef('');
  const hasSpokenRef = useRef(false);
  const finishingRef = useRef(false);
  const initializedRef = useRef(false);
  /** 朗读操作锁，防止重复点击导致多次 speak */
  const readingBusyRef = useRef(false);
  /** 打断代际：stopSpeaking 时递增，作废旧 speakReply 异步回调 */
  const interruptEpochRef = useRef(0);

  /** 停止全部已注册 TTS 引擎（仅停音频，不改 UI 状态） */
  const stopAllTts = useCallback(() => {
    getEngine('browser')?.stop();
    getEngine('iflytek')?.stop();
  }, []);

  /** 停止所有正在播放的 TTS（用于打断 AI） */
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
        if (!isVoiceIssue) {
          setIflytekDisabled(true);
        }
        if (speakEpoch !== interruptEpochRef.current) return;
        stopAllTts();
        if (speakEpoch !== interruptEpochRef.current) return;
        // 用浏览器引擎兜底朗读当前句，不打断对话
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
    // 点击当前正在朗读的消息 → 停止（不受 busy 锁限制，播放中必须可打断）
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

    // 点击其他消息 → 先停掉当前；若 AI 正在自动朗读也一并清掉
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
    const engine = getEngine(settings.ttsEngine) ?? getCurrentEngine();

    setReadingTurnId(turnId);
    engine.speak(text, {
      voice: settings.iflytekVoice,
      onEnd: () => {
        setReadingTurnId(null);
        readingBusyRef.current = false;
      },
      onError: (err) => {
        console.error('[Conversation.handleReadAloud] tts error, turnId:', turnId, err);
        setReadingTurnId(null);
        readingBusyRef.current = false;
      },
    });
  }, [readingTurnId, setReadingTurnId, stopAllTts, isAiSpeaking, setAiSpeaking]);

  // 初始化
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const recognition = new BrowserSpeechRecognition();
    recognitionRef.current = recognition;

    // #2 浏览器不支持语音识别 → 自动切到文字模式并提示
    if (!recognition.isSupported()) {
      setSpeechSupported(false);
      setInputMode('text');
      setNotice('当前浏览器不支持语音识别，已自动切换到文字模式。如需语音，请使用 Chrome。');
    }

    // 自动发开场白
    if (useSessionStore.getState().turns.length === 0) {
      const difficulty = (localStorage.getItem('difficulty') ?? 'intermediate') as Difficulty;
      const scenario = getActiveScenario();
      setSession('local-session', scenario.id, difficulty);

      generateGreeting(scenario).then((greeting) => {
        const greetingId = `greeting-${Date.now()}`;
        addTurn({ id: greetingId, sessionId: 'local-session', role: 'ai', text: greeting, timestamp: Date.now() });
        setAiSpeaking(true);
        speakReply(greetingId, greeting, () => setAiSpeaking(false));
      });
    }

    return () => {
      recogUnsubsRef.current.forEach((fn) => fn());
      recogUnsubsRef.current = [];
      vadUnsubsRef.current.forEach((fn) => fn());
      vadUnsubsRef.current = [];
      recognitionRef.current?.stop();
      silenceDetectorRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      getEngine('browser')?.stop();
      getEngine('iflytek')?.stop();
    };
  }, []);

  // 切换引擎时停掉旧引擎
  useEffect(() => {
    return () => {
      getEngine(ttsEngineId)?.stop();
    };
  }, [ttsEngineId]);

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, currentAiText, recordingPreview]);

  /** 生成开场白 */
  const generateGreeting = async (scenario: Scenario): Promise<string> => {
    const greetings: Record<string, string> = {
      interview: "Hi there! Welcome to your interview. I'm the hiring manager today. Let's start — could you tell me a little bit about yourself?",
      restaurant: "Hi! Welcome to our restaurant! Here's our menu. Can I start you off with something to drink?",
      meeting: "Good morning everyone. Let's get started with our weekly sync. Could you give us an update on your project?",
    };
    return (
      greetings[scenario.id] ??
      (scenario.id === 'custom'
        ? "Sure, let's chat! What's on your mind?"
        : "Hi! Let's get started — whenever you're ready, go ahead.")
    );
  };

  /** 构建发给 LLM 的消息（系统提示 + 最新历史 + 本轮输入） */
  const buildMessages = (scenario: Scenario, userText: string): ChatMessage[] => {
    const history = useSessionStore.getState().turns; // 读最新，避免闭包过期
    return [
      {
        role: 'system',
        content:
          scenario.rolePrompt +
          '\n\nConversation goal: ' + scenario.goal +
          '\n\nIMPORTANT style rules — this is a SPOKEN conversation:' +
          '\n- Stay fully in character at all times. Never break role to give writing tips, resume advice, or meta commentary.' +
          '\n- Reply the way a real person would SPEAK: short and natural, usually 1-2 sentences.' +
          '\n- Plain conversational text ONLY. Do NOT use markdown, bullet points, numbered lists, bold/asterisks, or headings.' +
          '\n- Ask one simple follow-up question to keep the conversation going.',
      },
      ...history.map((t) => ({
        role: (t.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: t.text,
      })),
      { role: 'user', content: userText },
    ];
  };

  /** 处理用户消息 */
  const handleUserMessage = async (text: string) => {
    if (!text.trim()) return;

    setHints(null);
    // 打断 AI（用户主动发话）
    stopSpeaking();

    const scenario = getActiveScenario();

    // 先用最新历史构建消息，再把用户消息入库（避免重复计入本轮）
    const messages = buildMessages(scenario, text);
    addTurn({ id: `user-${Date.now()}`, sessionId: 'local-session', role: 'user', text, timestamp: Date.now() });

    setIsLoading(true);
    setAiSpeaking(true);
    resetAiText();

    try {
      const reply = await streamChat(messages, (chunk) => appendAiText(chunk));
      // 清理掉模型可能残留的 markdown 符号，用于显示与朗读
      const finalReply = stripMarkdown(reply).trim() || "Sorry, I didn't catch that. Could you say it again?";
      const aiTurnId = `ai-${Date.now()}`;
      addTurn({ id: aiTurnId, sessionId: 'local-session', role: 'ai', text: finalReply, timestamp: Date.now() });
      resetAiText();

      speakReply(aiTurnId, finalReply, () => setAiSpeaking(false));
    } catch (err) {
      // #5/#6 把真实错误暴露出来（控制台 + 顶部提示），不再静默双重失败
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[Conversation] LLM 调用失败:', detail);
      setNotice(`AI 回复失败：${detail}`);
      addTurn({
        id: `ai-${Date.now()}`,
        sessionId: 'local-session',
        role: 'ai',
        text: "I'm having trouble responding right now. Please try again in a moment.",
        timestamp: Date.now(),
      });
      resetAiText();
      setAiSpeaking(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getCombinedTranscript = (): string => {
    const pending = pendingTranscriptRef.current.trim();
    const interim = lastInterimRef.current.trim();
    if (pending && interim) {
      return `${pending} ${interim}`;
    }
    return pending || interim;
  };

  const syncRecordingPreview = (): void => {
    const interim = lastInterimRef.current.trim();
    setRecordingHasInterim(!!interim);
    setRecordingPreview(getCombinedTranscript());
  };

  const cleanupRecordingResources = (): void => {
    recogUnsubsRef.current.forEach((fn) => fn());
    recogUnsubsRef.current = [];
    vadUnsubsRef.current.forEach((fn) => fn());
    vadUnsubsRef.current = [];
    recognitionRef.current?.stop();
    silenceDetectorRef.current?.stop();
    silenceDetectorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const finishRecording = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    const text = getCombinedTranscript();
    cleanupRecordingResources();

    pendingTranscriptRef.current = '';
    lastInterimRef.current = '';
    hasSpokenRef.current = false;
    setRecordingPreview('');
    setRecordingHasInterim(false);
    setRecording(false);
    finishingRef.current = false;

    if (text.trim()) {
      void handleUserMessage(text);
    }
  }, [setRecording]);

  const handleStopRecording = useCallback(() => {
    finishRecording();
  }, [finishRecording]);

  const handleStartRecording = useCallback(async () => {
    const recognition = recognitionRef.current;
    if (!recognition?.isSupported()) {
      setSpeechSupported(false);
      setInputMode('text');
      setNotice('当前浏览器不支持语音识别，已自动切换到文字模式。如需语音，请使用 Chrome。');
      return;
    }

    stopSpeaking();

    cleanupRecordingResources();

    pendingTranscriptRef.current = '';
    lastInterimRef.current = '';
    hasSpokenRef.current = false;
    finishingRef.current = false;
    setRecordingPreview('');
    setRecordingHasInterim(false);
    setHints(null);
    setRecording(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

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
          const chunk = result.text.trim();
          if (chunk) {
            hasSpokenRef.current = true;
            pendingTranscriptRef.current = pendingTranscriptRef.current
              ? `${pendingTranscriptRef.current} ${chunk}`
              : chunk;
          }
          lastInterimRef.current = '';
          syncRecordingPreview();
          silenceDetectorRef.current?.resetSilenceTimer();
        } else if (result.text !== lastInterimRef.current) {
          lastInterimRef.current = result.text;
          if (result.text.trim()) {
            hasSpokenRef.current = true;
          }
          syncRecordingPreview();
          silenceDetectorRef.current?.resetSilenceTimer();
        }
      });

      const offError = recognition.onError((error) => {
        if (error === 'no-speech' || error === 'aborted') {
          if (error === 'no-speech') {
            finishRecording();
          }
          return;
        }
        console.error('[Conversation.handleStartRecording] recognition error:', error);
        finishRecording();
      });

      recogUnsubsRef.current = [offResult, offError];
      recognition.start();
    } catch (error) {
      console.error('[Conversation.handleStartRecording] getUserMedia failed:', error);
      setNotice('无法访问麦克风，请检查权限。');
      cleanupRecordingResources();
      setRecording(false);
    }
  }, [stopSpeaking, setRecording, finishRecording]);

  /** 结束会话，生成报告 */
  const handleEndSession = async () => {
    if (isEnding) return; // 防重复点击导致重复生成报告
    setIsEnding(true);

    // 结束会话时立即停止正在播放的语音（生成报告不需要朗读）
    stopSpeaking();
    cleanupRecordingResources();
    setRecording(false);

    setNotice('正在生成报告…');
    try {
      // #4 读取最新 turns，避免闭包过期
      const latestTurns = useSessionStore.getState().turns;
      const report = await generateReport(latestTurns, 'local-session');
      setReport(report as never);
      navigate('/report');
    } catch (err) {
      console.error('[Conversation] 生成报告失败:', err);
      setNotice('生成报告失败，请重试。');
      setIsEnding(false);
    }
  };

  /** 卡壳时生成"递台阶"提示（失败静默忽略） */
  const handleStall = useCallback(async () => {
    const latestTurns = useSessionStore.getState().turns;
    const lastAi = [...latestTurns].reverse().find((t) => t.role === 'ai');
    if (!lastAi) return;
    const diff = (localStorage.getItem('difficulty') ?? 'intermediate') as Difficulty;
    const scenario = getActiveScenario();
    setHintLoading(true);
    const result = await generateHints(scenario, lastAi.text, diff);
    setHintLoading(false);
    // 仅当用户此刻仍空闲（未开始录音）时才展示，避免打扰
    if (result && !useSessionStore.getState().isRecording) setHints(result);
  }, []);

  // 用户卡壳（默认 6s 静默）时主动递台阶；AI 朗读/思考/录音/已有提示时不计时
  const lastTurn = turns[turns.length - 1];
  const idleForHint =
    !!lastTurn && lastTurn.role === 'ai' &&
    !isRecording && !isLoading && !isAiSpeaking &&
    textInput.trim() === '' && !hints && !hintLoading;
  useStallDetector({ active: HINT_ENABLED && idleForHint, resetKey: turns.length, onStall: handleStall });

  const activeScenario = getActiveScenario();
  const scenarioId = activeScenario.id;
  const scenarioName = activeScenario.title;

  // isLoading：LLM 正在生成 token（此时不允许录音）；
  // isAiSpeaking 但非 isLoading：TTS 播放中，允许点击麦克风打断。
  const micDisabled = isLoading;
  const sendDisabled = isLoading;

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
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>
                  </div>
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
                </div>
              ) : (
                <div className="max-w-[75%] px-4 py-2.5 rounded-2xl bg-indigo-600 text-white rounded-br-md">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>
                </div>
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
                  {stripMarkdown(currentAiText)}
                  <span className="animate-pulse text-indigo-400">|</span>
                </p>
              </div>
            </div>
          )}

          {/* 录音中的识别预览（已确认 + 进行中） */}
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

        {/* 递台阶提示（非模态，不打断对话） */}
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
                  onClick={() => { setHints(null); handleUserMessage(s); }}
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
            /* Voice controls */
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
            /* Text input */
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => { setTextInput(e.target.value); if (e.target.value) setHints(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && textInput.trim() && !sendDisabled) {
                    e.preventDefault();
                    handleUserMessage(textInput.trim());
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
                    handleUserMessage(textInput.trim());
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
    </div>
  );
}
