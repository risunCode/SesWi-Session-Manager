import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { WxtVitest } from 'wxt/testing';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': fileURLToPath(new URL('./app', import.meta.url)),
  '@app': fileURLToPath(new URL('./app', import.meta.url)),
  '@features': fileURLToPath(new URL('./app/features', import.meta.url)),
  '@platform': fileURLToPath(new URL('./app/platform', import.meta.url)),
  '@shared': fileURLToPath(new URL('./app/shared', import.meta.url)),
  '@styles': fileURLToPath(new URL('./app/styles', import.meta.url)),
};

export default defineConfig({
  plugins: [vue(), WxtVitest()],
  resolve: { alias },
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts', 'app/**/*.test.tsx'],
    exclude: ['node_modules', '.wxt', 'dist', 'old_3.5'],
  },
});
