import { resolve } from 'node:path';

// Plain JavaScript on purpose: the production image must not need TypeScript.
/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@tessera/api-types'],
  // self-contained server output for the container image; files are traced from the monorepo root
  output: 'standalone',
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
};

export default config;
