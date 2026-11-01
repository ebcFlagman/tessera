import type { PrismaClient, Role, User } from '@tessera/db';
import { AppError } from '@tessera/domain';

const rank: Record<Role, number> = { editor: 1, admin: 2 };

export function roleSatisfies(actual: Role | undefined, needed: Role): boolean {
  return actual !== undefined && rank[actual] >= rank[needed];
}

/** Reading is allowed for every authenticated user; only writes need a product role. */
export async function requireProductRole(
  db: PrismaClient,
  user: User,
  productId: string,
  needed: Role,
): Promise<void> {
  const membership = await db.membership.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });
  if (!roleSatisfies(membership?.role, needed)) {
    throw new AppError('forbidden', 'Dafür fehlt die Berechtigung für dieses Produkt');
  }
}

/** Organisation-wide admin actions: the user must be admin of at least one product. */
export async function requireAdmin(db: PrismaClient, user: User): Promise<void> {
  const admin = await db.membership.findFirst({ where: { userId: user.id, role: 'admin' } });
  if (!admin) throw new AppError('forbidden', 'Nur Administratoren dürfen das');
}
