/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Speak Coach 设计系统主色板
        primary: { DEFAULT: '#2EC4B6', dark: '#21998E', light: '#E6F8F6' },
        accent: { DEFAULT: '#FF9F1C', dark: '#E08600' },
        success: '#58CC02',
        warning: '#FFC800',
        danger: { DEFAULT: '#FF4B4B', dark: '#E03B3B' },
        ink: '#2B2B2B',
        sub: '#6B7280',
        line: '#E5E7EB',
        canvas: '#F7F8FA',
      },
      boxShadow: {
        // 卡片柔和投影 + 3D 控件厚度感
        card: '0 6px 20px rgba(17, 24, 39, 0.06)',
        pop: '0 10px 30px rgba(46, 196, 182, 0.25)',
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        celebrate: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '60%': { transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'melon-burst': {
          '0%': { opacity: '0', transform: 'scale(0) rotate(-20deg)' },
          '60%': { opacity: '1', transform: 'scale(1.15) rotate(8deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'confetti-fall': {
          '0%': { opacity: '1', transform: 'translateY(-12vh) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateY(110vh) rotate(360deg)' },
        },
        'badge-bounce': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-6px) rotate(-6deg)' },
          '75%': { transform: 'translateY(-3px) rotate(6deg)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.4s ease-out both',
        float: 'float 3s ease-in-out infinite',
        celebrate: 'celebrate 0.6s ease-out both',
        'melon-burst': 'melon-burst 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'confetti-fall': 'confetti-fall 2.6s linear forwards',
        'badge-bounce': 'badge-bounce 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
