/**
 * 实时练习房间（双排 · 协作模式）/room/:id
 * - id === 'new'：创建房间（从 location.state 读 scenario/difficulty/inviteUserId）
 * - 否则：加入已有房间
 * 经 WS 与服务端协调：每人本地 STT → room.utterance；AI 回复广播全员，本地 TTS 朗读。
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import type { Difficulty, RoomMember, ServerPayload, WsMessage } from '@speak-coach/shared';

import { getWsClient } from '../ws-client';
import { useAuthStore } from '../store/auth';
import { useBuddyStore } from '../store/buddy';
import { useSettingsStore } from '../store/settings';
import { BrowserSpeechRecognition } from '../audio/speech-recognition';
import { SilenceDetector } from '../audio/silence-detector';
import { getEngine, getCurrentEngine } from '../audio/tts-engine';
import { initTtsEngines } from '../audio/tts-init';
import { stripMarkdown } from '../llm/strip-markdown';
import { UserAvatar } from '../components/user-avatar';
import type { AvatarKey } from '../store/settings';
import { RobotIcon } from '../components/icons';

initTtsEngines();

interface RoomTurn {
  id: string;
  kind: 'ai' | 'me' | 'peer';
  text: string;
}

const SCENARIO_TITLE: Record<string, string> = {
  restaurant: '餐厅点餐', interview: '求职面试', meeting: '商务会议', shopping: '购物',
  hotel: '酒店入住', smalltalk: '闲聊', doctor: '看医生',
};

export default function LiveRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const [roomId, setRoomId] = useState<string | null>(id && id !== 'new' ? id : null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [turns, setTurns] = useState<RoomTurn[]>([]);
  const [aiStreaming, setAiStreaming] = useState('');
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'active' | 'ended' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [peerLeft, setPeerLeft] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [preview, setPreview] = useState('');

  const scenarioId = (location.state as { scenarioId?: string } | null)?.scenarioId ?? 'restaurant';
  const scenarioTitle = SCENARIO_TITLE[scenarioId] ?? scenarioId;
  const roomState = location.state as { buddyName?: string; inviteUserId?: string } | null;
  const inviteBuddyName = roomState?.buddyName;
  const inviteUserId = roomState?.inviteUserId;

  const aiBufRef = useRef('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const detectorRef = useRef<SilenceDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef('');
  const interimRef = useRef('');
  const finishingRef = useRef(false);
  const initedRef = useRef(false);

  const myId = user?.id;
  const isMyTurn = currentTurn === myId && status === 'active';
  const peer = members.find((m) => m.userId !== myId);
  const me = members.find((m) => m.userId === myId);

  const speak = useCallback((text: string) => {
    if (!text.trim()) return;
    const settings = useSettingsStore.getState();
    const engine = getEngine(settings.ttsEngine) ?? getCurrentEngine();
    engine.speak(text, { voice: settings.iflytekVoice });
  }, []);

  const stopMic = useCallback(() => {
    recognitionRef.current?.stop();
    detectorRef.current?.stop();
    detectorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // 连接 WS + 建/入房 + 消息处理
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    if (!token || !user) {
      navigate('/login');
      return;
    }

    const client = getWsClient();
    client.connect();

    const off = client.onMessage((msg: WsMessage) => {
      switch (msg.type) {
        case 'room.created': {
          const p = msg.payload as ServerPayload.RoomCreated;
          setRoomId(p.roomId);
          window.history.replaceState(null, '', `/room/${p.roomId}`);
          // 创建后邀请指定瓜友（成功/失败由 store 内部统一处理 toast/log）
          const inviteUserIdFromState = (location.state as { inviteUserId?: string } | null)?.inviteUserId;
          if (inviteUserIdFromState) {
            void useBuddyStore.getState().sendRoomInvite(inviteUserIdFromState, p.roomId);
          }
          setStatus('waiting');
          break;
        }
        case 'room.joined': {
          const p = msg.payload as ServerPayload.RoomJoined;
          setMembers(p.members);
          setStatus(p.members.length >= 2 ? 'active' : 'waiting');
          break;
        }
        case 'room.peer.joined': {
          const p = msg.payload as ServerPayload.RoomPeerJoined;
          setMembers((prev) => (prev.some((m) => m.userId === p.member.userId) ? prev : [...prev, p.member]));
          break;
        }
        case 'room.ready': {
          const p = msg.payload as ServerPayload.RoomReady;
          setStatus('active');
          setCurrentTurn(p.currentTurnUserId);
          setTurns((prev) => [...prev, { id: `ai-${Date.now()}`, kind: 'ai', text: p.greeting }]);
          speak(p.greeting);
          break;
        }
        case 'room.turn': {
          const p = msg.payload as ServerPayload.RoomTurn;
          setCurrentTurn(p.currentTurnUserId);
          break;
        }
        case 'room.peer.utterance': {
          const p = msg.payload as ServerPayload.RoomPeerUtterance;
          setTurns((prev) => [...prev, { id: `peer-${Date.now()}`, kind: 'peer', text: p.text }]);
          break;
        }
        case 'room.ai.text': {
          const p = msg.payload as ServerPayload.RoomAiText;
          aiBufRef.current += p.deltaText;
          setAiStreaming(stripMarkdown(aiBufRef.current));
          break;
        }
        case 'room.ai.done': {
          const full = stripMarkdown(aiBufRef.current).trim();
          aiBufRef.current = '';
          setAiStreaming('');
          if (full) {
            setTurns((prev) => [...prev, { id: `ai-${Date.now()}`, kind: 'ai', text: full }]);
            speak(full);
          }
          break;
        }
        case 'room.peer.left': {
          setPeerLeft(true);
          break;
        }
        case 'room.ended': {
          setStatus('ended');
          break;
        }
        case 'room.error': {
          const p = msg.payload as ServerPayload.RoomError;
          setErrorMsg(p.message);
          setStatus('error');
          break;
        }
        default:
          break;
      }
    });

    client.waitForOpen(6000).then(() => {
      if (id === 'new') {
        const difficulty = ((location.state as { difficulty?: Difficulty } | null)?.difficulty ?? 'beginner') as Difficulty;
        client.createRoom(token, scenarioId, difficulty);
      } else if (id) {
        client.joinRoom(token, id);
      }
    }).catch(() => {
      setErrorMsg('连接超时，请重试');
      setStatus('error');
    });

    return () => {
      off();
      stopMic();
      try { client.leaveRoom(); } catch { /* ignore */ }
      getEngine('browser')?.stop();
      getEngine('iflytek')?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishRecording = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const text = `${pendingRef.current} ${interimRef.current}`.trim();
    stopMic();
    pendingRef.current = '';
    interimRef.current = '';
    setPreview('');
    setIsRecording(false);
    finishingRef.current = false;
    if (text) {
      setTurns((prev) => [...prev, { id: `me-${Date.now()}`, kind: 'me', text }]);
      getWsClient().sendRoomUtterance(text);
    }
  }, [stopMic]);

  const startRecording = useCallback(async () => {
    const recognition = recognitionRef.current ?? new BrowserSpeechRecognition();
    recognitionRef.current = recognition;
    if (!recognition.isSupported()) {
      setErrorMsg('当前浏览器不支持语音识别，请使用 Chrome');
      return;
    }
    pendingRef.current = '';
    interimRef.current = '';
    finishingRef.current = false;
    setPreview('');
    setIsRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const detector = new SilenceDetector();
      detectorRef.current = detector;
      detector.onSilence(() => finishRecording());
      detector.start(stream);

      recognition.onResult((result) => {
        if (result.isFinal) {
          const chunk = result.text.trim();
          if (chunk) pendingRef.current = pendingRef.current ? `${pendingRef.current} ${chunk}` : chunk;
          interimRef.current = '';
        } else {
          interimRef.current = result.text;
        }
        setPreview(`${pendingRef.current} ${interimRef.current}`.trim());
        detectorRef.current?.resetSilenceTimer();
      });
      recognition.onError((err) => {
        if (err === 'no-speech') finishRecording();
      });
      recognition.start();
    } catch {
      setErrorMsg('无法访问麦克风，请检查权限');
      stopMic();
      setIsRecording(false);
    }
  }, [finishRecording, stopMic]);

  const handleEnd = () => {
    getWsClient().endRoom();
    setStatus('ended');
  };

  // ===== 渲染 =====
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-ink mb-2">进入房间失败</h1>
          <p className="text-sub text-sm mb-6">{errorMsg ?? '未知错误'}</p>
          <button onClick={() => navigate('/buddies')} className="px-6 py-2.5 bg-primary text-white rounded-2xl font-bold border-b-4 border-primary-dark">
            返回瓜友
          </button>
        </div>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-ink mb-2">双排结束 🎉</h1>
          <p className="text-sub text-sm mb-6">这次练习已计入你们各自的成长曲线</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/progress')} className="px-5 py-2.5 bg-white border border-line rounded-2xl font-bold text-ink">看成长</button>
            <button onClick={() => navigate('/buddies')} className="px-5 py-2.5 bg-primary text-white rounded-2xl font-extrabold border-b-4 border-primary-dark">返回瓜友</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* 顶部：双人头像 + 轮次 */}
      <nav className="sticky top-0 z-30 bg-white/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/buddies')} className="text-sm font-bold text-sub hover:text-ink px-2 py-1">退出</button>
          <div className="flex items-center gap-4">
            <PersonBadge member={me} active={isMyTurn} label="你" />
            <span className="text-xs text-sub">vs AI</span>
            <PersonBadge member={peer} active={currentTurn === peer?.userId} label="搭子" />
          </div>
          <button onClick={handleEnd} className="text-sm font-bold text-danger px-2 py-1">结束</button>
        </div>
        <div className="text-center text-xs font-bold text-primary-dark pb-1.5">
          {scenarioTitle} · {status === 'waiting' && inviteUserId && inviteBuddyName
            ? `已邀请 ${inviteBuddyName}，等待 TA 加入…`
            : status === 'waiting'
              ? '等待搭子加入…'
              : isMyTurn
                ? '轮到你说啦'
                : `等待 ${peer?.displayName ?? '搭子'} 发言`}
        </div>
      </nav>

      {/* 对话区 */}
      <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-4 py-4 space-y-3">
        {peerLeft && (
          <div className="text-center text-xs text-sub bg-canvas rounded-full py-1.5 px-3 mx-auto w-fit">
            搭子已离开，你可以继续与 AI 练习或点「结束」
          </div>
        )}
        {turns.map((t) => (
          <Bubble key={t.id} turn={t} peerName={peer?.displayName} />
        ))}
        {aiStreaming && (
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
              <RobotIcon size={18} className="text-primary-dark" />
            </div>
            <div className="max-w-[75%] px-4 py-2.5 rounded-2xl bg-white border border-line text-ink">
              <p className="text-sm leading-relaxed">{aiStreaming}<span className="animate-pulse text-primary">|</span></p>
            </div>
          </div>
        )}
        {isRecording && preview && (
          <div className="flex justify-end">
            <div className="max-w-[75%] px-4 py-2.5 rounded-2xl bg-primary-light text-primary-dark opacity-80">
              <p className="text-sm">{preview}…</p>
            </div>
          </div>
        )}
      </div>

      {/* 底部麦克风（仅自己轮次可用，无文字框） */}
      <div className="bg-white/85 backdrop-blur border-t border-line py-4">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={isRecording ? finishRecording : startRecording}
            disabled={!isMyTurn && !isRecording}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-pop ${
              isRecording
                ? 'bg-danger text-white scale-110 animate-pulse'
                : isMyTurn
                  ? 'bg-primary text-white'
                  : 'bg-line text-sub cursor-not-allowed'
            }`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isRecording ? <rect x="6" y="6" width="12" height="12" rx="2" /> : <><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
            </svg>
          </button>
          <span className="text-xs text-sub">
            {isRecording ? '说完停顿一下自动提交' : isMyTurn ? '点击说英语' : '等待对方…'}
          </span>
        </div>
      </div>
    </div>
  );
}

function PersonBadge({ member, active, label }: { member?: RoomMember; active: boolean; label: string }) {
  return (
    <div className={`flex flex-col items-center transition-all ${active ? 'scale-110' : 'opacity-60'}`}>
      <div className={`rounded-full ${active ? 'ring-2 ring-primary' : ''}`}>
        <UserAvatar avatarKey={(member?.avatarKey as AvatarKey) ?? 'melon'} size={36} />
      </div>
      <span className="text-[10px] text-sub mt-0.5 max-w-14 truncate">{member?.displayName ?? label}</span>
    </div>
  );
}

function Bubble({ turn, peerName }: { turn: RoomTurn; peerName?: string }) {
  if (turn.kind === 'me') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl bg-primary text-white rounded-br-md">
          <p className="text-sm leading-relaxed">{turn.text}</p>
        </div>
      </div>
    );
  }
  if (turn.kind === 'peer') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl bg-accent/15 text-accent-dark rounded-br-md">
          <span className="block text-[10px] font-bold opacity-70 mb-0.5">{peerName ?? '搭子'}</span>
          <p className="text-sm leading-relaxed">{turn.text}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
        <RobotIcon size={18} className="text-primary-dark" />
      </div>
      <div className="max-w-[75%] px-4 py-2.5 rounded-2xl bg-white border border-line text-ink rounded-bl-md">
        <p className="text-sm leading-relaxed">{turn.text}</p>
      </div>
    </div>
  );
}
