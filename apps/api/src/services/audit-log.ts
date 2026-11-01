import type { Prisma, PrismaClient, User } from '@tessera/db';
import { AppError } from '@tessera/domain';
import { requireAdmin } from '../auth/authorize';
import { redact } from '../lib/logger';

export interface AuditQuery {
  action?: string | undefined;
  targetType?: string | undefined;
  actorId?: string | undefined;
  /** YYYY-MM-DD, inclusive */
  from?: string | undefined;
  /** YYYY-MM-DD, inclusive */
  to?: string | undefined;
  cursor?: string | undefined;
  limit: number;
}

function day(value: string, label: string): Date {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new AppError('validation_failed', `„${label}“ ist kein gültiges Datum (JJJJ-MM-TT)`);
  }
  return d;
}

/**
 * The change log, newest first. Only administrators may read it. Details are redacted once more on
 * the way out, so even a faulty writer could not make a secret visible here.
 */
export async function listAuditLog(db: PrismaClient, user: User, q: AuditQuery) {
  await requireAdmin(db, user);
  const at: Prisma.DateTimeFilter = {};
  if (q.from) at.gte = day(q.from, 'von');
  if (q.to) at.lt = new Date(day(q.to, 'bis').getTime() + 86_400_000);
  const where: Prisma.AuditEntryWhereInput = {
    ...(q.action ? { action: q.action } : {}),
    ...(q.targetType ? { targetType: q.targetType } : {}),
    ...(q.actorId ? { actorId: q.actorId } : {}),
    ...(q.from || q.to ? { at } : {}),
  };
  const rows = await db.auditEntry.findMany({
    where,
    orderBy: [{ at: 'desc' }, { id: 'asc' }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 0 } : {}),
  });
  const page = rows.slice(0, q.limit);
  const actors = await db.user.findMany({
    where: { id: { in: [...new Set(page.map((r) => r.actorId).filter((a): a is string => !!a))] } },
    select: { id: true, name: true },
  });
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return {
    items: page.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      actorId: r.actorId,
      actorName: r.actorId ? (names.get(r.actorId) ?? null) : null,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      details: redact(r.details) as Record<string, unknown>,
    })),
    nextCursor: rows.length > q.limit ? rows[q.limit]!.id : null,
  };
}
