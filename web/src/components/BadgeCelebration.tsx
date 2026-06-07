import { useEffect } from 'react';

import type { Achievement } from '../lib/gamification';
import { ACHIEVEMENT_ICONS, MelonIcon } from './icons';

/** 撒落小瓜 */
const CONFETTI = Array.from({ length: 12 }, (_, i) => ({
  left: `${(i * 8 + 5) % 100}%`,
  delay: `${(i % 6) * 0.2}s`,
  size: 14 + (i % 4) * 6,
}));

/**
 * 新徽章解锁全屏庆祝（报告页）：展示本次新获得的一个或多个徽章。
 * 4.5 秒后自动关闭，点击背景/按钮亦可关闭。
 */
export default function BadgeCelebration({
  badges,
  onClose,
}: {
  badges: Achievement[];
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  if (badges.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <div key={i} className="absolute top-0 animate-confetti-fall" style={{ left: c.left, animationDelay: c.delay }}>
            <MelonIcon size={c.size} />
          </div>
        ))}
      </div>

      <div
        className="relative bg-white rounded-3xl shadow-pop px-8 py-7 text-center max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-bold text-accent-dark mb-1">🎉 解锁新徽章！</p>
        <p className="text-xs text-sub mb-4">
          {badges.length > 1 ? `一口气拿下 ${badges.length} 枚徽章` : '又收获一枚徽章'}
        </p>

        <div className="flex flex-wrap items-start justify-center gap-4 mb-5">
          {badges.slice(0, 6).map((b, i) => {
            const Icon = ACHIEVEMENT_ICONS[b.id];
            return (
              <div
                key={b.id}
                className="flex flex-col items-center w-20 animate-melon-burst"
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                <div className="animate-badge-bounce">
                  {Icon ? <Icon size={48} /> : <span className="text-4xl">{b.icon}</span>}
                </div>
                <span className="text-[11px] font-extrabold text-ink mt-1 leading-tight">{b.title}</span>
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-primary text-white rounded-2xl font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all"
        >
          太棒了 →
        </button>
      </div>
    </div>
  );
}
