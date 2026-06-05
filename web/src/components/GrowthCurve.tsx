import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { StoredSession } from '@speak-coach/shared';

const DIMS = [
  { key: 'pronunciation', label: '发音', color: '#2EC4B6' },
  { key: 'fluency', label: '流利', color: '#FF9F1C' },
  { key: 'grammar', label: '语法', color: '#6366f1' },
  { key: 'vocabulary', label: '词汇', color: '#58CC02' },
  { key: 'taskCompletion', label: '任务', color: '#FF4B4B' },
] as const;

/**
 * 成长曲线：5 维能力随历史会话的折线趋势。
 * 历史不足 2 次时展示引导空态（由 recharts 懒加载，故放在独立组件）。
 */
export default function GrowthCurve({ sessions }: { sessions: StoredSession[] }) {
  const ordered = sessions.slice().sort((a, b) => a.timestamp - b.timestamp); // 时间正序

  if (ordered.length < 2) {
    return (
      <div className="text-center py-10">
        <div className="text-4xl mb-2">📈</div>
        <p className="text-sub text-sm">再练一次，就能看到你的成长曲线啦！</p>
      </div>
    );
  }

  const data = ordered.map((s, i) => ({
    name: `第${i + 1}次`,
    pronunciation: s.radar.pronunciation,
    fluency: s.radar.fluency,
    grammar: s.radar.grammar,
    vocabulary: s.radar.vocabulary,
    taskCompletion: s.radar.taskCompletion,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
        <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 12 }} />
        <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {DIMS.map((d) => (
          <Line
            key={d.key}
            type="monotone"
            dataKey={d.key}
            name={d.label}
            stroke={d.color}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
