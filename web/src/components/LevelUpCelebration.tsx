import { useEffect } from 'react';

import { MelonIcon } from './icons';
import { levelStage } from '../lib/gamification';

/** 撒落的小瓜（随机位置/延迟/大小，纯展示） */
const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 7 + 4) % 100}%`,
  delay: `${(i % 7) * 0.18}s`,
  size: 14 + (i % 4) * 6,
}));

/**
 * 瓜级提升全屏庆祝：大瓜弹出 + 撒瓜，呼应「种瓜得瓜」。
 * 4 秒后自动关闭，点击背景或按钮亦可关闭。
 */
export default function LevelUpCelebration({ level, onClose }: { level: number; onClose: () => void }) {
  const stage = levelStage(level);

  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 撒瓜 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <div
            key={i}
            className="absolute top-0 animate-confetti-fall"
            style={{ left: c.left, animationDelay: c.delay }}
          >
            <MelonIcon size={c.size} />
          </div>
        ))}
      </div>

      {/* 中心卡 */}
      <div
        className="relative bg-white rounded-3xl shadow-pop px-8 py-7 text-center max-w-xs mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 inline-block animate-melon-burst">
          <MelonIcon size={88} />
        </div>
        <p className="text-sm font-bold text-accent-dark">瓜级提升！</p>
        <p className="text-2xl font-extrabold text-ink mt-1">
          Lv.{level} · {stage.name} {stage.emoji}
        </p>
        <p className="text-xs text-sub mt-2">你的瓜又熟了一圈，继续浇水！</p>
        <button
          onClick={onClose}
          className="mt-5 px-6 py-2.5 bg-primary text-white rounded-2xl font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all"
        >
          继续 →
        </button>
      </div>
    </div>
  );
}
