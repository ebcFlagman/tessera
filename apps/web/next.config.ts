import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@tessera/api-types'],
};

export default config;
