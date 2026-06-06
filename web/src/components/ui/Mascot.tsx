interface MascotProps {
  size?: number;
  className?: string;
}

/**
 * 「英语口语顶呱呱」吉祥物：一只戴着耳麦的哈密瓜小家伙。
 * 青绿瓜皮 + 网纹 + 橙瓤肚皮 + 藤蒂叶，呼应品牌主题；纯内联 SVG。
 */
export default function Mascot({ size = 96, className = '' }: MascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="8 4 104 104"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="英语口语顶呱呱吉祥物"
    >
      {/* 瓜身 */}
      <ellipse cx="60" cy="64" rx="40" ry="42" fill="#2EC4B6" />
      <ellipse cx="60" cy="64" rx="40" ry="42" fill="url(#mascotShine)" fillOpacity="0.25" />
      {/* 哈密瓜网纹（裁剪在瓜身内） */}
      <g clipPath="url(#mascotBody)" stroke="#FFFFFF" strokeWidth="1.4" fill="none" opacity="0.5" strokeLinecap="round">
        <path d="M40 24 Q34 64 43 104" />
        <path d="M60 22 Q57 64 60 106" />
        <path d="M80 24 Q86 64 77 104" />
        <path d="M20 48 Q60 42 100 48" />
        <path d="M18 78 Q60 86 102 78" />
      </g>
      {/* 瓤色肚皮 */}
      <ellipse cx="60" cy="74" rx="24" ry="26" fill="#FFF3E0" />
      {/* 眼睛 */}
      <circle cx="48" cy="56" r="8" fill="#fff" />
      <circle cx="72" cy="56" r="8" fill="#fff" />
      <circle cx="49" cy="57" r="4" fill="#2B2B2B" />
      <circle cx="73" cy="57" r="4" fill="#2B2B2B" />
      <circle cx="50.5" cy="55.5" r="1.3" fill="#fff" />
      <circle cx="74.5" cy="55.5" r="1.3" fill="#fff" />
      {/* 腮红 */}
      <circle cx="40" cy="68" r="4" fill="#FF9F1C" fillOpacity="0.45" />
      <circle cx="80" cy="68" r="4" fill="#FF9F1C" fillOpacity="0.45" />
      {/* 微笑 */}
      <path d="M52 70 Q60 78 68 70" stroke="#2B2B2B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* 哈密瓜藤蒂 + 叶 */}
      <path d="M60 23 Q59 14 61 9" stroke="#21998E" strokeWidth="4" strokeLinecap="round" fill="none" />
      <ellipse cx="67" cy="9.5" rx="5" ry="2.8" fill="#58CC02" transform="rotate(28 67 9.5)" />
      <ellipse cx="53.5" cy="11" rx="4" ry="2.4" fill="#7AD63A" transform="rotate(-30 53.5 11)" />
      {/* 耳麦 */}
      <path d="M30 56 Q30 34 60 34 Q90 34 90 56" stroke="#FF9F1C" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="26" y="54" width="9" height="16" rx="4" fill="#FF9F1C" />
      <rect x="85" y="54" width="9" height="16" rx="4" fill="#FF9F1C" />
      {/* 麦克风 */}
      <path d="M30 70 Q30 88 50 88" stroke="#FF9F1C" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="52" cy="88" r="4" fill="#FF4B4B" />
      <defs>
        <clipPath id="mascotBody">
          <ellipse cx="60" cy="64" rx="40" ry="42" />
        </clipPath>
        <linearGradient id="mascotShine" x1="60" y1="22" x2="60" y2="106" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#2EC4B6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
