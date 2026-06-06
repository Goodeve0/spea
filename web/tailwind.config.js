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
      },
      animation: {
        'pop-in': 'pop-in 0.4s ease-out both',
        float: 'float 3s ease-in-out infinite',
        celebrate: 'celebrate 0.6s ease-out both',
      },
    },
  },
  plugins: [],
};
