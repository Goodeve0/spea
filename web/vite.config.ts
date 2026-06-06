import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

/**
 * 构建时将 public/sw.js 中的占位符 `__SW_CACHE_VERSION__`
 * 替换为 "speak-coach-<git-short-sha>-<yyyymmdd>" 格式的版本号。
 * 这样每次构建都会触发 SW 更新，旧缓存自动清理。
 */
function swVersionPlugin(): Plugin {
  return {
    name: 'sw-cache-version',
    apply: 'build',
    writeBundle({ dir }) {
      if (!dir) return;
      const swPath = path.join(dir, 'sw.js');
      let sha = 'local';
      try {
        sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      } catch {
        // git 不可用（如 CI 浅克隆未 fetch tag）—— 降级用时间戳
      }
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const version = `speak-coach-${sha}-${date}`;
      try {
        const content = readFileSync(swPath, 'utf8');
        writeFileSync(swPath, content.replace(/__SW_CACHE_VERSION__/g, version), 'utf8');
        console.log(`[sw-version] CACHE = '${version}'`);
      } catch {
        // dist/sw.js 不存在（public/sw.js 会被 vite 直接复制），容错
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  resolve: {
    alias: {
      '@speak-coach/shared': path.resolve(__dirname, '../shared/contracts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
});
