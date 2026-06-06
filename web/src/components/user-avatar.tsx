/**
 * 用户头像组件：8 款哈密瓜风 SVG 头像，按 avatarKey 渲染。
 * 若 customAvatarUrl 有值（登录用户上传），优先展示自定义图片。
 * 用于 Profile、Sidebar、BottomTabBar 等处统一展示。
 */
import type { AvatarKey } from '../store/settings';

const ORANGE = '#FF9F1C';
const TEAL = '#2EC4B6';
const GREEN = '#58CC02';
const PINK = '#F472B6';

interface Props {
  avatarKey: AvatarKey;
  size?: number;
  className?: string;
  /** 登录用户上传的自定义头像 URL（data URL / 普通 URL），有值时覆盖 avatarKey */
  customAvatarUrl?: string | null;
}

function CircleBg({ size = 40, color, children }: { size?: number; color: string; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill={color} />
      {children}
    </svg>
  );
}

/** 哈密瓜脸 */
function MelonAvatar({ size }: { size?: number }) {
  return (
    <CircleBg size={size} color={TEAL}>
      <ellipse cx="20" cy="22" rx="13" ry="11" fill={ORANGE} />
      <path d="M9 18q11 7 22 0M9 22q11 7 22 0" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <circle cx="15" cy="20" r="1.5" fill="#333" />
      <circle cx="25" cy="20" r="1.5" fill="#333" />
      <path d="M16 24q4 3 8 0" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 11q1-3 4-2M16 12q-2-2.5-4.5-1.5" stroke={GREEN} strokeWidth="2" strokeLinecap="round" />
    </CircleBg>
  );
}

/** 瓜苗 */
function SproutAvatar({ size }: { size?: number }) {
  return (
    <CircleBg size={size} color="#ECFDF5">
      <path d="M20 30V17" stroke={GREEN} strokeWidth="3" strokeLinecap="round" />
      <path d="M20 21c-2-5-8-6-11-3 1 5 7 7 11 3Z" fill={GREEN} />
      <path d="M20 17c2-5 8-6 11-2-1 5-7 6-11 2Z" fill="#7AD63A" />
      <path d="M16 12q2-4 6-3" stroke={GREEN} strokeWidth="2" strokeLinecap="round" />
    </CircleBg>
  );
}

/** 花朵 */
function FlowerAvatar({ size }: { size?: number }) {
  return (
    <CircleBg size={size} color="#FFF7ED">
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx="20" cy="10" rx="4" ry="7"
          fill={PINK}
          opacity="0.8"
          transform={`rotate(${deg} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="4.5" fill={ORANGE} />
      <circle cx="20" cy="20" r="2" fill="#FBBF24" />
    </CircleBg>
  );
}

/** 太阳 */
function SunAvatar({ size }: { size?: number }) {
  return (
    <CircleBg size={size} color="#FFFBEB">
      <circle cx="20" cy="20" r="7" fill={ORANGE} />
      <circle cx="20" cy="20" r="4" fill="#FBBF24" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="20" y1="8" x2="20" y2="5"
          stroke={ORANGE}
          strokeWidth="2.5"
          strokeLinecap="round"
          transform={`rotate(${deg} 20 20)`}
        />
      ))}
    </CircleBg>
  );
}

/** 月亮 */
function MoonAvatar({ size }: { size?: number }) {
  return (
    <CircleBg size={size} color="#F0F9FF">
      <path d="M24 10a10 10 0 1 0 0 20 8 8 0 0 1 0-20Z" fill="#FBBF24" />
      <circle cx="28" cy="12" r="1.2" fill="#FDE68A" />
      <circle cx="30" cy="22" r="0.8" fill="#FDE68A" />
      <circle cx="22" cy="28" r="1" fill="#FDE68A" />
    </CircleBg>
  );
}

/** 彩虹 */
function RainbowAvatar({ size }: { size?: number }) {
  return (
    <CircleBg size={size} color="#FFF1F2">
      <path d="M6 28a14 14 0 0 1 28 0" stroke="#FF4B4B" strokeWidth="2.5" fill="none" />
      <path d="M8.5 28a11.5 11.5 0 0 1 23 0" stroke={ORANGE} strokeWidth="2.5" fill="none" />
      <path d="M11 28a9 9 0 0 1 18 0" stroke="#FBBF24" strokeWidth="2.5" fill="none" />
      <path d="M13.5 28a6.5 6.5 0 0 1 13 0" stroke={GREEN} strokeWidth="2.5" fill="none" />
      <path d="M16 28a4 4 0 0 1 8 0" stroke={TEAL} strokeWidth="2.5" fill="none" />
    </CircleBg>
  );
}

/** 叶子 */
function LeafAvatar({ size }: { size?: number }) {
  return (
    <CircleBg size={size} color="#F0FDF4">
      <path d="M12 30c0-10 8-16 16-18-2 10-10 16-16 18Z" fill={GREEN} />
      <path d="M12 30c4-4 10-10 16-18" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M16 26q2-3 4-4M14 28q0-3 2-5" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </CircleBg>
  );
}

/** 星星 */
function StarAvatar({ size }: { size?: number }) {
  return (
    <CircleBg size={size} color="#FEF3C7">
      <path
        d="M20 8l2.8 8.5H32l-7.2 5.3 2.8 8.5L20 25l-7.6 5.3 2.8-8.5L8 16.5h9.2z"
        fill={ORANGE}
      />
      <path
        d="M20 12l1.8 5.5H28l-4.6 3.4 1.8 5.5L20 23l-4.9 3.4 1.8-5.5L12.3 17.5h5.9z"
        fill="#FBBF24"
      />
    </CircleBg>
  );
}

const RENDERERS: Record<AvatarKey, (props: { size?: number }) => JSX.Element> = {
  melon: MelonAvatar,
  sprout: SproutAvatar,
  flower: FlowerAvatar,
  sun: SunAvatar,
  moon: MoonAvatar,
  rainbow: RainbowAvatar,
  leaf: LeafAvatar,
  star: StarAvatar,
};

export function UserAvatar({ avatarKey, size = 40, className = '', customAvatarUrl }: Props) {
  if (customAvatarUrl) {
    return (
      <span
        className={`inline-flex items-center justify-center overflow-hidden rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={customAvatarUrl}
          alt="头像"
          className="w-full h-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </span>
    );
  }
  const Render = RENDERERS[avatarKey] ?? MelonAvatar;
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <Render size={size} />
    </span>
  );
}
