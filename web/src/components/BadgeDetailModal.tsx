import type { Achievement } from '../lib/gamification';
import { ACHIEVEMENT_ICONS } from './icons';
import { formatEarnedTime } from '../lib/achievements-store';

/**
 * 徽章详情弹窗（成就页点击已获得徽章时弹出）：
 * 大图标动画 + 名称 + 描述 + 获得时间。
 */
export default function BadgeDetailModal({
  achievement,
  earnedAt,
  onClose,
}: {
  achievement: Achievement;
  earnedAt?: number;
  onClose: () => void;
}) {
  const Icon = ACHIEVEMENT_ICONS[achievement.id];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl shadow-pop px-8 py-7 text-center max-w-xs mx-4 animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-3 right-3 w-7 h-7 rounded-full text-sub hover:bg-canvas hover:text-ink transition-colors"
        >
          ×
        </button>

        <div className="mx-auto mb-3 inline-block animate-badge-bounce">
          {Icon ? <Icon size={80} /> : <span className="text-6xl">{achievement.icon}</span>}
        </div>

        <p className="text-xl font-extrabold text-ink">{achievement.title}</p>
        <p className="text-sm text-sub mt-1.5 leading-relaxed">{achievement.desc}</p>

        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-bold">
          ✅ 已获得{earnedAt ? ` · ${formatEarnedTime(earnedAt)}` : ''}
        </div>
      </div>
    </div>
  );
}
