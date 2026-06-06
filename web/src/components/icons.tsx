/**
 * 哈密瓜主题图标库（自绘 SVG，统一线性风格）。
 * 约定：主体描边用 currentColor（继承文字色，激活态自动变色）；
 * 哈密瓜点缀色固定：橙=瓜瓤、绿=藤叶。
 */

export interface IconProps {
  size?: number;
  className?: string;
}

const ORANGE = '#FF9F1C'; // 瓜瓤
const GREEN = '#58CC02'; // 藤叶

function Svg({ size = 24, className = '', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** 练习：麦克风（罩面带哈密瓜网纹） */
export function PracticeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M10 6.5h4M10 9.5h4" stroke={ORANGE} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17.5V21M8.5 21h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** 成长：上升折线（顶端结出橙瓜 + 绿藤） */
export function GrowthIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 20h17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 16.5l4-4 3 2 4.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="8" r="2.6" fill={ORANGE} />
      <path d="M17 5.2q1-2 3-1.4" stroke={GREEN} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** 成就：奖章（盘面带瓜网纹 + 绶带） */
export function AchievementIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="9" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M6 7.4q6 3 12 0M6 10.6q6 3 12 0" stroke={ORANGE} strokeWidth="1.2" />
      <path d="M9 14.6l-1.5 6.4 4.5-2.6 4.5 2.6L15 14.6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </Svg>
  );
}

/** 我的：哈密瓜笑脸（藤蒂 + 网纹 + 笑） */
export function ProfileIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="13" r="7.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 5.5q1.6-2.6 4-2" stroke={GREEN} strokeWidth="2" strokeLinecap="round" />
      <path d="M5 11q7 4 14 0M5 15q7 4 14 0" stroke={ORANGE} strokeWidth="1.1" />
      <circle cx="9.6" cy="12.6" r="1" fill="currentColor" />
      <circle cx="14.4" cy="12.6" r="1" fill="currentColor" />
      <path d="M9.6 15.4q2.4 2 4.8 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * 哈密瓜（连续天数图标，替代多邻国火焰）。
 * 默认填充橙瓤 + 白网纹 + 绿藤；可通过 className 控制大小/位置。
 */
export function MelonIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <ellipse cx="12" cy="14" rx="8" ry="7" fill={ORANGE} />
      <path d="M5 11q7 5 14 0M5 14.5q7 5 14 0M5 18q7 4 14 0" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <path d="M12 7.2q1.6-3 4.6-2.4" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M10 7q-2-2.2-4.2-1.6" stroke={GREEN} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ============ 成就图标（彩色填充，种瓜历程） ============ */
const TEAL = '#2EC4B6'; // 瓜皮

/** 呱呱坠地：破土瓜苗 */
export function SproutIcon({ size = 28, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M6 24h20" stroke="#C8A06A" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 24V13" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 16c-1-4-5-5-8-4 0 4 4 6 8 4Z" fill={GREEN} />
      <path d="M16 13c1-4 5-5 8-3 0 4-4 5-8 3Z" fill="#7AD63A" />
    </svg>
  );
}

/** 勤浇水：水滴 */
export function WaterDropIcon({ size = 28, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M16 5c5 7 7 10 7 13a7 7 0 0 1-14 0c0-3 2-6 7-13Z" fill="#38BDF8" />
      <path d="M13 18a3 3 0 0 0 3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

/** 瓜藤盘绕：缠绕藤蔓 + 叶 */
export function VineIcon({ size = 28, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M9 27c0-6 6-6 6-11s-5-5-5-9" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M23 27c0-6-6-6-6-11s5-5 5-9" stroke="#7AD63A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <ellipse cx="11" cy="9" rx="3.5" ry="2" fill={GREEN} transform="rotate(-30 11 9)" />
      <ellipse cx="21" cy="9" rx="3.5" ry="2" fill="#7AD63A" transform="rotate(30 21 9)" />
    </svg>
  );
}

/** 老瓜熟路：一篮哈密瓜 */
export function BasketIcon({ size = 28, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <ellipse cx="11" cy="13" rx="5" ry="4.5" fill={ORANGE} />
      <ellipse cx="20" cy="12" rx="5" ry="4.5" fill={TEAL} />
      <path d="M11 4q1-2 3-1M20 4q1-2 3-1" stroke={GREEN} strokeWidth="2" strokeLinecap="round" />
      <path d="M5 15h22l-2 9a3 3 0 0 1-3 2.5H10a3 3 0 0 1-3-2.5L5 15Z" fill="#C8A06A" />
      <path d="M5 15h22" stroke="#A87E4A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 甜度爆表：滴蜜哈密瓜 */
export function HoneyMelonIcon({ size = 28, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <ellipse cx="16" cy="18" rx="10" ry="9" fill={ORANGE} />
      <path d="M7 14q9 6 18 0M7 18q9 6 18 0M7 22q9 5 18 0" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
      <path d="M16 9q2-4 6-3" stroke={GREEN} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24 6c1.5 2.2 2.5 3.4 2.5 4.6a2.5 2.5 0 0 1-5 0c0-1.2 1-2.4 2.5-4.6Z" fill="#FBBF24" />
    </svg>
  );
}

/** 瓜样百出：多彩瓜片 */
export function SlicesIcon({ size = 28, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M16 16 6 9a12 12 0 0 0-1 9Z" fill={ORANGE} />
      <path d="M16 16 5 18a12 12 0 0 0 7 8Z" fill={GREEN} />
      <path d="M16 16 12 26a12 12 0 0 0 11-3Z" fill="#FF4B4B" />
      <path d="M16 16 23 23a12 12 0 0 0 3-12Z" fill={TEAL} />
      <path d="M16 16 26 11A12 12 0 0 0 16 4Z" fill="#FBBF24" />
      <path d="M16 16 16 4A12 12 0 0 0 6 9Z" fill="#A78BFA" />
      <circle cx="16" cy="16" r="2" fill="#fff" />
    </svg>
  );
}

/** 成就 id → 自绘图标组件映射 */
export const ACHIEVEMENT_ICONS: Record<string, React.FC<IconProps>> = {
  first_step: SproutIcon,
  streak_3: WaterDropIcon,
  streak_7: VineIcon,
  ten_sessions: BasketIcon,
  high_scorer: HoneyMelonIcon,
  all_rounder: SlicesIcon,
};
