import type { Prisma, PrismaClient } from '@tessera/db';
import { toDebtDto } from './debts';

export interface DebtQuery {
  q?: string | undefined;
  kind?: 'architectural' | 'technical' | undefined;
  status?: 'open' | 'planned' | 'in_progress' | 'repaid' | 'accepted' | undefined;
  productId?: string | undefined;
  ownerId?: string | undefined;
  includeArchived: boolean;
  sort: 'createdAt' | '-createdAt' | 'title' | '-title' | 'status' | '-status';
  cursor?: string | undefined;
  limit: number;
}

/** Register query: search, filters, sorting and cursor pagination. */
export async function queryDebts(db: PrismaClient, query: DebtQuery) {
  const where: Prisma.DebtItemWhereInput = {
    ...(query.includeArchived ? {} : { archivedAt: null }),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const desc = query.sort.startsWith('-');
  const field = query.sort.replace('-', '') as 'createdAt' | 'title' | 'status';
  const rows = await db.debtItem.findMany({
    where,
    orderBy: [{ [field]: desc ? 'desc' : 'asc' }, { id: 'asc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 0 } : {}),
  });
  const page = rows.slice(0, query.limit);
  return {
    items: page.map(toDebtDto),
    nextCursor: rows.length > query.limit ? rows[query.limit]!.id : null,
  };
}
