import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './src/test-setup.ts')],
  },
  resolve: {
    alias: {
      '@speak-coach/shared': path.resolve(__dirname, '../shared/contracts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
