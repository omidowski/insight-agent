import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/global-setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/smoke/**', 'node_modules/**'],
    testTimeout: 20000,
    hookTimeout: 20000,
    pool: 'forks',
  },
  resolve: { alias: [{ find: /^@\//, replacement: root }] },
});
