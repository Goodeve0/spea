import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StoredSession } from '@speak-coach/shared';

import LevelUpCelebration from '../components/LevelUpCelebration';
import AchievementWall from '../components/AchievementWall';
import GardenHeatmap from '../components/GardenHeatmap';
import {
  MelonIcon,
  PracticeIcon,
  GrowthIcon,
  AchievementIcon,
  ProfileIcon,
  SproutIcon,
  WaterDropIcon,
  VineIcon,
  BasketIcon,
  HoneyMelonIcon,
  SlicesIcon,
} from '../components/icons';
import { evaluateAchievements, levelStage } from '../lib/gamification';

const DAY = 86400000;

// 造一批演示数据：12 次、5 种场景、含 90+ 分、分布在不同天
const DEMO_SESSIONS: StoredSession[] = Array.from({ length: 12 }, (_, i) => ({
  id: `demo-${i}`,
  timestamp: Date.now() - i * DAY * 1.3,
  scenarioId: ['interview', 'meeting', 'restaurant', 'doctor', 'shopping'][i % 5],
  difficulty: 'intermediate',
  radar: { pronunciation: 80 + (i % 15), fluency: 75, grammar: 78, vocabulary: 82, taskCompletion: 88 },
  overallScore: 80 + (i % 15),
  cefrEstimate: 'B1',
}));

const NAV_ICONS = [
  { Icon: PracticeIcon, label: '练习' },
  { Icon: GrowthIcon, label: '成长' },
  { Icon: AchievementIcon, label: '成就' },
  { Icon: ProfileIcon, label: '我的' },
  { Icon: MelonIcon, label: '连续天数' },
];

const ACH_ICONS = [
  { Icon: SproutIcon, label: '呱呱坠地' },
  { Icon: WaterDropIcon, label: '勤浇水' },
  { Icon: VineIcon, label: '瓜藤盘绕' },
  { Icon: BasketIcon, label: '老瓜熟路' },
  { Icon: HoneyMelonIcon, label: '甜度爆表' },
  { Icon: SlicesIcon, label: '瓜样百出' },
];

const LEVELS = [3, 6, 10, 15];

export default function DevPreview() {
  const navigate = useNavigate();
  const [celebrateLevel, setCelebrateLevel] = useState<number | null>(null);
  const achievements = evaluateAchievements(DEMO_SESSIONS, 7);

  return (
    <div className="min-h-screen bg-canvas">
      {celebrateLevel !== null && (
        <LevelUpCelebration level={celebrateLevel} onClose={() => setCelebrateLevel(null)} />
      )}

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-ink">🍈 设计预览（彩排页）</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-2xl bg-white border border-line font-bold text-sub hover:text-ink transition-colors"
          >
            返回首页
          </button>
        </header>

        {/* 升级动画 */}
        <section className="bg-white rounded-3xl border border-line shadow-card p-5">
          <h2 className="font-extrabold text-ink mb-3">瓜级升级庆祝动画</h2>
          <p className="text-sm text-sub mb-4">点击任意按钮预览不同瓜级的升级动画（大瓜弹出 + 撒瓜）</p>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((lv) => {
              const s = levelStage(lv);
              return (
                <button
                  key={lv}
                  onClick={() => setCelebrateLevel(lv)}
                  className="px-4 py-2.5 rounded-2xl bg-primary text-white font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all"
                >
                  升到 Lv.{lv} · {s.name} {s.emoji}
                </button>
              );
            })}
          </div>
        </section>

        {/* 图标一览 */}
        <section className="bg-white rounded-3xl border border-line shadow-card p-5">
          <h2 className="font-extrabold text-ink mb-3">导航 / 状态图标</h2>
          <div className="grid grid-cols-5 gap-3 mb-5">
            {NAV_ICONS.map(({ Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 text-primary-dark">
                <Icon size={30} />
                <span className="text-[11px] font-bold text-sub">{label}</span>
              </div>
            ))}
          </div>
          <h2 className="font-extrabold text-ink mb-3">成就图标</h2>
          <div className="grid grid-cols-6 gap-3">
            {ACH_ICONS.map(({ Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <Icon size={30} />
                <span className="text-[10px] font-bold text-sub text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 成就墙 */}
        <section className="bg-white rounded-3xl border border-line shadow-card p-5">
          <h2 className="font-extrabold text-ink mb-3">成就墙（演示：全解锁）</h2>
          <AchievementWall achievements={achievements} />
        </section>

        {/* 瓜田 */}
        <section className="bg-white rounded-3xl border border-line shadow-card p-5">
          <h2 className="font-extrabold text-ink mb-3">我的瓜田（演示数据）</h2>
          <GardenHeatmap sessions={DEMO_SESSIONS} />
        </section>
      </div>
    </div>
  );
}
