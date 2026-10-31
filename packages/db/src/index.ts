import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Shared client; reused across hot reloads in development. */
export function getDb(): PrismaClient {
  globalForPrisma.prisma ??= new PrismaClient();
  return globalForPrisma.prisma;
}
