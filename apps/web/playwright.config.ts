import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 120_000,
  expect: { timeout: 15_000 },
  testDir: '.',
  testMatch: ['qa.spec.ts', 'qa-minimax.spec.ts'],
  use: {
    actionTimeout: 15_000,
    proxy: process.env.VIBE_TEST_PROXY ? { server: process.env.VIBE_TEST_PROXY } : undefined,
  },
});
