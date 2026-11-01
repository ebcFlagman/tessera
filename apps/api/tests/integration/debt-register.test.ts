import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { queryDebts } from '../../src/services/debt-query';
import { createDebt, updateDebt } from '../../src/services/debts';
import { resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';

const db = useTestDeps();
const base = { includeArchived: false, sort: '-createdAt' as const, limit: 50 };

beforeEach(() => resetDb(db));
afterAll(() => db.$disconnect());

async function setup() {
  const p1 = await db.product.create({ data: { name: 'P1' } });
  const p2 = await db.product.create({ data: { name: 'P2' } });
  const user = await seedUserWithRole(db, 'ed', p1.id, 'editor');
  await db.membership.create({ data: { userId: user.id, productId: p2.id, role: 'editor' } });
  const a = await createDebt(db, user, {
    productId: p1.id,
    title: 'Kopplung Modul A',
    kind: 'architectural',
    ownerId: user.id,
  });
  const b = await createDebt(db, user, {
    productId: p1.id,
    title: 'Veraltete Bibliothek',
    description: 'lodash 3',
    kind: 'technical',
  });
  const c = await createDebt(db, user, {
    productId: p2.id,
    title: 'Fehlende Tests',
    kind: 'technical',
  });
  return { p1, p2, user, a, b, c };
}

describe('debt register query', () => {
  it('filters by kind, status, product and owner', async () => {
    const { p1, p2, user, a, b, c } = await setup();
    await updateDebt(db, user, b.id, { status: 'planned' });
    const ids = async (q: object) =>
      (await queryDebts(db, { ...base, ...q })).items.map((i) => i.id).sort();
    expect(await ids({ kind: 'architectural' })).toEqual([a.id]);
    expect(await ids({ status: 'planned' })).toEqual([b.id]);
    expect(await ids({ productId: p2.id })).toEqual([c.id]);
    expect(await ids({ ownerId: user.id })).toEqual([a.id]);
    expect(await ids({ productId: p1.id })).toEqual([a.id, b.id].sort());
  });

  it('searches title and description case-insensitively', async () => {
    const { a, b } = await setup();
    const hit = async (q: string) => (await queryDebts(db, { ...base, q })).items.map((i) => i.id);
    expect(await hit('kopplung')).toEqual([a.id]);
    expect(await hit('LODASH')).toEqual([b.id]);
    expect(await hit('gibt-es-nicht')).toEqual([]);
  });

  it('sorts and paginates with a cursor without gaps or duplicates', async () => {
    await setup();
    const first = await queryDebts(db, { ...base, sort: 'title', limit: 2 });
    expect(first.items.map((i) => i.title)).toEqual(['Fehlende Tests', 'Kopplung Modul A']);
    expect(first.nextCursor).not.toBeNull();
    const second = await queryDebts(db, {
      ...base,
      sort: 'title',
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect(second.items.map((i) => i.title)).toEqual(['Veraltete Bibliothek']);
    expect(second.nextCursor).toBeNull();
  });

  it('hides archived debts unless asked for', async () => {
    const { user, a } = await setup();
    await updateDebt(db, user, a.id, { archived: true });
    expect((await queryDebts(db, base)).items).toHaveLength(2);
    expect((await queryDebts(db, { ...base, includeArchived: true })).items).toHaveLength(3);
  });

  it('records the actor and changes in the history, and marks edited fields as manual', async () => {
    const { user, a } = await setup();
    await updateDebt(db, user, a.id, { title: 'Neuer Titel', effortEstimate: 5 });
    const events = await db.debtEvent.findMany({ where: { debtId: a.id }, orderBy: { at: 'asc' } });
    expect(events.map((e) => e.type)).toEqual(['created', 'updated']);
    expect(events[1]?.actorId).toBe(user.id);
    expect(events[1]?.changes).toMatchObject({
      title: { from: 'Kopplung Modul A', to: 'Neuer Titel' },
    });
    const reloaded = await db.debtItem.findUnique({ where: { id: a.id } });
    expect(reloaded?.fieldOrigin).toMatchObject({ title: 'manual', effortEstimate: 'manual' });
  });
});
