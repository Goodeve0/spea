import type { Achievement } from '../lib/gamification';
import { ACHIEVEMENT_ICONS } from './icons';

/**
 * 成就墙：已解锁高亮可点击（弹详情）、未解锁灰显并提示条件。
 * 已解锁徽章带悬浮/点击动画，点击触发 onSelect。
 */
export default function AchievementWall({
  achievements,
  onSelect,
}: {
  achievements: Achievement[];
  onSelect?: (a: Achievement) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {achievements.map((a) => {
        const Icon = ACHIEVEMENT_ICONS[a.id];
        const clickable = a.unlocked && !!onSelect;
        return (
          <button
            key={a.id}
            type="button"
            title={a.unlocked ? '点击查看详情' : a.desc}
            disabled={!clickable}
            onClick={() => clickable && onSelect?.(a)}
            className={`group flex flex-col items-center text-center p-3 rounded-2xl border transition-all ${
              a.unlocked
                ? 'bg-white border-line shadow-card hover:-translate-y-1 hover:shadow-pop active:translate-y-0 cursor-pointer'
                : 'bg-canvas border-line opacity-50 grayscale cursor-default'
            }`}
          >
            <span className={a.unlocked ? 'transition-transform group-hover:scale-110 group-hover:animate-badge-bounce' : ''}>
              {Icon ? <Icon size={30} /> : <span className="text-2xl">{a.icon}</span>}
            </span>
            <span className="text-[11px] font-extrabold text-ink mt-1 leading-tight">{a.title}</span>
            <span className="text-[10px] text-sub mt-0.5 leading-tight">{a.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
