import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // all tests share one database and the global scoring model
  workers: 1,
  use: { baseURL: process.env.WEB_URL ?? 'http://localhost:3000' },
});
