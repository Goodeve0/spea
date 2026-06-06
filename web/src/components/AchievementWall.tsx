import type { Achievement } from '../lib/gamification';
import { ACHIEVEMENT_ICONS } from './icons';

/** 成就墙：已解锁高亮、未解锁灰显并提示条件 */
export default function AchievementWall({ achievements }: { achievements: Achievement[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {achievements.map((a) => {
        const Icon = ACHIEVEMENT_ICONS[a.id];
        return (
          <div
            key={a.id}
            title={a.desc}
            className={`flex flex-col items-center text-center p-3 rounded-2xl border transition-all ${
              a.unlocked ? 'bg-white border-line shadow-card' : 'bg-canvas border-line opacity-50 grayscale'
            }`}
          >
            {Icon ? <Icon size={30} /> : <span className="text-2xl">{a.icon}</span>}
            <span className="text-[11px] font-extrabold text-ink mt-1 leading-tight">{a.title}</span>
            <span className="text-[10px] text-sub mt-0.5 leading-tight">{a.desc}</span>
          </div>
        );
      })}
    </div>
  );
}
