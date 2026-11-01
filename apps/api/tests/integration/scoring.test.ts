import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '@tessera/domain';
import type { User } from '@tessera/db';
import {
  assessDebt,
  clearPriorityOverride,
  getActiveModel,
  listAssessments,
  replaceModel,
  setPriorityOverride,
} from '../../src/services/assessment';
import { queryDebts } from '../../src/services/debt-query';
import { createDebt } from '../../src/services/debts';
import { priorityList } from '../../src/services/priority-list';
import { resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';

const db = useTestDeps();
let editor: User;
let admin: User;
let productId = '';

const scores = (impact: number, risk: number, interest: number, effort: number) => ({
  impact,
  risk,
  interest,
  effort,
});

async function debt(title: string) {
  return createDebt(db, editor, { productId, title, kind: 'technical' });
}

beforeEach(async () => {
  await resetDb(db);
  const p = await db.product.create({ data: { name: 'P' } });
  productId = p.id;
  editor = await seedUserWithRole(db, 'editor', p.id, 'editor');
  admin = await seedUserWithRole(db, 'admin', p.id, 'admin');
});
afterAll(() => db.$disconnect());

describe('scoring (database)', () => {
  it('ranks assessed debts by priority and keeps unassessed ones separate', async () => {
    const urgent = await debt('dringend');
    const minor = await debt('klein');
    await debt('unbewertet');
    await assessDebt(db, editor, urgent.id, { scores: scores(5, 5, 5, 1) });
    await assessDebt(db, editor, minor.id, { scores: scores(1, 1, 1, 5) });

    const list = await priorityList(db, { limit: 50 });
    expect(list.ranked.map((d) => d.title)).toEqual(['dringend', 'klein']);
    expect(list.ranked.map((d) => d.rank)).toEqual([1, 2]);
    expect(list.ranked[0]?.priorityEffective).toBe(100);
    expect(list.ranked[1]?.priorityEffective).toBe(0);
    expect(list.unassessed.map((d) => d.title)).toEqual(['unbewertet']);
    expect(list.unassessedTotal).toBe(1);
  });

  it('keeps every assessment (history) and uses the latest for the priority', async () => {
    const d = await debt('x');
    await assessDebt(db, editor, d.id, { scores: scores(1, 1, 1, 5) });
    await assessDebt(db, editor, d.id, { scores: scores(5, 5, 5, 1), comment: 'neu eingeschätzt' });
    const history = await listAssessments(db, d.id);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ priorityCalculated: 100, comment: 'neu eingeschätzt' });
    expect(history[1]?.priorityCalculated).toBe(0);
    const reloaded = await db.debtItem.findUnique({ where: { id: d.id } });
    expect(reloaded?.priorityCalculated).toBe(100);
  });

  it('a new model version recalculates all priorities consistently', async () => {
    const a = await debt('a');
    const b = await debt('b');
    await assessDebt(db, editor, a.id, { scores: scores(5, 1, 1, 1) });
    await assessDebt(db, editor, b.id, { scores: scores(1, 5, 1, 1) });
    const before = await priorityList(db, { limit: 50 });
    expect(before.ranked[0]?.title).toBe('a'); // impact weighs as much as risk; tie -> id order

    // only risk counts now
    await replaceModel(db, admin, [
      { key: 'impact', name: 'Auswirkung', weight: 0, direction: 'up' },
      { key: 'risk', name: 'Risiko', weight: 1, direction: 'up' },
      { key: 'interest', name: 'Folgekosten', weight: 0, direction: 'up' },
      { key: 'effort', name: 'Aufwand', weight: 0, direction: 'down' },
    ]);
    const after = await priorityList(db, { limit: 50 });
    expect(after.ranked.map((d) => [d.title, d.priorityEffective])).toEqual([
      ['b', 100],
      ['a', 0],
    ]);
    const model = await getActiveModel(db);
    expect(model.version).toBe(2);
    expect(await db.assessmentModel.count({ where: { active: true } })).toBe(1);
  });

  it('debts missing a score for a new criterion fall back to "not assessed"', async () => {
    const a = await debt('a');
    await assessDebt(db, editor, a.id, { scores: scores(3, 3, 3, 3) });
    const result = await replaceModel(db, admin, [
      { key: 'impact', name: 'Auswirkung', weight: 1, direction: 'up' },
      { key: 'security', name: 'Sicherheit', weight: 1, direction: 'up' },
    ]);
    expect(result).toMatchObject({ updated: 0, needReassessment: 1 });
    const list = await priorityList(db, { limit: 50 });
    expect(list.ranked).toHaveLength(0);
    expect(list.unassessed.map((d) => d.title)).toEqual(['a']);
  });

  it('only admins may change the model, and the change is audited', async () => {
    await expect(
      replaceModel(db, editor, [{ key: 'impact', name: 'A', weight: 1, direction: 'up' }]),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await replaceModel(db, admin, [{ key: 'impact', name: 'A', weight: 2, direction: 'up' }]);
    const entry = await db.auditEntry.findFirst({ where: { action: 'assessment-model.updated' } });
    expect(entry?.actorId).toBe(admin.id);
    expect(entry?.details).toMatchObject({ version: 2 });
  });

  it('the override needs a reason, wins in the ranking and is recorded in the history', async () => {
    const low = await debt('niedrig');
    const high = await debt('hoch');
    await assessDebt(db, editor, low.id, { scores: scores(1, 1, 1, 5) });
    await assessDebt(db, editor, high.id, { scores: scores(5, 5, 5, 1) });

    await expect(
      setPriorityOverride(db, editor, low.id, { value: 100, reason: '   ' }),
    ).rejects.toBeInstanceOf(AppError);

    const overridden = await setPriorityOverride(db, editor, low.id, {
      value: 100,
      reason: 'Vertragsrisiko',
    });
    // calculated and overridden values stay separate
    expect(overridden).toMatchObject({
      priorityCalculated: 0,
      priorityOverride: 100,
      priorityEffective: 100,
    });
    const ranked = (await priorityList(db, { limit: 50 })).ranked.map((d) => d.title);
    expect(ranked).toEqual(expect.arrayContaining(['niedrig', 'hoch']));
    expect((await priorityList(db, { limit: 50 })).ranked[0]?.priorityEffective).toBe(100);

    const events = await db.debtEvent.findMany({
      where: { debtId: low.id },
      orderBy: { at: 'asc' },
    });
    expect(events.map((e) => e.type)).toEqual(['created', 'assessed', 'priority_overridden']);
    expect(events[2]?.changes).toMatchObject({ reason: 'Vertragsrisiko' });

    const cleared = await clearPriorityOverride(db, editor, low.id);
    expect(cleared).toMatchObject({ priorityOverride: null, priorityEffective: 0 });
  });

  it('the database refuses an override without a reason or an out-of-range priority', async () => {
    const d = await debt('x');
    await expect(
      db.debtItem.update({ where: { id: d.id }, data: { priorityOverride: 50 } }),
    ).rejects.toThrow();
    await expect(
      db.debtItem.update({
        where: { id: d.id },
        data: { priorityOverride: 150, priorityOverrideReason: 'x' },
      }),
    ).rejects.toThrow();
  });

  it('the register can sort by priority with unassessed debts last', async () => {
    const a = await debt('a');
    await debt('ohne');
    const c = await debt('c');
    await assessDebt(db, editor, a.id, { scores: scores(1, 1, 1, 5) });
    await assessDebt(db, editor, c.id, { scores: scores(5, 5, 5, 1) });
    const base = { includeArchived: false, limit: 50 };
    const desc = await queryDebts(db, { ...base, sort: '-priority' });
    expect(desc.items.map((i) => i.title)).toEqual(['c', 'a', 'ohne']);
    const asc = await queryDebts(db, { ...base, sort: 'priority' });
    expect(asc.items.map((i) => i.title)).toEqual(['a', 'c', 'ohne']);
  });
});
