import type { PrismaClient, User } from '@tessera/db';
import { AppError } from '@tessera/domain';
import { requireProductRole } from '../auth/authorize';
import { writeAudit } from './audit';

/**
 * Merges a duplicate into the target debt: its source references (findings) and history move to
 * the target, the duplicate is archived. Nothing is lost.
 */
export async function mergeDebts(
  db: PrismaClient,
  user: User,
  targetId: string,
  duplicateId: string,
) {
  if (targetId === duplicateId) {
    throw new AppError(
      'validation_failed',
      'Eine Schuld kann nicht in sich selbst zusammengeführt werden',
    );
  }
  const [target, duplicate] = await Promise.all([
    db.debtItem.findUnique({ where: { id: targetId } }),
    db.debtItem.findUnique({ where: { id: duplicateId } }),
  ]);
  if (!target || !duplicate) throw new AppError('not_found', 'Schuld nicht gefunden');
  if (target.productId !== duplicate.productId) {
    throw new AppError(
      'validation_failed',
      'Nur Schulden desselben Produkts lassen sich zusammenführen',
    );
  }
  if (duplicate.archivedAt || target.archivedAt) {
    throw new AppError('conflict', 'Archivierte Schulden lassen sich nicht zusammenführen');
  }
  await requireProductRole(db, user, target.productId, 'editor');

  return db.$transaction(async (tx) => {
    const findings = await tx.finding.updateMany({
      where: { debtId: duplicateId },
      data: { debtId: targetId },
    });
    const events = await tx.debtEvent.updateMany({
      where: { debtId: duplicateId },
      data: { debtId: targetId },
    });
    await tx.debtItem.update({ where: { id: duplicateId }, data: { archivedAt: new Date() } });
    await tx.debtEvent.createMany({
      data: [
        {
          debtId: targetId,
          actorId: user.id,
          type: 'merged_from',
          changes: {
            duplicateId,
            duplicateTitle: duplicate.title,
            findings: findings.count,
            movedEvents: events.count,
          },
        },
        {
          debtId: duplicateId,
          actorId: user.id,
          type: 'merged_into',
          changes: { targetId, targetTitle: target.title },
        },
      ],
    });
    await writeAudit(tx, {
      actorId: user.id,
      action: 'debt.merged',
      targetType: 'debt',
      targetId,
      details: { duplicateId, findings: findings.count },
    });
    return tx.debtItem.findUniqueOrThrow({ where: { id: targetId } });
  });
}
