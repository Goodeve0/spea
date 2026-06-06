import { defineConfig, devices } from '@playwright/test';

/**
 * Speak Coach — Playwright E2E 配置
 *
 * 默认：在本地 dev server（vite preview）上运行。
 * CI 环境可通过 PLAYWRIGHT_BASE_URL 环境变量指定已部署的地址。
 *
 * 运行：
 *   npm run test:e2e -w web          # 本地（会自动起 preview server）
 *   PLAYWRIGHT_BASE_URL=https://xxx npm run test:e2e -w web  # CI/远程
 */
export default defineConfig({
  testDir: './e2e',
  /* 超时：每个测试 30s */
  timeout: 30_000,
  /* 最多重试 1 次（CI 偶发网络抖动） */
  retries: process.env.CI ? 1 : 0,
  /* 并行度：本地 1 个 worker 避免端口冲突 */
  workers: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173',
    /* 截图：仅在失败时保留 */
    screenshot: 'only-on-failure',
    /* trace：仅在重试时录制 */
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* 本地运行时自动起 vite preview（需先 build） */
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run preview -w web',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
