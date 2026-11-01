import type { AssessmentModel, Prisma, PrismaClient, User } from '@tessera/db';
import {
  AppError,
  computePriority,
  defaultCriteria,
  recomputeFromScores,
  validateCriteria,
  validateScores,
  type Criterion,
  type Scores,
} from '@tessera/domain';
import { requireAdmin, requireProductRole } from '../auth/authorize';
import { writeAudit } from './audit';

type Tx = PrismaClient | Prisma.TransactionClient;

export function toModelDto(m: AssessmentModel) {
  return {
    id: m.id,
    version: m.version,
    criteria: m.criteria as unknown as Criterion[],
    active: m.active,
    createdAt: m.createdAt.toISOString(),
  };
}

/** The active model; the default model is created on first use. */
export async function getActiveModel(db: PrismaClient): Promise<AssessmentModel> {
  const active = await db.assessmentModel.findFirst({ where: { active: true } });
  if (active) return active;
  try {
    return await db.assessmentModel.create({
      data: {
        version: 1,
        criteria: defaultCriteria as unknown as Prisma.InputJsonValue,
        active: true,
      },
    });
  } catch {
    // lost a race with another request creating the default model
    const again = await db.assessmentModel.findFirst({ where: { active: true } });
    if (again) return again;
    throw new AppError('internal', 'Bewertungsmodell konnte nicht angelegt werden');
  }
}

/**
 * New model version (admin). Re-derives the priority of every assessed debt from its latest
 * stored scores; debts that lack a score for a new criterion become "not assessed" again.
 */
export async function replaceModel(db: PrismaClient, user: User, criteria: Criterion[]) {
  await requireAdmin(db, user);
  validateCriteria(criteria);
  const current = await getActiveModel(db);

  return db.$transaction(async (tx) => {
    await tx.assessmentModel.update({ where: { id: current.id }, data: { active: false } });
    const created = await tx.assessmentModel.create({
      data: {
        version: current.version + 1,
        criteria: criteria as unknown as Prisma.InputJsonValue,
        active: true,
        createdBy: user.id,
      },
    });
    const recalculated = await recalculateAll(tx, criteria);
    await writeAudit(tx, {
      actorId: user.id,
      action: 'assessment-model.updated',
      targetType: 'assessment-model',
      targetId: created.id,
      details: {
        version: created.version,
        criteria: criteria.map((c) => ({ key: c.key, weight: c.weight, direction: c.direction })),
        recalculated: recalculated.updated,
        needReassessment: recalculated.needReassessment,
      },
    });
    return { model: created, ...recalculated };
  });
}

async function recalculateAll(tx: Tx, criteria: Criterion[]) {
  // latest assessment per debt
  const latest = await tx.assessment.findMany({
    orderBy: [{ debtId: 'asc' }, { assessedAt: 'desc' }],
    distinct: ['debtId'],
  });
  let updated = 0;
  let needReassessment = 0;
  for (const a of latest) {
    const priority = recomputeFromScores(criteria, a.scores as Scores);
    if (priority === null) needReassessment++;
    else updated++;
    await tx.debtItem.update({ where: { id: a.debtId }, data: { priorityCalculated: priority } });
  }
  return { updated, needReassessment };
}

export async function assessDebt(
  db: PrismaClient,
  user: User,
  debtId: string,
  input: { scores: Scores; comment?: string | null | undefined },
) {
  const debt = await db.debtItem.findUnique({ where: { id: debtId } });
  if (!debt) throw new AppError('not_found', 'Schuld nicht gefunden');
  await requireProductRole(db, user, debt.productId, 'editor');

  const model = await getActiveModel(db);
  const criteria = model.criteria as unknown as Criterion[];
  validateScores(criteria, input.scores);
  const { priority } = computePriority(criteria, input.scores);

  return db.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({
      data: {
        debtId,
        modelId: model.id,
        scores: input.scores,
        priorityCalculated: priority,
        comment: input.comment?.trim() || null,
        assessedBy: user.id,
      },
    });
    await tx.debtItem.update({ where: { id: debtId }, data: { priorityCalculated: priority } });
    await tx.debtEvent.create({
      data: {
        debtId,
        actorId: user.id,
        type: 'assessed',
        changes: { priorityCalculated: { from: debt.priorityCalculated, to: priority } },
      },
    });
    await writeAudit(tx, {
      actorId: user.id,
      action: 'debt.assessed',
      targetType: 'debt',
      targetId: debtId,
      details: { modelVersion: model.version, priority },
    });
    return { assessment, model };
  });
}

export async function listAssessments(db: PrismaClient, debtId: string) {
  const debt = await db.debtItem.findUnique({ where: { id: debtId } });
  if (!debt) throw new AppError('not_found', 'Schuld nicht gefunden');
  const rows = await db.assessment.findMany({
    where: { debtId },
    orderBy: { assessedAt: 'desc' },
    include: { model: true, assessor: true },
  });
  return rows.map((a) => {
    const criteria = a.model.criteria as unknown as Criterion[];
    const scores = a.scores as Scores;
    return {
      id: a.id,
      modelVersion: a.model.version,
      scores,
      priorityCalculated: a.priorityCalculated,
      // derivation under the model the assessment was made with
      breakdown: computePriority(criteria, scores).breakdown,
      comment: a.comment,
      assessedBy: a.assessedBy,
      assessedByName: a.assessor?.name ?? null,
      assessedAt: a.assessedAt.toISOString(),
    };
  });
}

export async function setPriorityOverride(
  db: PrismaClient,
  user: User,
  debtId: string,
  input: { value: number; reason: string },
) {
  const debt = await db.debtItem.findUnique({ where: { id: debtId } });
  if (!debt) throw new AppError('not_found', 'Schuld nicht gefunden');
  await requireProductRole(db, user, debt.productId, 'editor');
  if (!input.reason.trim()) {
    throw new AppError(
      'validation_failed',
      'Für das Überschreiben der Priorität ist eine Begründung erforderlich',
    );
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.debtItem.update({
      where: { id: debtId },
      data: { priorityOverride: input.value, priorityOverrideReason: input.reason.trim() },
    });
    await tx.debtEvent.create({
      data: {
        debtId,
        actorId: user.id,
        type: 'priority_overridden',
        changes: {
          priorityOverride: { from: debt.priorityOverride, to: input.value },
          reason: input.reason.trim(),
        },
      },
    });
    await writeAudit(tx, {
      actorId: user.id,
      action: 'debt.priority-overridden',
      targetType: 'debt',
      targetId: debtId,
      details: { value: input.value },
    });
    return updated;
  });
}

export async function clearPriorityOverride(db: PrismaClient, user: User, debtId: string) {
  const debt = await db.debtItem.findUnique({ where: { id: debtId } });
  if (!debt) throw new AppError('not_found', 'Schuld nicht gefunden');
  await requireProductRole(db, user, debt.productId, 'editor');
  if (debt.priorityOverride === null) return debt;
  return db.$transaction(async (tx) => {
    const updated = await tx.debtItem.update({
      where: { id: debtId },
      data: { priorityOverride: null, priorityOverrideReason: null },
    });
    await tx.debtEvent.create({
      data: {
        debtId,
        actorId: user.id,
        type: 'priority_override_removed',
        changes: { priorityOverride: { from: debt.priorityOverride, to: null } },
      },
    });
    await writeAudit(tx, {
      actorId: user.id,
      action: 'debt.priority-override-removed',
      targetType: 'debt',
      targetId: debtId,
    });
    return updated;
  });
}
