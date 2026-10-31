import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { User } from '@tessera/db';
import { getConnector } from '@tessera/connectors';
import { defaultCriteria } from '@tessera/domain';
import { replaceModel } from '../../src/services/assessment';
import { createDebt, updateDebt } from '../../src/services/debts';
import {
  createIntegration,
  deleteIntegration,
  requestSync,
  updateIntegration,
} from '../../src/services/integrations';
import { setMember } from '../../src/services/members';
import { createProduct, updateProduct } from '../../src/services/products';
import { createTeam, setTeamMembers } from '../../src/services/teams';
import { getDeps } from '../../src/lib/deps';
import { resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';

/** SC-007: every change to roles, integrations and the scoring model is in the log; no secrets. */
const SECRET = 'glpat-SUPER-SECRET-TOKEN-4711';
const NEW_SECRET = 'glpat-ROTATED-SECRET-0815';
const db = useTestDeps();
let admin: User;
let member: User;
let productId = '';

beforeEach(async () => {
  await resetDb(db);
  productId = (await db.product.create({ data: { name: 'P' } })).id;
  admin = await seedUserWithRole(db, 'admin', productId, 'admin');
  member = await seedUserWithRole(db, 'member', null, null);
});
afterAll(() => db.$disconnect());

const actions = async () =>
  (await db.auditEntry.findMany({ orderBy: { at: 'asc' } })).map((e) => e.action);

describe('audit trail (SC-007)', () => {
  it('records role, integration and model changes with actor, target and details', async () => {
    const deps = getDeps();
    await setMember(db, admin, productId, { userId: member.id, role: 'editor' });
    await setMember(db, admin, productId, { userId: member.id, role: 'admin' });
    await setMember(db, admin, productId, { userId: member.id, role: null });

    const integration = await createIntegration(deps, admin, productId, {
      type: 'gitlab',
      name: 'GL',
      config: { projectId: '42' },
      credentials: SECRET,
    });
    await updateIntegration(deps, admin, integration.id, {
      scheduleMinutes: 30,
      credentials: NEW_SECRET,
    });
    await updateIntegration(deps, admin, integration.id, { disabled: true });
    await updateIntegration(deps, admin, integration.id, { disabled: false });
    await requestSync(deps, admin, integration.id);
    await deleteIntegration(db, admin, integration.id);

    await replaceModel(db, admin, [
      ...defaultCriteria,
      { key: 'extra', name: 'Extra', weight: 1, direction: 'up' },
    ]);
    const team = await createTeam(db, admin, { name: 'Alpha' });
    await setTeamMembers(db, admin, team.id, { userIds: [member.id] });
    const product = await createProduct(db, admin, { name: 'Neu' });
    await updateProduct(db, admin, product.id, { archived: true });

    expect(await actions()).toEqual([
      'membership.set',
      'membership.set',
      'membership.set',
      'integration.created',
      'integration.updated',
      'integration.updated',
      'integration.updated',
      'integration.sync-requested',
      'integration.deleted',
      'assessment-model.updated',
      'team.created',
      'team.members-updated',
      'product.created',
      'product.archived',
    ]);

    const entries = await db.auditEntry.findMany({ orderBy: { at: 'asc' } });
    expect(entries.every((e) => e.actorId === admin.id)).toBe(true); // who
    expect(entries.every((e) => e.at instanceof Date)).toBe(true); // when
    expect(entries[0]).toMatchObject({ targetType: 'product', targetId: productId }); // what
    expect(entries[0]?.details).toMatchObject({ userId: member.id, from: null, to: 'editor' });
    expect(entries[2]?.details).toMatchObject({ from: 'admin', to: null });
    const updated = entries.find((e) => e.action === 'integration.updated');
    expect((updated?.details as { fields: string[] }).fields.sort()).toEqual([
      'credentials',
      'scheduleMinutes',
    ]);
    expect(entries.find((e) => e.action === 'assessment-model.updated')?.details).toMatchObject({
      version: 2,
    });
    expect(entries.find((e) => e.action === 'team.members-updated')?.details).toMatchObject({
      added: [member.id],
      removed: [],
    });
  });

  it('never contains a credential, even after creating, rotating and deleting an integration', async () => {
    const deps = getDeps();
    const integration = await createIntegration(deps, admin, productId, {
      type: 'gitlab',
      name: 'GL',
      config: { projectId: '42' },
      credentials: SECRET,
    });
    await updateIntegration(deps, admin, integration.id, { credentials: NEW_SECRET });
    await deleteIntegration(db, admin, integration.id);
    const dump = JSON.stringify({
      audit: await db.auditEntry.findMany(),
      events: await db.debtEvent.findMany(),
      runs: await db.syncRun.findMany(),
    });
    expect(dump).not.toContain(SECRET);
    expect(dump).not.toContain(NEW_SECRET);
    expect(dump).not.toContain('credentials":"');
  });

  it('no change goes unrecorded: unchanged roles or members add no entries, failures add none', async () => {
    await setMember(db, admin, productId, { userId: member.id, role: 'editor' });
    const before = await db.auditEntry.count();
    await setMember(db, admin, productId, { userId: member.id, role: 'editor' }); // unchanged
    await expect(
      setMember(db, admin, productId, { userId: admin.id, role: 'editor' }),
    ).rejects.toMatchObject({
      code: 'conflict',
    }); // last admin
    await expect(
      setMember(db, member, productId, { userId: member.id, role: 'admin' }),
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect(await db.auditEntry.count()).toBe(before);
  });

  it('debt changes are recorded too', async () => {
    const debt = await createDebt(db, admin, { productId, title: 'x', kind: 'technical' });
    await updateDebt(db, admin, debt.id, { title: 'y' });
    expect(await actions()).toEqual(['debt.created', 'debt.updated']);
    void getConnector;
  });
});
