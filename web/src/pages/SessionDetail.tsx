/**
 * 历史会话详情页：回溯某次练习的报告 + 对话回顾。
 * 路由：/session/:id
 * 数据来源：localStorage 按 id 查找 StoredSession（含 report）。
 */
import { useParams, useNavigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';
import type { RadarScores } from '@speak-coach/shared';

import { findLocalSession } from '../store/history';
import { useAuthStore } from '../store/auth';
import { levelInfo } from '../lib/gamification';
import Mascot from '../components/ui/Mascot';
import {
  RADAR_DIM_ICONS,
  PartyIcon,
  SparkleIcon,
  LightbulbIcon,
  NoteIcon,
  ChatIcon,
  RecastIcon,
  PersonIcon,
  RobotIcon,
  TargetIcon,
  PracticeIcon,
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

const RADAR_ICON_COMPONENTS: Record<keyof RadarScores, React.FC<IconProps>> = {
  pronunciation: RADAR_DIM_ICONS.pronunciation,
  fluency: RADAR_DIM_ICONS.fluency,
  grammar: RADAR_DIM_ICONS.grammar,
  vocabulary: RADAR_DIM_ICONS.vocabulary,
  taskCompletion: RADAR_DIM_ICONS.taskCompletion,
};

const SCENARIO_TITLES: Record<string, string> = {
  interview: '求职面试', meeting: '商务会议', presentation: '公开演讲',
  restaurant: '餐厅点餐', doctor: '看医生', shopping: '购物',
  hotel: '酒店入住', smalltalk: '闲聊', ielts: '雅思口语', custom: '自由话题',
};

function getScoreLevel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: '优秀', color: 'text-success' };
  if (score >= 75) return { label: '良好', color: 'text-primary-dark' };
  if (score >= 60) return { label: '及格', color: 'text-accent-dark' };
  return { label: '待加强', color: 'text-danger' };
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const session = id ? findLocalSession(id, user?.id) : undefined;

  if (!session) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <Mascot size={72} className="mx-auto mb-4" />
          <h1 className="text-xl font-extrabold text-ink mb-2">找不到这次练习</h1>
          <p className="text-sub text-sm mb-6">可能是游客模式下清除了数据，或登录账号不一致</p>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-primary text-white rounded-2xl font-bold border-b-4 border-primary-dark">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const { report, radar, overallScore, scenarioId, cefrEstimate, timestamp } = session;
  const l = levelInfo(overallScore);
  const overallLevel = getScoreLevel(overallScore);
  const scenarioName = SCENARIO_TITLES[scenarioId] ?? scenarioId;

  const chartData = (Object.entries(radar) as [keyof RadarScores, number][]).map(([key, value]) => ({
    subject: RADAR_LABELS[key],
    value,
    fullMark: 100,
  }));

  return (
    <div className="min-h-screen bg-canvas">
      {/* 顶部固定导航栏 */}
      <nav className="sticky top-0 z-30 bg-white/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-sub hover:text-ink transition-colors -ml-1.5 px-3 py-2 rounded-xl hover:bg-canvas"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            返回
          </button>
          <span className="font-extrabold text-ink">练习回溯</span>
          <div className="w-20" />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <PracticeIcon size={48} className="text-primary mb-2" />
          <h1 className="text-2xl font-extrabold text-ink mb-1">{scenarioName}</h1>
          <p className="text-sub text-sm">
            {new Date(timestamp).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="px-3 py-1 rounded-full bg-primary-light text-primary-dark text-xs font-bold">
              {session.difficulty === 'beginner' ? '初级' : session.difficulty === 'advanced' ? '高级' : '中级'}
            </span>
            {cefrEstimate && (
              <span className="px-3 py-1 rounded-full bg-accent/10 text-accent-dark text-xs font-bold">
                ≈ {cefrEstimate}
              </span>
            )}
          </div>
        </div>

        {/* 总分 */}
        <div className="flex justify-center mb-10">
          <div className="relative">
            <div className="w-36 h-36 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-pop">
              <div className="text-center">
                <span className="text-4xl font-extrabold text-white">{Math.round(overallScore)}</span>
                <span className="block text-xs text-white/70">/ 100</span>
              </div>
            </div>
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-white rounded-full shadow-card text-sm font-extrabold ${overallLevel.color}`}>
              {overallLevel.label}
            </div>
          </div>
        </div>

        {/* 能力分项 */}
        <div className="bg-white rounded-3xl shadow-card p-6 mb-6 border border-line">
          <h2 className="text-lg font-extrabold text-ink mb-4">能力分项</h2>
          <div className="space-y-4">
            {(Object.entries(radar) as [keyof RadarScores, number][]).map(([key, value]) => {
              const lvl = getScoreLevel(value);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-ink font-medium flex items-center gap-2">
                      {(() => { const Ic = RADAR_ICON_COMPONENTS[key]; return Ic ? <Ic size={16} /> : null; })()}
                      {RADAR_LABELS[key]}
                    </span>
                    <span className={`text-sm font-extrabold ${lvl.color}`}>{value}</span>
                  </div>
                  <div className="w-full bg-canvas rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-gradient-to-r from-primary to-primary-dark" style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 雷达图 */}
        <div className="bg-white rounded-3xl shadow-card p-6 mb-6 border border-line">
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

        {/* 以下为 report 专属内容，可能不存在 */}
        {report && (
          <>
            {/* 纠错 + 表达升级 */}
            <div className="bg-white rounded-3xl shadow-card p-6 mb-6 border border-line">
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
                      <span className="flex-shrink-0 w-6 h-6 bg-danger/15 text-danger rounded-full flex items-center justify-center text-xs font-extrabold">{i + 1}</span>
                      <div>
                        <p className="text-sm font-bold text-ink capitalize">{err.errorType.replace('_', ' ')}</p>
                        <p className="text-xs text-sub mt-0.5">{err.count} 次</p>
                        {err.example && <p className="text-xs text-danger mt-1 font-mono bg-danger/10 px-2 py-1 rounded-lg">{err.example}</p>}
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

            {/* 隐性重述 */}
            {report.recasts.length > 0 && (
              <div className="bg-white rounded-3xl shadow-card p-6 mb-6 border border-line">
                <h2 className="text-lg font-extrabold text-ink mb-4 flex items-center gap-2"><RecastIcon size={20} className="text-primary" /> 帮你顺过的表达</h2>
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
              </div>
            )}

            {/* 总结 */}
            <div className="bg-white rounded-3xl shadow-card p-6 mb-6 border border-line">
              <h2 className="text-lg font-extrabold text-ink mb-3 flex items-center gap-2"><NoteIcon size={20} className="text-primary" /> 总结</h2>
              <p className="text-ink/80 leading-relaxed">{report.summaryText}</p>
            </div>

            {/* 对话回顾 */}
            {report.annotatedTurns.length > 0 && (
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
            )}
          </>
        )}

        {/* 无 report 时的提示 */}
        {!report && (
          <div className="bg-white rounded-3xl shadow-card p-8 mb-8 border border-line text-center">
            <TargetIcon size={36} className="mx-auto text-sub mb-2" />
            <p className="text-sub text-sm">本次练习的详细报告未保存（可能是早期版本的数据）</p>
            <p className="text-sub text-xs mt-1">仅保留了雷达图和综合分</p>
          </div>
        )}

        {/* 操作 */}
        <div className="text-center pb-8 flex gap-3 justify-center">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-white border border-line text-ink rounded-2xl font-extrabold hover:bg-canvas transition-colors"
          >
            返回首页
          </button>
          <button
            onClick={() => navigate(`/conversation`)}
            className="px-6 py-3 bg-primary text-white rounded-2xl font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all shadow-pop"
          >
            再练一次
          </button>
        </div>
      </div>
    </div>
  );
}
