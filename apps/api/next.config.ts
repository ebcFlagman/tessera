import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@tessera/db', '@tessera/domain'],
  serverExternalPackages: ['@prisma/client'],
};

export default config;
