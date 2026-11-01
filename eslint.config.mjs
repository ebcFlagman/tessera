import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'packages/api-types/src/schema.d.ts',
      '.claude/**',
      '.specify/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // plain Node scripts
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    // Constitution VII: the frontend talks to the API only through the generated client.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/lib/api.ts', 'apps/web/src/lib/auth.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Use the generated API client from apps/web/src/lib/api.ts.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['axios', 'ky', 'ofetch'], message: 'Use the generated API client.' },
          ],
        },
      ],
    },
  },
);
