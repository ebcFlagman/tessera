import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@tessera/db', '@tessera/domain', '@tessera/connectors'],
  serverExternalPackages: ['@prisma/client', 'pg-boss'],
};

export default config;
