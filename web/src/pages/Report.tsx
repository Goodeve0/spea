import { type FC, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { RadarScores, Difficulty, StoredSession } from '@speak-coach/shared';

import { useSessionStore } from '../store/session';
import { recordSession, loadGrowth } from '../store/growth';
import { levelInfo } from '../lib/gamification';
import Mascot from '../components/ui/Mascot';
import RewardBanner from '../components/RewardBanner';
import LevelUpCelebration from '../components/LevelUpCelebration';
import {
  RADAR_DIM_ICONS,
  PartyIcon,
  SparkleIcon,
  LightbulbIcon,
  NoteIcon,
  GrowthIcon,
  ChatIcon,
  RecastIcon,
  RefreshIcon,
  PersonIcon,
  RobotIcon,
} from '../components/icons';
import type { IconProps } from '../components/icons';

const GrowthCurve = lazy(() => import('../components/GrowthCurve'));

const RADAR_LABELS: Record<keyof RadarScores, string> = {
  pronunciation: '发音',
  fluency: '流利度',
  grammar: '语法',
  vocabulary: '词汇',
  taskCompletion: '任务完成',
};

const RADAR_ICON_COMPONENTS: Record<keyof RadarScores, FC<IconProps>> = {
  pronunciation: RADAR_DIM_ICONS.pronunciation,
  fluency: RADAR_DIM_ICONS.fluency,
  grammar: RADAR_DIM_ICONS.grammar,
  vocabulary: RADAR_DIM_ICONS.vocabulary,
  taskCompletion: RADAR_DIM_ICONS.taskCompletion,
};

function getScoreLevel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: '优秀', color: 'text-success' };
  if (score >= 75) return { label: '良好', color: 'text-primary-dark' };
  if (score >= 60) return { label: '及格', color: 'text-accent-dark' };
  return { label: '待加强', color: 'text-danger' };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export default function Report() {
  const navigate = useNavigate();
  const report = useSessionStore((s) => s.report);
  const savedRef = useRef(false);
  const celebratedRef = useRef(false);
  const [growthSessions, setGrowthSessions] = useState<StoredSession[]>([]);
  const [growthMeta, setGrowthMeta] = useState<{ streak: number; totalXp: number } | null>(null);
  const [celebrateLevel, setCelebrateLevel] = useState<number | null>(null);

  const hasSpeech = !!report && (report.hasUserSpeech ?? report.annotatedTurns.some((t) => t.role === 'user'));
  const overallScore = report ? avg(Object.values(report.radar)) : 0;

  // 报告生成后：有发言则落库（登录→服务端，游客→本地），并拉取成长曲线数据
  useEffect(() => {
    if (!report) return;
    let alive = true;
    void (async () => {
      if (hasSpeech && !savedRef.current) {
        savedRef.current = true;
        await recordSession(
          {
            id: `sess-${Date.now()}`,
            timestamp: Date.now(),
            scenarioId: localStorage.getItem('scenarioId') ?? 'unknown',
            difficulty: (localStorage.getItem('difficulty') as Difficulty) ?? 'intermediate',
            radar: report.radar,
            overallScore,
            cefrEstimate: report.cefrEstimate,
          },
          report,
        );
      }
      const g = await loadGrowth();
      if (alive) {
        setGrowthSessions(g.sessions);
        setGrowthMeta({ streak: g.streak, totalXp: g.totalXp });
        // 升级检测：本次得分使累计跨过等级线则庆祝（每个报告只弹一次）
        if (!celebratedRef.current) {
          const after = levelInfo(g.totalXp).level;
          const before = levelInfo(Math.max(0, g.totalXp - overallScore)).level;
          if (after > before) {
            celebratedRef.current = true;
            setCelebrateLevel(after);
          }
        }
      }
    })();
    return () => { alive = false; };
  }, [report, hasSpeech, overallScore]);

  const goHome = () => {
    useSessionStore.getState().reset();
    navigate('/');
  };

  // 报告生成中
  if (!report) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <Mascot size={96} className="animate-float mx-auto" />
          <h1 className="text-2xl font-extrabold text-ink mt-4 mb-1">报告生成中…</h1>
          <p className="text-sub mb-6">正在分析你的对话</p>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-primary text-white rounded-2xl font-bold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // 无发言：不展示任何分数，友好引导
  if (!hasSpeech) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-card border border-line p-8 text-center animate-pop-in">
          <Mascot size={96} className="mx-auto" />
          <h1 className="text-2xl font-extrabold text-ink mt-4 mb-2">这次还没听到你说话</h1>
          <p className="text-sub leading-relaxed mb-6">{report.summaryText}</p>
          <button onClick={goHome} className="w-full py-3 bg-primary text-white rounded-2xl font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all">
            去开口练一次 →
          </button>
        </div>
      </div>
    );
  }

  const chartData = (Object.entries(report.radar) as [keyof RadarScores, number][]).map(([key, value]) => ({
    subject: RADAR_LABELS[key],
    value,
    fullMark: 100,
  }));
  const overallLevel = getScoreLevel(overallScore);

  return (
    <div className="min-h-screen bg-canvas">
      {celebrateLevel !== null && (
        <LevelUpCelebration level={celebrateLevel} onClose={() => setCelebrateLevel(null)} />
      )}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8 animate-pop-in">
          <Mascot size={72} className="animate-float" />
          <h1 className="text-3xl font-extrabold text-ink mt-3 mb-1">练习报告</h1>
          <p className="text-sub">这是你这次的口语表现</p>
        </div>

        {/* 即时奖励反馈（升级时庆祝） */}
        {growthMeta && (
          <RewardBanner gainedXp={overallScore} totalXp={growthMeta.totalXp} streak={growthMeta.streak} />
        )}

        {/* 总分 + CEFR */}
        <div className="flex justify-center mb-10">
          <div className="relative">
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-pop">
              <div className="text-center">
                <span className="text-5xl font-extrabold text-white">{overallScore}</span>
                <span className="block text-xs text-white/70">/ 100</span>
              </div>
            </div>
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-white rounded-full shadow-card text-sm font-extrabold ${overallLevel.color}`}>
              {overallLevel.label}
            </div>
            {report.cefrEstimate && (
              <div className="absolute -top-1 -right-2 px-2.5 py-1 bg-accent text-white rounded-full text-xs font-extrabold shadow-card" title="近似 CEFR 等级（估算）">
                ≈ {report.cefrEstimate}
              </div>
            )}
          </div>
        </div>

        {/* 分项条 */}
        <div className="bg-white rounded-3xl shadow-card p-6 mb-6 border border-line">
          <h2 className="text-lg font-extrabold text-ink mb-4">能力分项</h2>
          <div className="space-y-4">
            {(Object.entries(report.radar) as [keyof RadarScores, number][]).map(([key, value]) => {
              const level = getScoreLevel(value);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-ink font-medium flex items-center gap-2">
                      {(() => { const Ic = RADAR_ICON_COMPONENTS[key]; return Ic ? <Ic size={16} /> : null; })()}
                      {RADAR_LABELS[key]}
                    </span>
                    <span className={`text-sm font-extrabold ${level.color}`}>{value}</span>
                  </div>
                  <div className="w-full bg-canvas rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-1000"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* 雷达图 */}
          <div className="bg-white rounded-3xl shadow-card p-6 border border-line">
            <h2 className="text-lg font-extrabold text-ink mb-4">能力雷达</h2>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={chartData}>
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Radar name="Score" dataKey="value" stroke="#2EC4B6" fill="#2EC4B6" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* 纠错 + 表达升级（含"为什么"） */}
          <div className="bg-white rounded-3xl shadow-card p-6 border border-line">
            <h2 className="text-lg font-extrabold text-ink mb-4">纠错与升级</h2>
            {report.topErrors.length === 0 ? (
              <div className="text-center py-6">
                <PartyIcon size={32} className="mx-auto text-success" />
                <p className="text-sub mt-2">没有发现明显错误，做得很好！</p>
              </div>
            ) : (
              <div className="space-y-3">
                {report.topErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-danger/5 rounded-2xl">
                    <span className="flex-shrink-0 w-6 h-6 bg-danger/15 text-danger rounded-full flex items-center justify-center text-xs font-extrabold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink capitalize">{err.errorType.replace('_', ' ')}</p>
                      <p className="text-xs text-sub mt-0.5">{err.count} 次</p>
                      {err.example && (
                        <p className="text-xs text-danger mt-1 font-mono bg-danger/10 px-2 py-1 rounded-lg">{err.example}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {report.expressionUpgrades.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-extrabold text-ink mb-3 flex items-center gap-1.5"><SparkleIcon size={16} className="text-accent" /> 更地道的说法</h3>
                <div className="space-y-2">
                  {report.expressionUpgrades.map((u, i) => (
                    <div key={i} className="bg-success/10 rounded-2xl p-3">
                      <p className="text-xs text-sub line-through">{u.from}</p>
                      <p className="text-sm text-primary-dark font-bold mt-0.5">{u.to}</p>
                      {u.why && <p className="text-xs text-sub mt-1 flex items-start gap-1"><LightbulbIcon size={14} className="text-accent flex-shrink-0 mt-0.5" /> {u.why}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 隐性重述回放 */}
        <div className="bg-white rounded-3xl shadow-card p-6 mb-6 border border-line">
          <h2 className="text-lg font-extrabold text-ink mb-4 flex items-center gap-2"><RecastIcon size={20} className="text-primary" /> 帮你顺过的表达</h2>
          {report.recasts.length === 0 ? (
            <div className="text-center py-4 text-sub text-sm">本次没有需要顺的表达，很棒！</div>
          ) : (
            <div className="space-y-3">
              {report.recasts.map((r, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-canvas rounded-2xl text-sm text-sub">
                    <span className="text-xs font-bold text-sub/70 mr-1">你说的</span>{r.original}
                  </div>
                  <span className="text-primary font-extrabold text-center">→</span>
                  <div className="flex-1 px-3 py-2 bg-primary-light rounded-2xl text-sm text-primary-dark font-medium">
                    <span className="text-xs font-bold text-primary/70 mr-1">更自然</span>{r.recast}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 总结 */}
        <div className="bg-white rounded-3xl shadow-card p-6 mb-6 border border-line">
          <h2 className="text-lg font-extrabold text-ink mb-3 flex items-center gap-2"><NoteIcon size={20} className="text-primary" /> 总结</h2>
          <p className="text-ink/80 leading-relaxed">{report.summaryText}</p>
        </div>

        {/* 成长曲线 */}
        <div className="bg-white rounded-3xl shadow-card p-6 mb-6 border border-line">
          <h2 className="text-lg font-extrabold text-ink mb-4 flex items-center gap-2"><GrowthIcon size={20} className="text-primary" /> 成长曲线</h2>
          <Suspense fallback={<div className="text-center py-10 text-sub text-sm">加载中…</div>}>
            <GrowthCurve sessions={growthSessions} />
          </Suspense>
        </div>

        {/* 对话回顾 */}
        <div className="bg-white rounded-3xl shadow-card p-6 mb-8 border border-line">
          <h2 className="text-lg font-extrabold text-ink mb-4 flex items-center gap-2"><ChatIcon size={20} className="text-primary" /> 对话回顾</h2>
          <div className="space-y-3">
            {report.annotatedTurns.map((turn, i) => (
              <div key={i} className={`p-3 rounded-2xl ${turn.role === 'user' ? 'bg-primary-light/60' : 'bg-canvas'}`}>
                <span className={`text-xs font-extrabold flex items-center gap-1 ${turn.role === 'user' ? 'text-primary-dark' : 'text-sub'}`}>
                  {turn.role === 'user' ? <><PersonIcon size={14} /> 你</> : <><RobotIcon size={14} /> AI</>}
                </span>
                <p className="text-sm text-ink/90 leading-relaxed mt-1">{turn.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 操作 */}
        <div className="text-center pb-8">
          <button
            onClick={goHome}
            className="px-8 py-3 bg-primary text-white rounded-2xl font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all shadow-pop"
          >
            <RefreshIcon size={18} className="inline-block -mt-0.5 mr-1 text-white" /> 再练一次
          </button>
        </div>
      </div>
    </div>
  );
}
