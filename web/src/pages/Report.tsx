import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { RadarScores } from '@speak-coach/shared';

const RADAR_LABELS: Record<keyof RadarScores, string> = {
  pronunciation: 'Pronunciation',
  fluency: 'Fluency',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  taskCompletion: 'Task Completion',
};

const RADAR_ICONS: Record<keyof RadarScores, string> = {
  pronunciation: '🗣️',
  fluency: '🌊',
  grammar: '📝',
  vocabulary: '📚',
  taskCompletion: '🎯',
};

function getScoreLevel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excellent', color: 'text-green-600' };
  if (score >= 75) return { label: 'Good', color: 'text-blue-600' };
  if (score >= 60) return { label: 'Fair', color: 'text-yellow-600' };
  return { label: 'Needs Work', color: 'text-red-600' };
}

function radarToChartData(radar: RadarScores) {
  return Object.entries(radar).map(([key, value]) => ({
    subject: RADAR_LABELS[key as keyof RadarScores],
    value,
    fullMark: 100,
  }));
}

export default function Report() {
  const navigate = useNavigate();
  const report = useSessionStore((s) => s.report);

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4 animate-pulse">
            <span className="text-3xl">📊</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Generating Report...</h1>
          <p className="text-gray-500 mb-6">Analyzing your conversation</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const chartData = radarToChartData(report.radar);
  const overallScore = Math.round(
    Object.values(report.radar).reduce((a, b) => a + b, 0) / 5,
  );
  const overallLevel = getScoreLevel(overallScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-2xl mb-3">
            <span className="text-2xl">✅</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Session Report</h1>
          <p className="text-gray-500">Your English speaking performance summary</p>
        </div>

        {/* Overall Score */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-36 h-36 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <div className="text-center">
                <span className="text-4xl font-bold text-white">{overallScore}</span>
                <span className="block text-xs text-indigo-200">/ 100</span>
              </div>
            </div>
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-white rounded-full shadow text-sm font-semibold ${overallLevel.color}`}>
              {overallLevel.label}
            </div>
          </div>
        </div>

        {/* Score bars */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Score Breakdown</h2>
          <div className="space-y-4">
            {(Object.entries(report.radar) as [keyof RadarScores, number][]).map(([key, value]) => {
              const level = getScoreLevel(value);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 flex items-center gap-2">
                      <span>{RADAR_ICONS[key]}</span>
                      {RADAR_LABELS[key]}
                    </span>
                    <span className={`text-sm font-semibold ${level.color}`}>{value}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Radar Chart */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills Radar</h2>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={chartData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" className="text-xs" tick={{ fill: '#6b7280' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Errors & Expression Upgrades */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Corrections</h2>
            {report.topErrors.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-3xl">🎉</span>
                <p className="text-gray-500 mt-2">No errors found! Great job!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {report.topErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
                    <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{err.errorType.replace('_', ' ')}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{err.count} occurrence{err.count > 1 ? 's' : ''}</p>
                      {err.example && (
                        <p className="text-xs text-red-600 mt-1 font-mono bg-red-100 px-2 py-1 rounded">{err.example}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {report.expressionUpgrades.length > 0 && (
              <div className="mt-5">
                <h3 className="text-md font-semibold text-gray-900 mb-3">✨ Expression Upgrades</h3>
                <div className="space-y-2">
                  {report.expressionUpgrades.map((upgrade, i) => (
                    <div key={i} className="bg-green-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 line-through">{upgrade.from}</p>
                      <p className="text-sm text-green-700 font-medium mt-0.5">{upgrade.to}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">📝 Summary</h2>
          <p className="text-gray-700 leading-relaxed">{report.summaryText}</p>
        </div>

        {/* Annotated Conversation */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">💬 Conversation Review</h2>
          <div className="space-y-3">
            {report.annotatedTurns.map((turn, i) => (
              <div key={i} className={`p-3 rounded-xl ${turn.role === 'user' ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${turn.role === 'user' ? 'text-indigo-600' : 'text-gray-500'}`}>
                    {turn.role === 'user' ? '👤 You' : '🤖 AI'}
                  </span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{turn.text}</p>
                {turn.corrections.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {turn.corrections.map((c, j) => (
                      <div key={j} className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded-lg">
                        <span className="line-through">{c.original}</span>
                        {' → '}
                        <span className="font-medium">{c.corrected}</span>
                        <span className="text-yellow-600 ml-2">({c.explanation})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="text-center pb-8">
          <button
            onClick={() => {
              useSessionStore.getState().reset();
              navigate('/');
            }}
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-200"
          >
            🔄 Practice Again
          </button>
        </div>
      </div>
    </div>
  );
}
