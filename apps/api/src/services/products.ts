import type { PrismaClient, Product, User } from '@tessera/db';
import { AppError } from '@tessera/domain';
import { requireAdmin, requireProductRole } from '../auth/authorize';
import { writeAudit } from './audit';

export const toProductDto = (p: Product) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  archivedAt: p.archivedAt?.toISOString() ?? null,
});

export async function createProduct(
  db: PrismaClient,
  user: User,
  input: { name: string; description?: string | null | undefined },
) {
  await requireAdmin(db, user).catch(async (err) => {
    // The very first product can be created by anyone; they become its admin.
    if ((await db.product.count()) > 0) throw err;
  });
  const exists = await db.product.findUnique({ where: { name: input.name } });
  if (exists) throw new AppError('conflict', 'Ein Produkt mit diesem Namen existiert bereits');
  return db.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: { name: input.name, description: input.description ?? null },
    });
    await tx.membership.create({ data: { userId: user.id, productId: product.id, role: 'admin' } });
    await writeAudit(tx, {
      actorId: user.id,
      action: 'product.created',
      targetType: 'product',
      targetId: product.id,
    });
    return product;
  });
}

export async function updateProduct(
  db: PrismaClient,
  user: User,
  id: string,
  patch: {
    name?: string | undefined;
    description?: string | null | undefined;
    archived?: boolean | undefined;
  },
) {
  const product = await db.product.findUnique({ where: { id } });
  if (!product) throw new AppError('not_found', 'Produkt nicht gefunden');
  await requireProductRole(db, user, id, 'admin');

  return db.$transaction(async (tx) => {
    const archiving = patch.archived === true && !product.archivedAt;
    const restoring = patch.archived === false && !!product.archivedAt;
    const updated = await tx.product.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(archiving ? { archivedAt: new Date() } : {}),
        ...(restoring ? { archivedAt: null } : {}),
      },
    });
    if (archiving) {
      // Debts are archived with their product instead of being deleted.
      const debts = await tx.debtItem.findMany({
        where: { productId: id, archivedAt: null },
        select: { id: true },
      });
      await tx.debtItem.updateMany({
        where: { id: { in: debts.map((d) => d.id) } },
        data: { archivedAt: new Date() },
      });
      await tx.debtEvent.createMany({
        data: debts.map((d) => ({
          debtId: d.id,
          actorId: user.id,
          type: 'archived',
          changes: { archived: { from: false, to: true }, reason: 'product archived' },
        })),
      });
    }
    await writeAudit(tx, {
      actorId: user.id,
      action: archiving ? 'product.archived' : 'product.updated',
      targetType: 'product',
      targetId: id,
      details: { fields: Object.keys(patch) },
    });
    return updated;
  });
}
