/**
 * Smoke E2E — 基础冒烟测试
 *
 * 目标：验证应用最小可用路径，发现明显的白屏/路由崩溃。
 * 不依赖后端（不登录、不调 API），纯前端渲染断言。
 *
 * 运行：npm run test:e2e -w web
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke — 主页 & 场景选择', () => {
  test('主页渲染 Home，展示开始练习入口/推荐场景', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 10_000 });

    const pageText = await page.textContent('body');
    const hasEntry =
      pageText?.includes('开始练习') ||
      pageText?.includes('今日推荐') ||
      pageText?.includes('Interview') ||
      pageText?.includes('interview') ||
      pageText?.includes('种瓜得瓜');

    expect(hasEntry).toBe(true);
  });

  test('练习页 /practice 展示场景卡片', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 10_000 });

    const pageText = await page.textContent('body');
    const hasScenario =
      pageText?.includes('选个场景') ||
      pageText?.includes('Interview') ||
      pageText?.includes('interview') ||
      pageText?.includes('餐厅') ||
      pageText?.includes('会议');

    expect(hasScenario).toBe(true);
  });

  test('导航到 /login 渲染登录页', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 10_000 });

    const pageText = await page.textContent('body');
    const hasLoginContent =
      pageText?.includes('Login') ||
      pageText?.includes('登录') ||
      pageText?.includes('Email') ||
      pageText?.includes('Password');

    expect(hasLoginContent).toBe(true);
  });

  test('导航到 /progress 渲染进度页（无需登录状态也不崩溃）', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 10_000 });

    // 页面不应有 React 白屏（无 #root 内容）
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty();
  });

  test('导航到 /buddies 渲染瓜友页（无需登录状态也不崩溃）', async ({ page }) => {
    await page.goto('/buddies');
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 10_000 });

    const root = page.locator('#root');
    await expect(root).not.toBeEmpty();
  });

  test('导航到不存在的路由不出现 JS 错误（SPA fallback）', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/this-route-does-not-exist-404-check');
    // SPA fallback 会把所有路径打到 index.html，React Router 渲染 / 路由
    // 不应有 uncaught JS error
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});
