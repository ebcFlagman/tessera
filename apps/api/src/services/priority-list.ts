import type { Prisma, PrismaClient } from '@tessera/db';
import { toDebtDto } from './debts';

export interface PriorityListQuery {
  productId?: string | undefined;
  teamId?: string | undefined;
  limit: number;
}

/** Debts that still need repaying. */
const OPEN_STATUSES = ['open', 'planned', 'in_progress'] as const;

/**
 * Ranked list (highest effective priority first) plus the debts without a priority, which are
 * reported separately so they are never mixed into the ranking.
 */
export async function priorityList(db: PrismaClient, q: PriorityListQuery) {
  const base: Prisma.DebtItemWhereInput = {
    archivedAt: null,
    status: { in: [...OPEN_STATUSES] },
    ...(q.productId ? { productId: q.productId } : {}),
    ...(q.teamId ? { teamId: q.teamId } : {}),
  };
  const [ranked, unassessed, unassessedTotal] = await Promise.all([
    db.debtItem.findMany({
      where: { ...base, priorityEffective: { not: null } },
      orderBy: [{ priorityEffective: 'desc' }, { id: 'asc' }],
      take: q.limit,
    }),
    db.debtItem.findMany({
      where: { ...base, priorityEffective: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: q.limit,
    }),
    db.debtItem.count({ where: { ...base, priorityEffective: null } }),
  ]);
  return {
    ranked: ranked.map((d, i) => ({ rank: i + 1, ...toDebtDto(d) })),
    unassessed: unassessed.map(toDebtDto),
    unassessedTotal,
  };
}
