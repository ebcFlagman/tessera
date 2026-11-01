import { HIGH_PRIORITY_FROM, MEDIUM_PRIORITY_FROM, type CubeRow } from '@tessera/domain';
import { Prisma, type PrismaClient } from '@prisma/client';

export interface CubeFilter {
  productId?: string | undefined;
  teamId?: string | undefined;
}

interface RawRow {
  product_id: string;
  team_id: string | null;
  status: CubeRow['status'];
  kind: CubeRow['kind'];
  band: CubeRow['band'];
  n: number;
  effort: number;
  interest: number;
  unestimated: number;
}

/**
 * Counts all non-archived debts by (product, team, status, kind, priority band) in one pass.
 * The dashboard and the daily snapshots both build on this, so their numbers cannot drift apart.
 * The band thresholds come from the domain constants.
 */
export async function loadCube(db: PrismaClient, filter: CubeFilter = {}): Promise<CubeRow[]> {
  const where = [Prisma.sql`archived_at IS NULL`];
  if (filter.productId) where.push(Prisma.sql`product_id = ${filter.productId}`);
  if (filter.teamId) where.push(Prisma.sql`team_id = ${filter.teamId}`);

  const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT product_id, team_id, status::text AS status, kind::text AS kind,
      CASE
        WHEN priority_effective IS NULL THEN 'unassessed'
        WHEN priority_effective >= ${HIGH_PRIORITY_FROM} THEN 'high'
        WHEN priority_effective >= ${MEDIUM_PRIORITY_FROM} THEN 'medium'
        ELSE 'low'
      END AS band,
      COUNT(*)::int AS n,
      COALESCE(SUM(effort_estimate), 0)::float8 AS effort,
      COALESCE(SUM(interest_estimate), 0)::float8 AS interest,
      COUNT(*) FILTER (WHERE effort_estimate IS NULL)::int AS unestimated
    FROM debt_item
    WHERE ${Prisma.join(where, ' AND ')}
    GROUP BY product_id, team_id, status, kind, band
  `);
  return rows.map((r) => ({
    productId: r.product_id,
    teamId: r.team_id,
    status: r.status,
    kind: r.kind,
    band: r.band,
    count: r.n,
    effort: r.effort,
    interest: r.interest,
    unestimated: r.unestimated,
  }));
}
