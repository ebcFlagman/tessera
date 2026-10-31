import type { DebtEvent, DebtItem, Prisma, PrismaClient, User } from '@tessera/db';
import { AppError, validateTransition } from '@tessera/domain';
import { requireProductRole } from '../auth/authorize';
import { writeAudit } from './audit';

export interface DebtCreate {
  productId: string;
  title: string;
  description?: string | null | undefined;
  kind: 'architectural' | 'technical';
  ownerId?: string | null | undefined;
  teamId?: string | null | undefined;
  effortEstimate?: number | null | undefined;
  interestEstimate?: number | null | undefined;
}

export interface DebtUpdate {
  title?: string;
  description?: string | null;
  kind?: 'architectural' | 'technical';
  status?: DebtItem['status'];
  ownerId?: string | null;
  teamId?: string | null;
  effortEstimate?: number | null;
  interestEstimate?: number | null;
  acceptedReason?: string | null;
  reviewDate?: string | null;
  archived?: boolean;
}

const trackedFields = [
  'title',
  'description',
  'kind',
  'status',
  'ownerId',
  'teamId',
  'effortEstimate',
  'interestEstimate',
  'acceptedReason',
  'reviewDate',
] as const;

export function toDebtDto(d: DebtItem) {
  return {
    id: d.id,
    productId: d.productId,
    title: d.title,
    description: d.description,
    kind: d.kind,
    status: d.status,
    ownerId: d.ownerId,
    teamId: d.teamId,
    effortEstimate: d.effortEstimate,
    interestEstimate: d.interestEstimate,
    acceptedReason: d.acceptedReason,
    reviewDate: d.reviewDate?.toISOString() ?? null,
    archivedAt: d.archivedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export function toEventDto(e: DebtEvent & { actorName?: string | null }) {
  return {
    id: e.id,
    type: e.type,
    actorId: e.actorId,
    actorName: e.actorName ?? null,
    changes: e.changes as Record<string, unknown>,
    at: e.at.toISOString(),
  };
}

async function assertProductUsable(db: PrismaClient, productId: string) {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('not_found', 'Produkt nicht gefunden');
  if (product.archivedAt) throw new AppError('conflict', 'Das Produkt ist archiviert');
}

export async function createDebt(db: PrismaClient, user: User, input: DebtCreate) {
  await requireProductRole(db, user, input.productId, 'editor');
  await assertProductUsable(db, input.productId);
  return db.$transaction(async (tx) => {
    const debt = await tx.debtItem.create({
      data: {
        productId: input.productId,
        title: input.title,
        description: input.description ?? null,
        kind: input.kind,
        ownerId: input.ownerId ?? null,
        teamId: input.teamId ?? null,
        effortEstimate: input.effortEstimate ?? null,
        interestEstimate: input.interestEstimate ?? null,
      },
    });
    await tx.debtEvent.create({
      data: { debtId: debt.id, actorId: user.id, type: 'created', changes: { title: debt.title } },
    });
    await writeAudit(tx, {
      actorId: user.id,
      action: 'debt.created',
      targetType: 'debt',
      targetId: debt.id,
    });
    return debt;
  });
}

export async function updateDebt(db: PrismaClient, user: User, id: string, patch: DebtUpdate) {
  const current = await db.debtItem.findUnique({ where: { id } });
  if (!current) throw new AppError('not_found', 'Schuld nicht gefunden');
  await requireProductRole(db, user, current.productId, 'editor');

  const nextStatus = patch.status ?? current.status;
  const nextReason =
    patch.acceptedReason !== undefined ? patch.acceptedReason : current.acceptedReason;
  validateTransition({ from: current.status, to: nextStatus, acceptedReason: nextReason });

  const data: Prisma.DebtItemUncheckedUpdateInput = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const origin = { ...(current.fieldOrigin as Record<string, string>) };

  for (const field of trackedFields) {
    const value = patch[field];
    if (value === undefined) continue;
    const before =
      field === 'reviewDate' ? (current.reviewDate?.toISOString() ?? null) : current[field];
    if (before === value) continue;
    changes[field] = { from: before, to: value };
    origin[field] = 'manual';
    (data as Record<string, unknown>)[field] =
      field === 'reviewDate' ? (value ? new Date(value as string) : null) : value;
  }
  if (
    nextStatus !== 'accepted' &&
    current.status === 'accepted' &&
    patch.acceptedReason === undefined
  ) {
    data.acceptedReason = null;
  }
  if (patch.archived !== undefined) {
    const archivedAt = patch.archived ? new Date() : null;
    if (Boolean(current.archivedAt) !== patch.archived) {
      data.archivedAt = archivedAt;
      changes.archived = { from: Boolean(current.archivedAt), to: patch.archived };
    }
  }
  if (Object.keys(changes).length === 0) return current;
  data.fieldOrigin = origin;

  return db.$transaction(async (tx) => {
    const updated = await tx.debtItem.update({ where: { id }, data });
    const type = changes.status ? 'status_changed' : changes.archived ? 'archived' : 'updated';
    await tx.debtEvent.create({
      data: { debtId: id, actorId: user.id, type, changes: changes as Prisma.InputJsonValue },
    });
    await writeAudit(tx, {
      actorId: user.id,
      action: 'debt.updated',
      targetType: 'debt',
      targetId: id,
      details: { fields: Object.keys(changes) },
    });
    return updated;
  });
}

export async function getDebtWithHistory(db: PrismaClient, id: string) {
  const debt = await db.debtItem.findUnique({
    where: { id },
    include: { events: { orderBy: { at: 'desc' } } },
  });
  if (!debt) throw new AppError('not_found', 'Schuld nicht gefunden');
  const actorIds = [...new Set(debt.events.map((e) => e.actorId).filter((a): a is string => !!a))];
  const actors = await db.user.findMany({ where: { id: { in: actorIds } } });
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return {
    ...toDebtDto(debt),
    events: debt.events.map((e) =>
      toEventDto({ ...e, actorName: e.actorId ? names.get(e.actorId) : null }),
    ),
  };
}
