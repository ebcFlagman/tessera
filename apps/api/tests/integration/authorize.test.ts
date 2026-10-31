import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '@tessera/domain';
import { requireAdmin, requireProductRole, roleSatisfies } from '../../src/auth/authorize';
import { resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';

const db = useTestDeps();

describe('roleSatisfies', () => {
  it('ranks admin above editor and rejects missing roles', () => {
    expect(roleSatisfies('admin', 'editor')).toBe(true);
    expect(roleSatisfies('editor', 'editor')).toBe(true);
    expect(roleSatisfies('editor', 'admin')).toBe(false);
    expect(roleSatisfies(undefined, 'editor')).toBe(false);
  });
});

describe('authorization (database)', () => {
  beforeEach(() => resetDb(db));
  afterAll(() => db.$disconnect());

  it('denies writes without a membership but needs no role for reading', async () => {
    const product = await db.product.create({ data: { name: 'P1' } });
    const user = await seedUserWithRole(db, 'norole', null, null);
    await expect(requireProductRole(db, user, product.id, 'editor')).rejects.toMatchObject({
      code: 'forbidden',
    });
    // reading is not guarded by requireProductRole at all: any authenticated user may read
    expect(await db.product.findMany()).toHaveLength(1);
  });

  it('allows editor writes only on the product of the membership', async () => {
    const p1 = await db.product.create({ data: { name: 'P1' } });
    const p2 = await db.product.create({ data: { name: 'P2' } });
    const editor = await seedUserWithRole(db, 'ed', p1.id, 'editor');
    await expect(requireProductRole(db, editor, p1.id, 'editor')).resolves.toBeUndefined();
    await expect(requireProductRole(db, editor, p2.id, 'editor')).rejects.toBeInstanceOf(AppError);
    await expect(requireProductRole(db, editor, p1.id, 'admin')).rejects.toBeInstanceOf(AppError);
  });

  it('requires admin on at least one product for organisation-wide admin actions', async () => {
    const p1 = await db.product.create({ data: { name: 'P1' } });
    const editor = await seedUserWithRole(db, 'ed', p1.id, 'editor');
    const admin = await seedUserWithRole(db, 'ad', p1.id, 'admin');
    await expect(requireAdmin(db, editor)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(requireAdmin(db, admin)).resolves.toBeUndefined();
  });
});
