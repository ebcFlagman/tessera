// Plain JavaScript on purpose: `next start` in the production image must not need TypeScript.
/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@tessera/db', '@tessera/domain', '@tessera/connectors'],
  // resolved from node_modules at runtime
  serverExternalPackages: ['@prisma/client', 'pg-boss'],
};

export default config;
