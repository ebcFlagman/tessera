import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { writeAudit } from '../../src/services/audit';
import { resetDb, useTestDeps } from '../helpers/app';

/** Constitution III: the change log cannot be rewritten, not even by code with database access. */
const db = useTestDeps();

beforeEach(() => resetDb(db));
afterAll(() => db.$disconnect());

describe('append-only tables', () => {
  it('audit entries can be added but neither changed nor deleted', async () => {
    await writeAudit(db, { actorId: null, action: 'test.event', targetType: 'x', targetId: '1' });
    const entry = await db.auditEntry.findFirstOrThrow();

    await expect(
      db.auditEntry.update({ where: { id: entry.id }, data: { action: 'tampered' } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.auditEntry.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
    await expect(db.auditEntry.deleteMany()).rejects.toThrow(/append-only/);
    await expect(db.$executeRawUnsafe("UPDATE audit_entry SET action = 'x'")).rejects.toThrow(
      /append-only/,
    );

    expect(await db.auditEntry.findUniqueOrThrow({ where: { id: entry.id } })).toMatchObject({
      action: 'test.event',
    });
    await writeAudit(db, { actorId: null, action: 'test.event2', targetType: 'x', targetId: '2' });
    expect(await db.auditEntry.count()).toBe(2);
  });

  it('assessments are immutable: a new assessment is a new row', async () => {
    const product = await db.product.create({ data: { name: 'P' } });
    const debt = await db.debtItem.create({
      data: { productId: product.id, title: 'x', kind: 'technical' },
    });
    const model = await db.assessmentModel.create({
      data: { version: 1, criteria: [], active: true },
    });
    const a = await db.assessment.create({
      data: { debtId: debt.id, modelId: model.id, scores: {}, priorityCalculated: 50 },
    });
    await expect(
      db.assessment.update({ where: { id: a.id }, data: { priorityCalculated: 99 } }),
    ).rejects.toThrow(/append-only|not allowed/);
    expect(
      (await db.assessment.findUniqueOrThrow({ where: { id: a.id } })).priorityCalculated,
    ).toBe(50);
  });
});
