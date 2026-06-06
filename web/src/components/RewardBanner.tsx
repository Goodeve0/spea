import { levelInfo } from '../lib/gamification';
import { MelonIcon, PartyIcon, BoltIcon } from './icons';

/** 报告页即时奖励横幅：本次 +XP、连击、等级进度；升级时庆祝 */
export default function RewardBanner({
  gainedXp,
  totalXp,
  streak,
}: {
  gainedXp: number;
  totalXp: number;
  streak: number;
}) {
  const after = levelInfo(totalXp);
  const before = levelInfo(Math.max(0, totalXp - gainedXp));
  const leveledUp = after.level > before.level;

  return (
    <div className="mb-6 animate-celebrate rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white shadow-pop text-center">
      {leveledUp ? (
        <>
          <PartyIcon size={36} className="mx-auto mb-1 text-white" />
          <p className="text-xl font-extrabold">升到 Lv.{after.level}！</p>
        </>
      ) : (
        <p className="text-lg font-extrabold flex items-center justify-center gap-2">
          练习完成，奖励到账 <PartyIcon size={20} className="text-white" />
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm font-bold">
        <span className="px-3 py-1 rounded-full bg-white/20 flex items-center gap-1"><BoltIcon size={14} className="text-white" />+{gainedXp} XP</span>
        <span className="px-3 py-1 rounded-full bg-white/20 flex items-center gap-1"><MelonIcon size={14} /> 连击 {streak} 天</span>
        <span className="px-3 py-1 rounded-full bg-white/20">Lv.{after.level}</span>
      </div>

      <div className="mt-3 mx-auto max-w-xs h-2 bg-white/25 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all duration-700"
          style={{ width: `${Math.max(4, Math.round(after.progress * 100))}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-white/75">
        距 Lv.{after.level + 1} 还差 {Math.max(0, after.nextLevelXp - after.totalXp)} XP
      </p>
    </div>
  );
}
