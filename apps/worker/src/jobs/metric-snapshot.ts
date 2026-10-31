import { loadCube, type Prisma, type PrismaClient } from '@tessera/db';
import { aggregateByPartition, emptyMetrics } from '@tessera/domain';

/** Midnight UTC of the given instant: snapshots are per calendar day. */
export function snapshotDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/**
 * Writes the figures of one day per (product, team) partition. Running it again for the same day
 * replaces that day, so the job is safe to repeat. Products without debts get a zero row, so a
 * history line does not break when a product is empty.
 */
export async function takeSnapshot(db: PrismaClient, at: Date = new Date()) {
  const date = snapshotDay(at);
  const parts = aggregateByPartition(await loadCube(db));
  const products = await db.product.findMany({ where: { archivedAt: null }, select: { id: true } });
  const covered = new Set(parts.map((p) => p.productId));
  for (const p of products) {
    if (!covered.has(p.id)) parts.push({ productId: p.id, teamId: null, metrics: emptyMetrics() });
  }

  await db.$transaction(async (tx) => {
    await tx.metricSnapshot.deleteMany({ where: { date } });
    await tx.metricSnapshot.createMany({
      data: parts.map(({ productId, teamId, metrics: m }) => ({
        date,
        productId,
        teamId,
        total: m.total,
        openCount: m.openCount,
        openEffort: m.openEffort,
        openInterest: m.openInterest,
        unestimatedOpen: m.unestimatedOpen,
        countByStatus: m.byStatus as Prisma.InputJsonValue,
        countByKind: m.byKind as Prisma.InputJsonValue,
        countByPriorityBand: m.byPriorityBand as Prisma.InputJsonValue,
      })),
    });
  });
  return { date, partitions: parts.length };
}

/** At worker start: make sure today has figures even if the daily job has not run yet. */
export async function ensureTodaySnapshot(db: PrismaClient, at: Date = new Date()) {
  const date = snapshotDay(at);
  if ((await db.metricSnapshot.count({ where: { date } })) > 0) return null;
  return takeSnapshot(db, at);
}
