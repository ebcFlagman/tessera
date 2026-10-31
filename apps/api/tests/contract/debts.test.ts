import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { listDebts, postDebt, getDebt, patchDebt } from '../../src/routes/debts';
import { call, resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';
import { assertMatchesContract } from './setup';

const db = useTestDeps();
let productId = '';

beforeEach(async () => {
  await resetDb(db);
  const p = await db.product.create({ data: { name: 'Plattform' } });
  productId = p.id;
  await seedUserWithRole(db, 'editor', productId, 'editor');
  await seedUserWithRole(db, 'reader', null, null);
});
afterAll(() => db.$disconnect());

describe('debts API contract', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await listDebts.handle(new Request('http://test.local/api/v1/debts'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
    assertMatchesContract('get', '/debts', 401, await res.json());
  });

  it('POST /debts creates a debt that matches the contract', async () => {
    const res = await call(postDebt, '/debts', 'editor', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        title: 'Modul A ist eng gekoppelt',
        kind: 'architectural',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('open');
    assertMatchesContract('post', '/debts', 201, body);
  });

  it('POST /debts validates input (422) and enforces roles (403)', async () => {
    const bad = await call(postDebt, '/debts', 'editor', {
      method: 'POST',
      body: JSON.stringify({ productId, title: '', kind: 'technical' }),
    });
    expect(bad.status).toBe(422);
    assertMatchesContract('post', '/debts', 422, await bad.json());

    const tooLong = await call(postDebt, '/debts', 'editor', {
      method: 'POST',
      body: JSON.stringify({ productId, title: 'x'.repeat(201), kind: 'technical' }),
    });
    expect(tooLong.status).toBe(422);

    const forbidden = await call(postDebt, '/debts', 'reader', {
      method: 'POST',
      body: JSON.stringify({ productId, title: 'Darf nicht', kind: 'technical' }),
    });
    expect(forbidden.status).toBe(403);
    assertMatchesContract('post', '/debts', 403, await forbidden.json());
  });

  it('GET /debts/{id} returns history; PATCH records status changes', async () => {
    const created = await (
      await call(postDebt, '/debts', 'editor', {
        method: 'POST',
        body: JSON.stringify({ productId, title: 'Alte Bibliothek', kind: 'technical' }),
      })
    ).json();

    const patched = await call(
      patchDebt,
      `/debts/${created.id}`,
      'editor',
      { method: 'PATCH', body: JSON.stringify({ status: 'planned' }) },
      { id: created.id },
    );
    expect(patched.status).toBe(200);
    assertMatchesContract('patch', '/debts/{id}', 200, await patched.json());

    const detail = await call(getDebt, `/debts/${created.id}`, 'reader', {}, { id: created.id });
    expect(detail.status).toBe(200); // any authenticated user may read
    const body = await detail.json();
    expect(body.events.map((e: { type: string }) => e.type)).toEqual(['status_changed', 'created']);
    expect(body.events[0].actorName).toBe('editor');
    assertMatchesContract('get', '/debts/{id}', 200, body);
  });

  it('PATCH to accepted needs a reason (422) and works with one', async () => {
    const created = await (
      await call(postDebt, '/debts', 'editor', {
        method: 'POST',
        body: JSON.stringify({ productId, title: 'Legacy', kind: 'architectural' }),
      })
    ).json();
    const without = await call(
      patchDebt,
      `/debts/${created.id}`,
      'editor',
      { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) },
      { id: created.id },
    );
    expect(without.status).toBe(422);
    const withReason = await call(
      patchDebt,
      `/debts/${created.id}`,
      'editor',
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'accepted', acceptedReason: 'Wird abgelöst' }),
      },
      { id: created.id },
    );
    expect(withReason.status).toBe(200);
    expect((await withReason.json()).acceptedReason).toBe('Wird abgelöst');
  });

  it('returns 404 for unknown debts', async () => {
    const res = await call(getDebt, '/debts/nope', 'reader', {}, { id: 'nope' });
    expect(res.status).toBe(404);
    assertMatchesContract('get', '/debts/{id}', 404, await res.json());
  });
});
