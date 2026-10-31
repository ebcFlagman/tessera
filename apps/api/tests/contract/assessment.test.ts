import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteOverride,
  getAssessments,
  getModel,
  getPriorityList,
  postAssessment,
  putModel,
  putOverride,
} from '../../src/routes/assessment';
import { call, resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';
import { assertMatchesContract } from './setup';

const db = useTestDeps();
let debtId = '';
const json = (body: unknown, method: string) => ({ method, body: JSON.stringify(body) });
const all4 = { impact: 5, risk: 4, interest: 3, effort: 2 };

beforeEach(async () => {
  await resetDb(db);
  const p = await db.product.create({ data: { name: 'Plattform' } });
  await seedUserWithRole(db, 'admin', p.id, 'admin');
  await seedUserWithRole(db, 'editor', p.id, 'editor');
  await seedUserWithRole(db, 'reader', null, null);
  const d = await db.debtItem.create({
    data: { productId: p.id, title: 'Kopplung', kind: 'architectural' },
  });
  debtId = d.id;
});
afterAll(() => db.$disconnect());

describe('assessment API contract', () => {
  it('GET /assessment-model returns the default model for any authenticated user', async () => {
    const res = await call(getModel, '/assessment-model', 'reader');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe(1);
    expect(body.criteria.map((c: { key: string }) => c.key)).toEqual([
      'impact',
      'risk',
      'interest',
      'effort',
    ]);
    assertMatchesContract('get', '/assessment-model', 200, body);
  });

  it('POST /debts/{id}/assessments stores an assessment with its derivation', async () => {
    const res = await call(
      postAssessment,
      `/debts/${debtId}/assessments`,
      'editor',
      json({ scores: all4, comment: 'Einschätzung im Refinement' }, 'POST'),
      { id: debtId },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.priorityCalculated).toBeGreaterThan(0);
    expect(body.breakdown).toHaveLength(4);
    assertMatchesContract('post', '/debts/{id}/assessments', 201, body);

    const list = await call(
      getAssessments,
      `/debts/${debtId}/assessments`,
      'reader',
      {},
      { id: debtId },
    );
    expect(list.status).toBe(200);
    const items = await list.json();
    expect(items).toHaveLength(1);
    assertMatchesContract('get', '/debts/{id}/assessments', 200, items);
  });

  it('rejects invalid scores (422) and readers (403)', async () => {
    const bad = await call(
      postAssessment,
      `/debts/${debtId}/assessments`,
      'editor',
      json({ scores: { ...all4, impact: 9 } }, 'POST'),
      { id: debtId },
    );
    expect(bad.status).toBe(422);
    assertMatchesContract('post', '/debts/{id}/assessments', 422, await bad.json());

    const missing = await call(
      postAssessment,
      `/debts/${debtId}/assessments`,
      'editor',
      json({ scores: { impact: 3 } }, 'POST'),
      { id: debtId },
    );
    expect(missing.status).toBe(422);

    const forbidden = await call(
      postAssessment,
      `/debts/${debtId}/assessments`,
      'reader',
      json({ scores: all4 }, 'POST'),
      { id: debtId },
    );
    expect(forbidden.status).toBe(403);
  });

  it('PUT/DELETE /debts/{id}/priority-override needs a reason and is reversible', async () => {
    const noReason = await call(
      putOverride,
      `/debts/${debtId}/priority-override`,
      'editor',
      json({ value: 90, reason: '  ' }, 'PUT'),
      { id: debtId },
    );
    expect(noReason.status).toBe(422);

    const ok = await call(
      putOverride,
      `/debts/${debtId}/priority-override`,
      'editor',
      json({ value: 90, reason: 'Audit-Befund' }, 'PUT'),
      { id: debtId },
    );
    expect(ok.status).toBe(200);
    const debt = await ok.json();
    expect(debt).toMatchObject({
      priorityOverride: 90,
      priorityEffective: 90,
      priorityCalculated: null,
    });
    assertMatchesContract('put', '/debts/{id}/priority-override', 200, debt);

    const cleared = await call(
      deleteOverride,
      `/debts/${debtId}/priority-override`,
      'editor',
      { method: 'DELETE' },
      { id: debtId },
    );
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ priorityOverride: null, priorityEffective: null });
  });

  it('PUT /assessment-model is admin-only and returns the recalculation summary', async () => {
    const criteria = [
      { key: 'impact', name: 'Auswirkung', weight: 1, direction: 'up' },
      { key: 'effort', name: 'Aufwand', weight: 1, direction: 'down' },
    ];
    const denied = await call(putModel, '/assessment-model', 'editor', json({ criteria }, 'PUT'));
    expect(denied.status).toBe(403);

    const ok = await call(putModel, '/assessment-model', 'admin', json({ criteria }, 'PUT'));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.model.version).toBe(2);
    assertMatchesContract('put', '/assessment-model', 200, body);

    const invalid = await call(
      putModel,
      '/assessment-model',
      'admin',
      json({ criteria: [{ ...criteria[0], weight: 0 }] }, 'PUT'),
    );
    expect(invalid.status).toBe(422);
  });

  it('GET /priority-list returns ranked and unassessed debts separately', async () => {
    const res = await call(getPriorityList, '/priority-list', 'reader');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ranked).toEqual([]);
    expect(body.unassessed).toHaveLength(1);
    assertMatchesContract('get', '/priority-list', 200, body);
  });
});
