import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // 多个测试文件共享同一个 SQLite dev.db；串行执行避免跨文件清表互相干扰
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@speak-coach/shared': path.resolve(__dirname, '../shared/contracts'),
    },
  },
});
