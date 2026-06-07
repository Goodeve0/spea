/**
 * 瓜友页：发现（匹配 + 待处理邀请）/ 我的瓜友（贴纸 + 约一把 + 解除）/ 排行。
 * 仅登录用户可用；游客引导登录。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STICKERS, type BuddyCard as BuddyCardT, type Difficulty, type RadarScores, type StickerKey } from '@speak-coach/shared';

import { useAuthStore } from '../store/auth';
import { useBuddyStore } from '../store/buddy';
import { UserAvatar } from '../components/user-avatar';
import type { AvatarKey } from '../store/settings';
import { BuddyIcon, MelonIcon, StarIcon, BoltIcon } from '../components/icons';

type Tab = 'discover' | 'mine' | 'ranking';

interface RoomModalState {
  userId: string;
  buddyName: string;
}

const SCENARIO_LABEL: Record<string, string> = {
  interview: '面试', meeting: '会议', presentation: '演讲', restaurant: '餐厅',
  doctor: '看医生', shopping: '购物', hotel: '酒店', smalltalk: '闲聊', ielts: '雅思',
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
};

function scenarioLabel(id: string): string {
  return SCENARIO_LABEL[id] ?? id;
}

function MiniRadar({ radar }: { radar?: RadarScores }) {
  if (!radar) return null;
  const dims = [radar.pronunciation, radar.fluency, radar.grammar, radar.vocabulary, radar.taskCompletion];
  return (
    <div className="flex items-end gap-0.5 h-8" title="最近雷达">
      {dims.map((v, i) => (
        <div key={i} className="w-1.5 rounded-t bg-primary/70" style={{ height: `${Math.max(8, v)}%` }} />
      ))}
    </div>
  );
}

function CardHeader({ card }: { card: BuddyCardT }) {
  return (
    <div className="flex items-center gap-3">
      <UserAvatar avatarKey={(card.avatarKey as AvatarKey) ?? 'melon'} size={44} />
      <div className="min-w-0 flex-1">
        <div className="font-extrabold text-ink truncate flex items-center gap-1.5">
          {card.displayName}
          {card.isSeed && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent-dark">示例</span>}
        </div>
        <div className="text-xs text-sub mt-0.5 flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-primary-light text-primary-dark font-bold">
            {card.cefr ?? '暂无评级'}
          </span>
          <span>本周练 {card.weeklyPracticeCount} 次</span>
        </div>
      </div>
      <MiniRadar radar={card.recentRadar} />
    </div>
  );
}

function ScenarioChips({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {ids.map((id) => (
        <span key={id} className="text-[11px] px-2 py-0.5 rounded-full bg-canvas text-sub">
          擅长·{scenarioLabel(id)}
        </span>
      ))}
    </div>
  );
}

function RoomInviteModal({
  buddyName,
  onClose,
  onConfirm,
}: {
  buddyName: string;
  onClose: () => void;
  onConfirm: (scenarioId: string, difficulty: Difficulty) => void;
}) {
  const recentScenario = localStorage.getItem('scenarioId') ?? 'restaurant';
  const savedDifficulty = (localStorage.getItem('difficulty') ?? 'beginner') as Difficulty;

  const scenarioOptions = useMemo(() => {
    const base = [
      { id: recentScenario, label: `最近·${scenarioLabel(recentScenario)}` },
      { id: 'restaurant', label: '餐厅' },
      { id: 'interview', label: '面试' },
    ];
    const seen = new Set<string>();
    return base.filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
  }, [recentScenario]);

  const [scenarioId, setScenarioId] = useState(recentScenario);
  const difficulty = savedDifficulty;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 px-4 pb-6 sm:pb-0">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-pop p-5">
        <h2 className="text-lg font-extrabold text-ink mb-1">约 {buddyName} 双排</h2>
        <p className="text-sub text-sm mb-4">选个场景，TA 收到邀请后可加入</p>

        <div className="text-xs font-bold text-sub mb-2">场景</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {scenarioOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setScenarioId(o.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ${
                scenarioId === o.id ? 'bg-primary text-white' : 'bg-canvas text-ink hover:bg-primary-light'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-bold text-sub mb-2">难度</div>
        <p className="text-sm text-ink mb-5 px-3 py-2 bg-canvas rounded-xl">
          {DIFFICULTY_LABEL[difficulty] ?? difficulty}
          <span className="text-sub text-xs ml-2">（沿用当前默认）</span>
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-canvas text-sub font-bold"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(scenarioId, difficulty)}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0"
          >
            开始邀请
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Buddies() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    matches, requests, buddies, ranking, invitedIds,
    loadAll, invite, accept, decline, removeBuddy, sendSticker,
  } = useBuddyStore();

  const [tab, setTab] = useState<Tab>('discover');
  const [stickerFor, setStickerFor] = useState<string | null>(null);
  const [roomModal, setRoomModal] = useState<RoomModalState | null>(null);

  useEffect(() => {
    if (!user) return;
    void loadAll();
  }, [user, loadAll]);

  // 游客引导登录
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <BuddyIcon size={64} className="mx-auto text-primary mb-4" />
        <h1 className="text-2xl font-extrabold text-ink mb-2">找个瓜友一起练</h1>
        <p className="text-sub text-sm mb-6">登录后即可匹配同水平搭子、互相鼓励、双排练习</p>
        <button
          onClick={() => navigate('/login')}
          className="px-8 py-3 bg-primary text-white rounded-2xl font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all shadow-pop"
        >
          登录解锁瓜友
        </button>
      </div>
    );
  }

  function startRoom(buddyUserId: string, buddyName: string) {
    setRoomModal({ userId: buddyUserId, buddyName });
  }

  function confirmRoom(scenarioId: string, difficulty: Difficulty) {
    if (!roomModal) return;
    navigate('/room/new', {
      state: {
        scenarioId,
        difficulty,
        inviteUserId: roomModal.userId,
        buddyName: roomModal.buddyName,
      },
    });
    setRoomModal(null);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl font-extrabold text-ink mb-4 flex items-center gap-2">
        <BuddyIcon size={28} className="text-primary" /> 瓜友
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-canvas rounded-2xl p-1 mb-6">
        {([['discover', '发现'], ['mine', '我的瓜友'], ['ranking', '排行']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === key ? 'bg-white text-primary-dark shadow-card' : 'text-sub hover:text-ink'
            }`}
          >
            {label}
            {key === 'mine' && requests.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-danger text-white">{requests.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* 发现 */}
      {tab === 'discover' && (
        <div className="space-y-3">
          {requests.length > 0 && (
            <div className="bg-primary-light/40 rounded-2xl p-3 mb-2">
              <div className="text-xs font-bold text-primary-dark mb-2">待处理邀请</div>
              <div className="space-y-2">
                {requests.map((req) => (
                  <div key={req.requestId} className="bg-white rounded-xl p-3 flex items-center gap-3">
                    <UserAvatar avatarKey={(req.from.avatarKey as AvatarKey) ?? 'melon'} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-ink truncate">{req.from.displayName}</div>
                      <div className="text-xs text-sub">{req.from.cefr ?? '暂无评级'} · 想和你做瓜友</div>
                    </div>
                    <button onClick={() => void accept(req.requestId)} className="px-3 py-1.5 bg-primary text-white rounded-xl text-sm font-bold">接受</button>
                    <button onClick={() => void decline(req.requestId)} className="px-3 py-1.5 bg-canvas text-sub rounded-xl text-sm">拒绝</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matches.length === 0 ? (
            <div className="bg-white rounded-3xl border border-line shadow-card p-8 text-center">
              <MelonIcon size={40} className="mx-auto mb-2" />
              <p className="text-sub text-sm">暂时没有匹配到合适的瓜友，过会儿再来看看～</p>
            </div>
          ) : (
            matches.map((card) => {
              const invited = invitedIds.includes(card.userId);
              return (
                <div key={card.userId} className="bg-white rounded-2xl border border-line shadow-card p-4">
                  <CardHeader card={card} />
                  <ScenarioChips ids={card.topScenarios} />
                  <div className="mt-3 flex justify-end">
                    {invited ? (
                      <span className="px-4 py-2 bg-success/10 text-success rounded-xl text-sm font-bold flex items-center gap-1">
                        ✅ 已邀请·待对方接受
                      </span>
                    ) : (
                      <button
                        onClick={() => void invite(card.userId)}
                        className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold border-b-2 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all"
                      >
                        邀请成为瓜友
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 我的瓜友 */}
      {tab === 'mine' && (
        <div className="space-y-3">
          {buddies.length === 0 ? (
            <div className="bg-white rounded-3xl border border-line shadow-card p-8 text-center">
              <BuddyIcon size={40} className="mx-auto mb-2 text-sub" />
              <p className="text-sub text-sm">还没有瓜友，去「发现」邀请一个吧！</p>
            </div>
          ) : (
            buddies.map((rel) => (
              <div key={rel.buddyId} className="bg-white rounded-2xl border border-line shadow-card p-4">
                <CardHeader card={rel.card} />
                <div className="flex items-center gap-2 mt-2 text-xs">
                  {rel.mutualStreak > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent-dark font-bold">
                      🔥 瓜友连胜 {rel.mutualStreak} 天
                    </span>
                  )}
                  {rel.status === 'cooling' && (
                    <span className="px-2 py-0.5 rounded-full bg-canvas text-sub">该一起练了 🫠</span>
                  )}
                </div>

                {stickerFor === rel.card.userId ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {STICKERS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={async () => {
                          try {
                            await sendSticker(rel.card.userId, s.key as StickerKey, rel.card.displayName);
                            setStickerFor(null);
                          } catch {
                            setStickerFor(null);
                          }
                        }}
                        className="px-2 py-2 rounded-xl bg-canvas hover:bg-primary-light text-xs font-bold text-ink transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2 justify-end">
                    <button onClick={() => setStickerFor(rel.card.userId)} className="px-3 py-1.5 bg-canvas text-ink rounded-xl text-sm font-bold hover:bg-primary-light transition-colors">
                      发贴纸
                    </button>
                    <button
                      onClick={() => startRoom(rel.card.userId, rel.card.displayName)}
                      disabled={rel.card.isSeed}
                      title={rel.card.isSeed ? '示例瓜友不支持双排' : undefined}
                      className="px-3 py-1.5 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      约一把
                    </button>
                    <button onClick={() => void removeBuddy(rel.buddyId)} className="px-3 py-1.5 text-sub rounded-xl text-sm hover:text-danger transition-colors">
                      解除
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 排行 */}
      {tab === 'ranking' && (
        <div className="bg-white rounded-3xl border border-line shadow-card p-4">
          <h2 className="font-extrabold text-ink mb-3 flex items-center gap-2"><BoltIcon size={20} className="text-accent" /> 本周练习排行</h2>
          {ranking.length === 0 ? (
            <p className="text-sub text-sm text-center py-6">还没有数据</p>
          ) : (
            <ul className="space-y-1">
              {ranking.map((e, i) => (
                <li
                  key={e.userId}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl ${e.isSelf ? 'bg-primary-light/50' : ''}`}
                >
                  <span className={`w-6 text-center font-extrabold ${i < 3 ? 'text-accent' : 'text-sub'}`}>{i + 1}</span>
                  <UserAvatar avatarKey={(e.avatarKey as AvatarKey) ?? 'melon'} size={32} />
                  <span className="flex-1 font-bold text-ink truncate">
                    {e.displayName}{e.isSelf && <span className="text-xs text-primary-dark ml-1">（我）</span>}
                  </span>
                  <span className="flex items-center gap-1 text-sm font-extrabold text-primary">
                    <StarIcon size={14} /> {e.weeklyPracticeCount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {roomModal && (
        <RoomInviteModal
          buddyName={roomModal.buddyName}
          onClose={() => setRoomModal(null)}
          onConfirm={confirmRoom}
        />
      )}
    </div>
  );
}
