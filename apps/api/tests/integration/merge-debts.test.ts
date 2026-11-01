import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { User } from '@tessera/db';
import { createDebt } from '../../src/services/debts';
import { mergeDebts } from '../../src/services/merge-debts';
import { resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';

const db = useTestDeps();
let editor: User;
let productId = '';

beforeEach(async () => {
  await resetDb(db);
  const p = await db.product.create({ data: { name: 'P' } });
  productId = p.id;
  editor = await seedUserWithRole(db, 'editor', p.id, 'editor');
});
afterAll(() => db.$disconnect());

async function importedDebt(title: string, externalId: string) {
  const integration =
    (await db.integration.findFirst()) ??
    (await db.integration.create({
      data: { productId, type: 'gitlab', name: 'GL', config: {}, credentialsEncrypted: 'x' },
    }));
  const debt = await createDebt(db, editor, { productId, title, kind: 'technical' });
  await db.finding.create({
    data: { integrationId: integration.id, externalId, debtId: debt.id, fingerprint: 'f', raw: {} },
  });
  return debt;
}

describe('merging duplicates', () => {
  it('moves source references and history to the target and archives the duplicate', async () => {
    const target = await importedDebt('Kopplung (GitLab)', 'issue:1');
    const duplicate = await importedDebt('Kopplung (Sonar)', 'issue:2');
    const duplicateEvents = await db.debtEvent.count({ where: { debtId: duplicate.id } });

    const merged = await mergeDebts(db, editor, target.id, duplicate.id);
    expect(merged.id).toBe(target.id);

    const findings = await db.finding.findMany({
      where: { debtId: target.id },
      orderBy: { externalId: 'asc' },
    });
    expect(findings.map((f) => f.externalId)).toEqual(['issue:1', 'issue:2']); // source references survive
    expect(await db.finding.count({ where: { debtId: duplicate.id } })).toBe(0);

    const events = await db.debtEvent.findMany({ where: { debtId: target.id } });
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['created', 'merged_from']));
    expect(events.filter((e) => e.type === 'created')).toHaveLength(2); // the duplicate's history moved over
    expect(events.find((e) => e.type === 'merged_from')?.changes).toMatchObject({
      duplicateId: duplicate.id,
      findings: 1,
      movedEvents: duplicateEvents,
    });

    const archived = await db.debtItem.findUniqueOrThrow({ where: { id: duplicate.id } });
    expect(archived.archivedAt).not.toBeNull();
    const trail = await db.debtEvent.findMany({ where: { debtId: duplicate.id } });
    expect(trail.map((e) => e.type)).toEqual(['merged_into']);

    const audit = await db.auditEntry.findFirstOrThrow({ where: { action: 'debt.merged' } });
    expect(audit).toMatchObject({ actorId: editor.id, targetId: target.id });
  });

  it('a merged debt is only repaid by its source when all merged findings are gone', async () => {
    const target = await importedDebt('A', 'issue:1');
    const duplicate = await importedDebt('B', 'issue:2');
    await mergeDebts(db, editor, target.id, duplicate.id);
    expect(await db.finding.count({ where: { debtId: target.id } })).toBe(2);
  });

  it('rejects invalid merges and missing permission', async () => {
    const a = await createDebt(db, editor, { productId, title: 'A', kind: 'technical' });
    const b = await createDebt(db, editor, { productId, title: 'B', kind: 'technical' });
    const other = await db.product.create({ data: { name: 'Q' } });
    await db.membership.create({
      data: { userId: editor.id, productId: other.id, role: 'editor' },
    });
    const c = await createDebt(db, editor, { productId: other.id, title: 'C', kind: 'technical' });
    const stranger = await seedUserWithRole(db, 'stranger', null, null);

    await expect(mergeDebts(db, editor, a.id, a.id)).rejects.toMatchObject({
      code: 'validation_failed',
    });
    await expect(mergeDebts(db, editor, a.id, c.id)).rejects.toMatchObject({
      code: 'validation_failed',
    });
    await expect(mergeDebts(db, editor, a.id, 'nope')).rejects.toMatchObject({ code: 'not_found' });
    await expect(mergeDebts(db, stranger, a.id, b.id)).rejects.toMatchObject({ code: 'forbidden' });
    await mergeDebts(db, editor, a.id, b.id);
    await expect(mergeDebts(db, editor, a.id, b.id)).rejects.toMatchObject({ code: 'conflict' });
  });
});
