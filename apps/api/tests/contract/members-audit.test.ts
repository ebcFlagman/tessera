import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getAuditLog, getMembers, putMember } from '../../src/routes/admin';
import { call, resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';
import { assertMatchesContract } from './setup';

const db = useTestDeps();
let productId = '';
const put = (subject: string, body: unknown) =>
  call(
    putMember,
    `/products/${productId}/members`,
    subject,
    { method: 'PUT', body: JSON.stringify(body) },
    { id: productId },
  );

beforeEach(async () => {
  await resetDb(db);
  productId = (await db.product.create({ data: { name: 'Plattform' } })).id;
  await seedUserWithRole(db, 'admin', productId, 'admin');
  await seedUserWithRole(db, 'editor', productId, 'editor');
  await seedUserWithRole(db, 'newbie', null, null);
});
afterAll(() => db.$disconnect());

const idOf = async (subject: string) =>
  (await db.user.findUniqueOrThrow({ where: { subject } })).id;

describe('members API', () => {
  it('everyone may read the roles of a product', async () => {
    const res = await call(
      getMembers,
      `/products/${productId}/members`,
      'newbie',
      {},
      { id: productId },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map((m: { role: string }) => m.role).sort()).toEqual(['admin', 'editor']);
    assertMatchesContract('get', '/products/{id}/members', 200, body);
  });

  it('a product admin grants, changes and removes roles; the new list is returned', async () => {
    const newbie = await idOf('newbie');
    const granted = await put('admin', { userId: newbie, role: 'editor' });
    expect(granted.status).toBe(200);
    const list = await granted.json();
    expect(list.find((m: { userId: string }) => m.userId === newbie)).toMatchObject({
      role: 'editor',
    });
    assertMatchesContract('put', '/products/{id}/members', 200, list);

    const promoted = await (await put('admin', { userId: newbie, role: 'admin' })).json();
    expect(promoted.find((m: { userId: string }) => m.userId === newbie).role).toBe('admin');
    const removed = await (await put('admin', { userId: newbie, role: null })).json();
    expect(removed.some((m: { userId: string }) => m.userId === newbie)).toBe(false);
  });

  it('editors and users without a role may not change roles (403)', async () => {
    const newbie = await idOf('newbie');
    for (const subject of ['editor', 'newbie']) {
      const res = await put(subject, { userId: newbie, role: 'editor' });
      expect(res.status).toBe(403);
      assertMatchesContract('put', '/products/{id}/members', 403, await res.json());
    }
    expect(await db.membership.count({ where: { userId: newbie } })).toBe(0);
  });

  it('a product keeps at least one admin (409), and bad input is refused', async () => {
    const admin = await idOf('admin');
    const demote = await put('admin', { userId: admin, role: 'editor' });
    expect(demote.status).toBe(409);
    expect((await demote.json()).message).toMatch(/mindestens einen Administrator/);
    expect((await put('admin', { userId: admin, role: null })).status).toBe(409);
    expect((await put('admin', { userId: 'nope', role: 'editor' })).status).toBe(422);
    expect((await put('admin', { userId: admin, role: 'owner' })).status).toBe(422);
    expect(await db.membership.count({ where: { userId: admin, role: 'admin' } })).toBe(1);
  });
});

describe('audit log API', () => {
  it('only administrators may read it', async () => {
    for (const subject of ['editor', 'newbie']) {
      const res = await call(getAuditLog, '/audit-log', subject);
      expect(res.status).toBe(403);
    }
    const res = await call(getAuditLog, '/audit-log', 'admin');
    expect(res.status).toBe(200);
    assertMatchesContract('get', '/audit-log', 200, await res.json());
  });

  it('shows who changed what and when, newest first, with filters and paging', async () => {
    const newbie = await idOf('newbie');
    await put('admin', { userId: newbie, role: 'editor' });
    await put('admin', { userId: newbie, role: 'admin' });
    await put('admin', { userId: newbie, role: null });

    const all = await (await call(getAuditLog, '/audit-log?action=membership.set', 'admin')).json();
    expect(all.items).toHaveLength(3);
    expect(all.items[0]).toMatchObject({
      action: 'membership.set',
      targetType: 'product',
      targetId: productId,
      actorName: 'admin',
      details: { userName: 'newbie', from: 'admin', to: null },
    });
    expect(new Date(all.items[0].at) >= new Date(all.items[2].at)).toBe(true);
    assertMatchesContract('get', '/audit-log', 200, all);

    const page1 = await (
      await call(getAuditLog, '/audit-log?action=membership.set&limit=2', 'admin')
    ).json();
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await (
      await call(
        getAuditLog,
        `/audit-log?action=membership.set&limit=2&cursor=${page1.nextCursor}`,
        'admin',
      )
    ).json();
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();

    const adminId = await idOf('admin');
    expect(
      (await (await call(getAuditLog, `/audit-log?actorId=${adminId}`, 'admin')).json()).items
        .length,
    ).toBe(3);
    expect(
      (await (await call(getAuditLog, `/audit-log?actorId=${newbie}`, 'admin')).json()).items,
    ).toEqual([]);
    expect(
      (await (await call(getAuditLog, '/audit-log?targetType=team', 'admin')).json()).items,
    ).toEqual([]);
    const today = new Date().toISOString().slice(0, 10);
    expect(
      (await (await call(getAuditLog, `/audit-log?from=${today}&to=${today}`, 'admin')).json())
        .items.length,
    ).toBe(3);
    expect(
      (await (await call(getAuditLog, '/audit-log?to=2020-01-01', 'admin')).json()).items,
    ).toEqual([]);
  });

  it('validates its filters (422)', async () => {
    expect((await call(getAuditLog, '/audit-log?from=heute', 'admin')).status).toBe(422);
    expect((await call(getAuditLog, '/audit-log?from=2026-02-30', 'admin')).status).toBe(422);
    expect((await call(getAuditLog, '/audit-log?limit=0', 'admin')).status).toBe(422);
  });

  it('redacts secrets on the way out even if one was written by mistake', async () => {
    await db.auditEntry.create({
      data: {
        action: 'test.leak',
        targetType: 'x',
        targetId: 'x',
        details: { fine: 'ok', apiKey: 'sk-live-123', nested: { password: 'hunter2' } },
      },
    });
    const text = await (await call(getAuditLog, '/audit-log?action=test.leak', 'admin')).text();
    expect(text).not.toContain('sk-live-123');
    expect(text).not.toContain('hunter2');
    expect(text).toContain('[REDACTED]');
    expect(text).toContain('"fine":"ok"');
  });
});
