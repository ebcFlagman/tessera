import type { PrismaClient } from '@tessera/db';

export interface SourceRef {
  type: 'sonarcloud' | 'gitlab';
  integrationName: string;
  externalId: string;
  url: string | null;
  lastSeenAt: string;
  /** every source finding of this debt is gone: the source considers it resolved */
  gone: boolean;
  findingCount: number;
  /** manually maintained fields whose source value differs */
  conflicts: { field: string; sourceValue: unknown }[];
}

/** Adds the reference to the source system (if any) to debt DTOs, with one query for all. */
export async function attachSources<T extends { id: string }>(
  db: PrismaClient,
  dtos: T[],
): Promise<(Omit<T, 'source'> & { source: SourceRef | null })[]> {
  if (dtos.length === 0) return [];
  const findings = await db.finding.findMany({
    where: { debtId: { in: dtos.map((d) => d.id) } },
    include: { integration: { select: { type: true, name: true } } },
    orderBy: [{ firstSeenAt: 'asc' }, { externalId: 'asc' }],
  });
  const byDebt = new Map<string, typeof findings>();
  for (const f of findings) byDebt.set(f.debtId, [...(byDebt.get(f.debtId) ?? []), f]);

  return dtos.map((dto) => {
    const list = byDebt.get(dto.id);
    const first = list?.[0];
    if (!list || !first) return { ...dto, source: null };
    return {
      ...dto,
      source: {
        type: first.integration.type,
        integrationName: first.integration.name,
        externalId: first.externalId,
        url: first.url,
        lastSeenAt: first.lastSeenAt.toISOString(),
        gone: list.every((f) => f.goneAt !== null),
        findingCount: list.length,
        conflicts: list.flatMap((f) => f.conflicts as { field: string; sourceValue: unknown }[]),
      },
    };
  });
}

export async function attachSource<T extends { id: string }>(db: PrismaClient, dto: T) {
  return (await attachSources(db, [dto]))[0]!;
}
