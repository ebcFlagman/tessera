import type { Prisma, PrismaClient } from '@tessera/db';
import { toDebtDto } from './debts';
import { attachSources } from './sources';

export interface DebtQuery {
  q?: string | undefined;
  kind?: 'architectural' | 'technical' | undefined;
  status?: 'open' | 'planned' | 'in_progress' | 'repaid' | 'accepted' | undefined;
  productId?: string | undefined;
  ownerId?: string | undefined;
  teamId?: string | undefined;
  source?: 'manual' | 'sonarcloud' | 'gitlab' | undefined;
  includeArchived: boolean;
  sort:
    | 'createdAt'
    | '-createdAt'
    | 'title'
    | '-title'
    | 'status'
    | '-status'
    | 'priority'
    | '-priority';
  cursor?: string | undefined;
  limit: number;
}

/** Register query: search, filters, sorting and cursor pagination. */
/** The register filters as a database condition; shared by the register, the dashboard export and tests. */
export function debtWhere(
  query: Pick<
    DebtQuery,
    'q' | 'kind' | 'status' | 'productId' | 'ownerId' | 'teamId' | 'source' | 'includeArchived'
  >,
): Prisma.DebtItemWhereInput {
  return {
    ...(query.includeArchived ? {} : { archivedAt: null }),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.teamId ? { teamId: query.teamId } : {}),
    ...(query.source === 'manual'
      ? { findings: { none: {} } }
      : query.source
        ? { findings: { some: { integration: { type: query.source } } } }
        : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export async function queryDebts(db: PrismaClient, query: DebtQuery) {
  const where = debtWhere(query);
  const desc = query.sort.startsWith('-');
  const field = query.sort.replace('-', '') as 'createdAt' | 'title' | 'status' | 'priority';
  const order: Prisma.DebtItemOrderByWithRelationInput =
    field === 'priority'
      ? // not assessed debts always come last
        { priorityEffective: { sort: desc ? 'desc' : 'asc', nulls: 'last' } }
      : { [field]: desc ? 'desc' : 'asc' };
  const rows = await db.debtItem.findMany({
    where,
    orderBy: [order, { id: 'asc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 0 } : {}),
  });
  const page = rows.slice(0, query.limit);
  return {
    items: await attachSources(db, page.map(toDebtDto)),
    nextCursor: rows.length > query.limit ? rows[query.limit]!.id : null,
  };
}
