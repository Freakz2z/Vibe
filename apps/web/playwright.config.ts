import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 120_000,
  expect: { timeout: 15_000 },
  testDir: '.',
  testMatch: 'qa.spec.ts',
  use: {
    proxy: process.env.VIBE_TEST_PROXY ? { server: process.env.VIBE_TEST_PROXY } : undefined,
  },
});
