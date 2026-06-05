import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { PRESET_SCENARIOS } from '@speak-coach/shared';
import type { Scenario, Difficulty } from '@speak-coach/shared';

import { BrowserSpeechRecognition } from '../audio/speech-recognition';
import { getCurrentEngine, getEngine } from '../audio/tts-engine';
import { initTtsEngines } from '../audio/tts-init';
import SettingsPanel from '../components/SettingsPanel';
import { useSessionStore } from '../store/session';
import { useSettingsStore } from '../store/settings';

initTtsEngines();

export default function Conversation() {
  const navigate = useNavigate();
  const {
    sessionId, setSession, addTurn, setRecording,
    isAiSpeaking, setAiSpeaking, currentAiText,
    appendAiText, resetAiText, setReport, reset,
  } = useSessionStore();

  const ttsEngineId = useSettingsStore((s) => s.ttsEngine);
  const iflytekVoice = useSettingsStore((s) => s.iflytekVoice);
  const setIflytekDisabled = useSettingsStore((s) => s.setIflytekDisabled);
  const setIflytekLastError = useSettingsStore((s) => s.setIflytekLastError);

  const isRecording = useSessionStore((s) => s.isRecording);
  const turns = useSessionStore((s) => s.turns);
  const [partialText, setPartialText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const initializedRef = useRef(false);

  const speakReply = useCallback((text: string, onEnd?: () => void) => {
    const settings = useSettingsStore.getState();
    const engineId = settings.ttsEngine;
    const engine = getEngine(engineId) ?? getCurrentEngine();

    engine.speak(text, {
      voice: settings.iflytekVoice,
      onEnd,
      onError: (err) => {
        console.error('[Conversation.speakReply] tts error, engineId:', engineId, err);
        if (engineId !== 'iflytek') return;

        // 记录错误信息供 SettingsPanel 展示
        setIflytekLastError(err.message);

        // 区分"引擎级失败（如鉴权/连接）"与"音色级失败（vcn 未授权）"
        const isVoiceIssue = /11119|vcn|voice|发音人/i.test(err.message);
        if (!isVoiceIssue) {
          setIflytekDisabled(true);
        }

        // 用浏览器引擎朗读当前句，不打断对话
        const fallback = getEngine('browser');
        fallback?.speak(text, { onEnd });
      },
    });
  }, [setIflytekDisabled, setIflytekLastError]);

  // 初始化
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    recognitionRef.current = new BrowserSpeechRecognition();

    // 自动发开场白
    if (turns.length === 0) {
      const scenarioId = localStorage.getItem('scenarioId') ?? 'interview';
      const difficulty = (localStorage.getItem('difficulty') ?? 'intermediate') as Difficulty;
      const scenario = PRESET_SCENARIOS.find((s) => s.id === scenarioId) ?? PRESET_SCENARIOS[0];
      setSession('local-session', scenarioId, difficulty);

      // 生成开场白
      generateGreeting(scenario).then((greeting) => {
        addTurn({ id: `greeting-${Date.now()}`, sessionId: 'local-session', role: 'ai', text: greeting, timestamp: Date.now() });
        speakReply(greeting);
      });
    }

    return () => {
      recognitionRef.current?.stop();
      const engine = getEngine('browser');
      engine?.stop();
      const iflytek = getEngine('iflytek');
      iflytek?.stop();
    };
  }, []);

  // 切换引擎时停掉旧引擎
  useEffect(() => {
    return () => {
      const engine = getEngine(ttsEngineId);
      engine?.stop();
    };
  }, [ttsEngineId]);

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, currentAiText, partialText]);

  /** 生成开场白 */
  const generateGreeting = async (scenario: Scenario): Promise<string> => {
    const greetings: Record<string, string> = {
      interview: "Hi there! Welcome to your interview. I'm the hiring manager today. Let's start — could you tell me a little bit about yourself?",
      restaurant: "Hi! Welcome to our restaurant! Here's our menu. Can I start you off with something to drink?",
      meeting: "Good morning everyone. Let's get started with our weekly sync. Could you give us an update on your project?",
    };
    return greetings[scenario.id] ?? "Hello! Let's get started. Please tell me about yourself.";
  };

  /** 开始录音 */
  const handleStartRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition?.isSupported()) {
      alert('Your browser does not support speech recognition. Please use Chrome.');
      return;
    }

    setPartialText('');
    setRecording(true);

    recognition.onResult((result) => {
      if (result.isFinal) {
        setPartialText('');
        setRecording(false);
        recognition.stop();
        // 发送用户文本到 LLM
        handleUserMessage(result.text);
      } else {
        setPartialText(result.text);
      }
    });

    recognition.onError((error) => {
      console.error('Recognition error:', error);
      setRecording(false);
      if (error !== 'no-speech' && error !== 'aborted') {
        setPartialText('');
      }
    });

    recognition.start();
  }, []);

  /** 停止录音 */
  const handleStopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  /** 处理用户消息 */
  const handleUserMessage = async (text: string) => {
    if (!text.trim()) return;

    // 添加用户消息
    addTurn({ id: `user-${Date.now()}`, sessionId: 'local-session', role: 'user', text, timestamp: Date.now() });

    // 调用 LLM（流式）
    setIsLoading(true);
    setAiSpeaking(true);
    resetAiText();

    try {
      const scenarioId = localStorage.getItem('scenarioId') ?? 'interview';
      const scenario = PRESET_SCENARIOS.find((s) => s.id === scenarioId) ?? PRESET_SCENARIOS[0];

      const reply = await callLlmStream(scenario, text, (chunk) => {
        appendAiText(chunk);
      });

      // 添加 AI 消息
      addTurn({ id: `ai-${Date.now()}`, sessionId: 'local-session', role: 'ai', text: reply, timestamp: Date.now() });
      resetAiText();

      // 语音播放
      speakReply(reply, () => {
        setAiSpeaking(false);
      });
    } catch (err) {
      console.error('LLM call failed:', err);
      addTurn({ id: `ai-${Date.now()}`, sessionId: 'local-session', role: 'ai', text: "I'm sorry, I didn't catch that. Could you try again?", timestamp: Date.now() });
      resetAiText();
      setAiSpeaking(false);
    }

    setIsLoading(false);
  };

  /** 调用 LLM API（SSE 流式，逐 token 显示） */
  const callLlmStream = async (
    scenario: Scenario,
    userText: string,
    onChunk: (text: string) => void,
  ): Promise<string> => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const baseUrl = import.meta.env.VITE_OPENAI_BASE_URL;
    const model = import.meta.env.VITE_LLM_MODEL ?? 'deepseek-v3';

    // 构建对话历史
    const messages = [
      {
        role: 'system' as const,
        content: scenario.rolePrompt + '\n\nConversation goal: ' + scenario.goal + '\nKeep responses concise (1-3 sentences). Stay in character.',
      },
      ...turns.map((t) => ({
        role: (t.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: t.text,
      })),
      { role: 'user' as const, content: userText },
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 200,
        temperature: 0.8,
        stream: true,
      }),
    });

    if (!response.ok) {
      // 流式不可用时，降级为非流式
      return callLlmNonStream(scenario, userText);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return callLlmNonStream(scenario, userText);
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 解析 SSE 数据行
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // 保留最后一个可能不完整的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {
          // 忽略解析错误，继续处理
        }
      }
    }

    return fullText || "I didn't understand that. Could you repeat?";
  };

  /** 非流式调用（降级方案） */
  const callLlmNonStream = async (scenario: Scenario, userText: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const baseUrl = import.meta.env.VITE_OPENAI_BASE_URL;
    const model = import.meta.env.VITE_LLM_MODEL ?? 'deepseek-v3';

    const messages = [
      {
        role: 'system' as const,
        content: scenario.rolePrompt + '\n\nConversation goal: ' + scenario.goal + '\nKeep responses concise (1-3 sentences). Stay in character.',
      },
      ...turns.map((t) => ({
        role: (t.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: t.text,
      })),
      { role: 'user' as const, content: userText },
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "I didn't understand that. Could you repeat?";
  };

  /** 结束会话，生成报告 */
  const handleEndSession = async () => {
    const userTurns = turns.filter((t) => t.role === 'user');

    // 尝试用 LLM 生成真实纠错报告
    try {
      const report = await generateReport(userTurns);
      setReport(report as any);
      navigate('/report');
    } catch (err) {
      console.error('Report generation failed, using fallback:', err);
      // 降级：简单随机报告
      const report = {
        sessionId: 'local-session',
        radar: {
          pronunciation: 70 + Math.floor(Math.random() * 15),
          fluency: 65 + Math.floor(Math.random() * 20),
          grammar: Math.max(40, 100 - userTurns.length * 5),
          vocabulary: 60 + Math.floor(Math.random() * 20),
          taskCompletion: 70 + Math.floor(Math.random() * 20),
        },
        topErrors: [
          { errorType: 'word_choice', count: 2, example: '"very like" → "really like"' },
          { errorType: 'grammar', count: 1, example: '"he go" → "he goes"' },
        ],
        expressionUpgrades: [
          { from: 'I very like this job', to: "I'm really excited about this role" },
        ],
        summaryText: `本次练习共 ${userTurns.length} 轮对话。整体表现不错，继续加油！`,
        annotatedTurns: turns.map((t) => ({ ...t, corrections: [] })),
      };
      setReport(report as any);
      navigate('/report');
    }
  };

  /** 用 LLM 生成真实纠错报告 */
  const generateReport = async (userTurns: { text: string }[]) => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const baseUrl = import.meta.env.VITE_OPENAI_BASE_URL;
    const model = import.meta.env.VITE_LLM_MODEL ?? 'deepseek-v3';

    const userMessages = userTurns.map((t, i) => `${i + 1}. "${t.text}"`).join('\n');

    const systemPrompt = `You are an English speaking coach. Analyze the student's conversation and generate a performance report.
You MUST respond with ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "pronunciation": <number 0-100>,
  "fluency": <number 0-100>,
  "grammar": <number 0-100>,
  "vocabulary": <number 0-100>,
  "taskCompletion": <number 0-100>,
  "topErrors": [{"errorType": "grammar|word_choice|tense|article|preposition", "count": <number>, "example": "<error> → <correction>"}],
  "expressionUpgrades": [{"from": "<original>", "to": "<better alternative>"}],
  "summaryText": "<2-3 sentence summary in Chinese>"
}

Be encouraging but honest. Scores should reflect real assessment. If the user made no errors, give high scores and empty arrays.`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here are the student's messages during the conversation:\n${userMessages}` },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error(`Report API error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    // 解析 JSON（可能被包在 code fence 中）
    let jsonStr = content.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const parsed = JSON.parse(jsonStr);

    return {
      sessionId: 'local-session',
      radar: {
        pronunciation: parsed.pronunciation ?? 70,
        fluency: parsed.fluency ?? 70,
        grammar: parsed.grammar ?? 70,
        vocabulary: parsed.vocabulary ?? 70,
        taskCompletion: parsed.taskCompletion ?? 70,
      },
      topErrors: (parsed.topErrors ?? []).map((e: any) => ({
        errorType: e.errorType ?? 'grammar',
        count: e.count ?? 1,
        example: e.example ?? '',
      })),
      expressionUpgrades: (parsed.expressionUpgrades ?? []).map((e: any) => ({
        from: e.from ?? '',
        to: e.to ?? '',
      })),
      summaryText: parsed.summaryText ?? 'Great practice session!',
      annotatedTurns: turns.map((t) => ({ ...t, corrections: [] })),
    };
  };

  const scenarioId = localStorage.getItem('scenarioId') ?? 'interview';
  const scenarioName = PRESET_SCENARIOS.find((s) => s.id === scenarioId)?.title ?? 'Practice';

  const isBusy = isLoading || isAiSpeaking;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      <div className="max-w-3xl mx-auto px-4 py-4 h-screen flex flex-col w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-lg">
              {scenarioId === 'interview' ? '💼' : scenarioId === 'restaurant' ? '🍽️' : '📋'}
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
              className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors border border-red-100"
            >
              End Session
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-3 px-1 py-2">
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
            >
              {turn.role === 'ai' && (
                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                  turn.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-md'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>
              </div>
              {turn.role === 'user' && (
                <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                  👤
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && !currentAiText && (
            <div className="flex justify-start items-end gap-2">
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
            <div className="flex justify-start items-end gap-2">
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                🤖
              </div>
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-md">
                <p className="text-sm leading-relaxed">
                  {currentAiText}
                  <span className="animate-pulse text-indigo-400">|</span>
                </p>
              </div>
            </div>
          )}

          {/* 识别中间结果 */}
          {partialText && (
            <div className="flex justify-end items-end gap-2">
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl bg-indigo-100 text-indigo-900 rounded-br-md opacity-70">
                <p className="text-sm italic">{partialText}...</p>
              </div>
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                👤
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="bg-white/80 backdrop-blur-sm rounded-t-2xl border-t border-gray-200 pt-3 pb-3 px-2">
          {/* Mode toggle */}
          <div className="flex justify-center gap-2 mb-3">
            <button
              onClick={() => { setInputMode('voice'); handleStopRecording(); }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                inputMode === 'voice' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
              }`}
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
                onClick={isBusy ? undefined : (isRecording ? handleStopRecording : handleStartRecording)}
                disabled={isBusy && !isRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all shadow-lg ${
                  isRecording
                    ? 'bg-red-500 text-white scale-110 shadow-red-200 animate-pulse'
                    : isBusy
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {isRecording ? '⏹' : '🎤'}
              </button>
              <span className="text-xs text-gray-400">
                {isRecording ? 'Tap to stop' : isBusy ? 'Wait for AI...' : 'Tap to speak'}
              </span>
            </div>
          ) : (
            /* Text input */
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && textInput.trim() && !isBusy) {
                    e.preventDefault();
                    handleUserMessage(textInput.trim());
                    setTextInput('');
                  }
                }}
                placeholder="Type your message in English..."
                disabled={isBusy}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm disabled:opacity-50"
              />
              <button
                onClick={() => {
                  if (textInput.trim() && !isBusy) {
                    handleUserMessage(textInput.trim());
                    setTextInput('');
                  }
                }}
                disabled={isBusy || !textInput.trim()}
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
          {isAiSpeaking && !isRecording && '🔊 AI is speaking...'}
          {isLoading && !isAiSpeaking && !isRecording && '💭 Thinking...'}
        </div>
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
