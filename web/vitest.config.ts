import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest 专用配置（与 vite.config.ts 分离，避免 Playwright e2e 测试被误收）
 * E2E 测试由 Playwright 单独负责（npm run test:e2e）
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@speak-coach/shared': path.resolve(__dirname, '../shared/contracts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // 明确只收录 src/ 下的单元测试，排除 Playwright e2e 目录
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    environment: 'jsdom',
    globals: false,
  },
});
