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

/* ============ 通用功能图标（线性，currentColor 主体） ============ */

/** 星：等级 / 收藏 */
export function StarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2l2.9 6.3L22 9.2l-5 5.1L18.2 22 12 18.5 5.8 22 7 14.3l-5-5.1 7.1-.9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2.2" fill={ORANGE} />
    </Svg>
  );
}

/** 闪电：能量 / XP */
export function BoltIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11.5 7L14 5.5" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** 靶心：目标 / 任务完成 */
export function TargetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2" fill={ORANGE} />
    </Svg>
  );
}

/** 派对礼花：庆祝 / 升级 */
export function PartyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 21l4-8 4 2-4-10 8 6-5 2.5L18 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="19" cy="4" r="1.2" fill={ORANGE} />
      <circle cx="7" cy="3" r="1" fill={GREEN} />
      <circle cx="4" cy="8" r="0.9" fill={ORANGE} />
    </Svg>
  );
}

/** 闪光：提示 / 更好表达 */
export function SparkleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" fill={ORANGE} />
    </Svg>
  );
}

/** 灯泡：提示 / 建议 */
export function LightbulbIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18h6M10 21h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9h4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** 笔记：总结 / 笔记 */
export function NoteIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 7h6M9 11h6M9 15h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="18" r="2" fill={ORANGE} />
    </Svg>
  );
}

/** 对话气泡：聊天 / 回顾 */
export function ChatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 12a9 9 0 0 1-9 9c-1.7 0-3.3-.5-4.7-1.3L3 21l1.3-4.3A9 9 0 1 1 21 12z" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="12" r="1.2" fill={ORANGE} />
      <circle cx="12" cy="12" r="1.2" fill={ORANGE} />
      <circle cx="15.5" cy="12" r="1.2" fill={ORANGE} />
    </Svg>
  );
}

/** 循环箭头：重述 / 重来 */
export function RecastIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M17.5 6.5A7.5 7.5 0 0 0 6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.5 17.5A7.5 7.5 0 0 0 17.5 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.5 6.5v4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 17.5v-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** 刷新：再练一次 */
export function RefreshIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M1 4v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 16A9 9 0 1 0 5.6 5.6L1 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="13" cy="4" r="1.5" fill={ORANGE} />
    </Svg>
  );
}

/** 人物：用户 */
export function PersonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 21v-1a7 7 0 0 1 16 0v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** 机器人：AI */
export function RobotIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="8" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="14" r="1.5" fill={ORANGE} />
      <circle cx="15" cy="14" r="1.5" fill={ORANGE} />
      <path d="M10 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 4v4M9 6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/* ============ 雷达维度图标（16px inline，彩色小图标） ============ */

/** 发音：嘴巴 + 音波 */
export function PronunciationIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M8 10a4 4 0 0 0 0 8" stroke={TEAL} strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6a8 8 0 0 0 0 16" stroke={TEAL} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <ellipse cx="13" cy="12" rx="3" ry="4" fill={ORANGE} />
    </svg>
  );
}

/** 流利度：波浪 */
export function FluencyIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** 语法：勾划 */
export function GrammarIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 7h8M4 12h16M4 17h10" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 14l2 2 3-4" stroke="#8B5CF6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 词汇：书本 */
export function VocabularyIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 4h12a2 2 0 0 1 2 2v14l-3-2-3 2V6a2 2 0 0 0-2-2H4z" stroke={GREEN} strokeWidth="2" />
      <path d="M4 4v14l3-2 3 2" stroke={GREEN} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** 任务完成：对勾靶心 */
export function TaskIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#FF4B4B" strokeWidth="2" />
      <path d="M8 12l3 3 5-5" stroke="#FF4B4B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 雷达维度 key → 图标组件映射 */
export const RADAR_DIM_ICONS: Record<string, React.FC<IconProps>> = {
  pronunciation: PronunciationIcon,
  fluency: FluencyIcon,
  grammar: GrammarIcon,
  vocabulary: VocabularyIcon,
  taskCompletion: TaskIcon,
};

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

/** 瓜熟蒂落：熟瓜坠落 */
export function RipeDropIcon({ size = 28, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <ellipse cx="16" cy="19" rx="8" ry="7" fill={ORANGE} />
      <path d="M9 16q7 5 14 0M9 19.5q7 5 14 0" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <path d="M16 12q1-2.5 3.5-2" stroke={GREEN} strokeWidth="2" strokeLinecap="round" />
      <path d="M5 8l4 6M27 8l-4 6" stroke={TEAL} strokeWidth="2" strokeLinecap="round" />
      <path d="M7 6l2 2M25 6l-2 2" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** 夜半偷瓜：月亮+猫头鹰眼 */
export function NightOwlIcon({ size = 28, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M22 6a9 9 0 1 0 0 18 7 7 0 0 1 0-18Z" fill="#FBBF24" />
      <circle cx="12" cy="16" r="6" fill="#1E293B" />
      <circle cx="10" cy="15" r="2.2" fill="#FBBF24" />
      <circle cx="14" cy="15" r="2.2" fill="#FBBF24" />
      <circle cx="10" cy="15" r="1" fill="#1E293B" />
      <circle cx="14" cy="15" r="1" fill="#1E293B" />
      <path d="M11 18l1 1 1-1" stroke="#FBBF24" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 10q2-2 3.5 0M16 10q2-2 3.5 0" stroke="#1E293B" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 速成瓜：闪电+瓜 */
export function SpeedIcon({ size = 28, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <ellipse cx="16" cy="20" rx="9" ry="8" fill={ORANGE} />
      <path d="M8 17q8 5 16 0M8 20.5q8 5 16 0" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <path d="M16 12q1-2.5 4-2" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M19 3l-4 8h5l-4 8" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 瓜神降临：瓜戴皇冠 */
export function CrownIcon({ size = 28, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <ellipse cx="16" cy="22" rx="9" ry="7" fill={ORANGE} />
      <path d="M8 19q8 5 16 0M8 22q8 5 16 0" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <path d="M7 16l3-7 3 4 3-7 3 7 3-4 3 7z" fill="#FBBF24" stroke="#D97706" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="10" cy="9" r="1.2" fill="#FF4B4B" />
      <circle cx="16" cy="6" r="1.2" fill="#FF4B4B" />
      <circle cx="22" cy="9" r="1.2" fill="#FF4B4B" />
    </svg>
  );
}

/** 成就 id → 自绘图标组件映射 */
export const ACHIEVEMENT_ICONS: Record<string, React.FC<IconProps>> = {
  first_step: SproutIcon,
  streak_3: WaterDropIcon,
  streak_7: VineIcon,
  streak_14: RipeDropIcon,
  ten_sessions: BasketIcon,
  night_owl: NightOwlIcon,
  speed_run: SpeedIcon,
  high_scorer: HoneyMelonIcon,
  all_rounder: SlicesIcon,
  perfect_five: CrownIcon,
};
