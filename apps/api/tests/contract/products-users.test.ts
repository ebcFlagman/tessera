import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { listProducts, listUsers, patchProduct, postProduct } from '../../src/routes/products';
import { call, resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';
import { assertMatchesContract } from './setup';

const db = useTestDeps();
beforeEach(() => resetDb(db));
afterAll(() => db.$disconnect());

describe('products and users API', () => {
  it('lets the first user create a product and become its admin; later creation needs admin', async () => {
    const first = await call(postProduct, '/products', 'ada', {
      method: 'POST',
      body: JSON.stringify({ name: 'Webshop' }),
    });
    expect(first.status).toBe(201);
    assertMatchesContract('post', '/products', 201, await first.json());

    const stranger = await call(postProduct, '/products', 'stranger', {
      method: 'POST',
      body: JSON.stringify({ name: 'Zweites' }),
    });
    expect(stranger.status).toBe(403);

    const dup = await call(postProduct, '/products', 'ada', {
      method: 'POST',
      body: JSON.stringify({ name: 'Webshop' }),
    });
    expect(dup.status).toBe(409);
  });

  it('archiving a product archives its debts instead of deleting them', async () => {
    const product = await db.product.create({ data: { name: 'P' } });
    await seedUserWithRole(db, 'admin', product.id, 'admin');
    const debt = await db.debtItem.create({
      data: { productId: product.id, title: 'x', kind: 'technical' },
    });

    const res = await call(
      patchProduct,
      `/products/${product.id}`,
      'admin',
      { method: 'PATCH', body: JSON.stringify({ archived: true }) },
      { id: product.id },
    );
    expect(res.status).toBe(200);
    assertMatchesContract('patch', '/products/{id}', 200, await res.json());
    const after = await db.debtItem.findUnique({ where: { id: debt.id } });
    expect(after?.archivedAt).not.toBeNull();

    const list = await call(listProducts, '/products', 'admin');
    expect(await list.json()).toEqual([]);
  });

  it('only product admins may patch a product', async () => {
    const product = await db.product.create({ data: { name: 'P' } });
    await seedUserWithRole(db, 'ed', product.id, 'editor');
    const res = await call(
      patchProduct,
      `/products/${product.id}`,
      'ed',
      { method: 'PATCH', body: JSON.stringify({ name: 'X' }) },
      { id: product.id },
    );
    expect(res.status).toBe(403);
  });

  it('GET /users searches by name or email', async () => {
    await seedUserWithRole(db, 'anna', null, null);
    await seedUserWithRole(db, 'bernd', null, null);
    const res = await call(listUsers, '/users?q=ann', 'bernd');
    const body = await res.json();
    expect(body.map((u: { name: string }) => u.name)).toEqual(['anna']);
    assertMatchesContract('get', '/users', 200, body);
  });
});
