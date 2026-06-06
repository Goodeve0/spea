import { levelInfo } from '../../lib/gamification';

/** 等级徽章 + 经验进度条 */
export default function LevelBar({ totalXp, compact = false }: { totalXp: number; compact?: boolean }) {
  const l = levelInfo(totalXp);
  return (
    <div className="flex items-center gap-2" title={`Lv.${l.level} · ${l.intoLevel}/${l.levelSpan} XP`}>
      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white text-xs font-extrabold flex items-center justify-center shadow-pop flex-shrink-0">
        {l.level}
      </span>
      {!compact && (
        <div className={`h-2 rounded-full bg-canvas overflow-hidden ${compact ? 'w-16' : 'w-20 sm:w-28'}`}>
          <div
            className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-700"
            style={{ width: `${Math.max(4, Math.round(l.progress * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}
