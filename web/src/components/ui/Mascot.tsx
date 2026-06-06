interface MascotProps {
  size?: number;
  className?: string;
}

/**
 * Speak Coach 吉祥物：一只友好、戴着耳麦的小生物，呼应"口语陪练/AI 外教"。
 * 纯内联 SVG，无需额外资源；用于替代抽象 emoji，建立情感连接。
 */
export default function Mascot({ size = 96, className = '' }: MascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Speak Coach mascot"
    >
      {/* 身体 */}
      <ellipse cx="60" cy="64" rx="40" ry="42" fill="#2EC4B6" />
      <ellipse cx="60" cy="64" rx="40" ry="42" fill="url(#g)" fillOpacity="0.25" />
      {/* 肚皮 */}
      <ellipse cx="60" cy="74" rx="26" ry="28" fill="#E6F8F6" />
      {/* 眼睛 */}
      <circle cx="48" cy="56" r="8" fill="#fff" />
      <circle cx="72" cy="56" r="8" fill="#fff" />
      <circle cx="49" cy="57" r="4" fill="#2B2B2B" />
      <circle cx="73" cy="57" r="4" fill="#2B2B2B" />
      <circle cx="50.5" cy="55.5" r="1.3" fill="#fff" />
      <circle cx="74.5" cy="55.5" r="1.3" fill="#fff" />
      {/* 腮红 */}
      <circle cx="40" cy="68" r="4" fill="#FF9F1C" fillOpacity="0.4" />
      <circle cx="80" cy="68" r="4" fill="#FF9F1C" fillOpacity="0.4" />
      {/* 微笑 */}
      <path d="M52 70 Q60 78 68 70" stroke="#2B2B2B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* 头顶小苗（成长感） */}
      <path d="M60 22 Q60 14 66 12" stroke="#21998E" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="67" cy="11" rx="4" ry="2.5" fill="#58CC02" transform="rotate(30 67 11)" />
      {/* 耳麦 */}
      <path d="M30 56 Q30 34 60 34 Q90 34 90 56" stroke="#FF9F1C" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="26" y="54" width="9" height="16" rx="4" fill="#FF9F1C" />
      <rect x="85" y="54" width="9" height="16" rx="4" fill="#FF9F1C" />
      {/* 麦克风 */}
      <path d="M30 70 Q30 88 50 88" stroke="#FF9F1C" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="52" cy="88" r="4" fill="#FF4B4B" />
      <defs>
        <linearGradient id="g" x1="60" y1="22" x2="60" y2="106" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#2EC4B6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
