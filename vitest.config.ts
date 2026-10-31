import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'domain', root: 'packages/domain', include: ['tests/**/*.test.ts'] } },
      {
        test: {
          name: 'api',
          root: 'apps/api',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['tests/helpers/global-setup.ts'],
          // all files share one database: run them one after another
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 30000,
          hookTimeout: 120000,
        },
      },
      {
        test: {
          name: 'worker',
          root: 'apps/worker',
          include: ['tests/**/*.test.ts'],
          passWithNoTests: true,
        },
      },
    ],
  },
});
