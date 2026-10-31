import type { PrismaClient, Role, User } from '@tessera/db';
import { AppError } from '@tessera/domain';
import { requireProductRole } from '../auth/authorize';
import { writeAudit } from './audit';

export async function listMembers(db: PrismaClient, productId: string) {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('not_found', 'Produkt nicht gefunden');
  const rows = await db.membership.findMany({
    where: { productId },
    include: { user: true },
    orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
  });
  return rows.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));
}

/**
 * Sets (or with `role: null` removes) the role of a user for a product. Only product admins may do
 * this, and a product always keeps at least one admin. Every change is audited with the old and the
 * new role.
 */
export async function setMember(
  db: PrismaClient,
  actor: User,
  productId: string,
  input: { userId: string; role: Role | null },
) {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('not_found', 'Produkt nicht gefunden');
  await requireProductRole(db, actor, productId, 'admin');
  if (product.archivedAt) throw new AppError('conflict', 'Das Produkt ist archiviert');
  const target = await db.user.findUnique({ where: { id: input.userId } });
  if (!target) throw new AppError('validation_failed', 'Benutzer nicht gefunden');

  await db.$transaction(async (tx) => {
    const current = await tx.membership.findUnique({
      where: { userId_productId: { userId: input.userId, productId } },
    });
    const from = current?.role ?? null;
    if (from === input.role) return; // nothing changes, nothing to record

    if (from === 'admin' && input.role !== 'admin') {
      const admins = await tx.membership.count({ where: { productId, role: 'admin' } });
      if (admins <= 1) {
        throw new AppError('conflict', 'Das Produkt braucht mindestens einen Administrator');
      }
    }
    if (input.role === null) {
      await tx.membership.delete({
        where: { userId_productId: { userId: input.userId, productId } },
      });
    } else {
      await tx.membership.upsert({
        where: { userId_productId: { userId: input.userId, productId } },
        update: { role: input.role },
        create: { userId: input.userId, productId, role: input.role },
      });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'membership.set',
      targetType: 'product',
      targetId: productId,
      details: { userId: input.userId, userName: target.name, from, to: input.role },
    });
  });
  return listMembers(db, productId);
}
