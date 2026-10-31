import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getTeams, postTeam, putTeamMembers } from '../../src/routes/admin';
import { getDashboard } from '../../src/routes/dashboard';
import { getPriorityList } from '../../src/routes/assessment';
import { listDebts, patchDebt, postDebt } from '../../src/routes/debts';
import { call, resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';
import { assertMatchesContract } from './setup';

const db = useTestDeps();
let productId = '';
const json = (body: unknown, method: string) => ({ method, body: JSON.stringify(body) });
const idOf = async (subject: string) =>
  (await db.user.findUniqueOrThrow({ where: { subject } })).id;

beforeEach(async () => {
  await resetDb(db);
  productId = (await db.product.create({ data: { name: 'Plattform' } })).id;
  await seedUserWithRole(db, 'admin', productId, 'admin');
  await seedUserWithRole(db, 'editor', productId, 'editor');
  await seedUserWithRole(db, 'reader', null, null);
});
afterAll(() => db.$disconnect());

describe('teams API', () => {
  it('admins create teams and set their members; the list shows the members', async () => {
    const created = await call(postTeam, '/teams', 'admin', json({ name: 'Alpha' }, 'POST'));
    expect(created.status).toBe(201);
    const team = await created.json();
    assertMatchesContract('post', '/teams', 201, team);

    const editor = await idOf('editor');
    const reader = await idOf('reader');
    const res = await call(
      putTeamMembers,
      `/teams/${team.id}/members`,
      'admin',
      json({ userIds: [editor, reader] }, 'PUT'),
      { id: team.id },
    );
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.members.map((m: { name: string }) => m.name)).toEqual(['editor', 'reader']);
    assertMatchesContract('put', '/teams/{id}/members', 200, updated);

    const replaced = await (
      await call(
        putTeamMembers,
        `/teams/${team.id}/members`,
        'admin',
        json({ userIds: [reader] }, 'PUT'),
        { id: team.id },
      )
    ).json();
    expect(replaced.members.map((m: { name: string }) => m.name)).toEqual(['reader']);

    const list = await (await call(getTeams, '/teams', 'reader')).json(); // anyone may read
    expect(list).toHaveLength(1);
    assertMatchesContract('get', '/teams', 200, list);
  });

  it('rejects non-admins (403), duplicates (409), unknown users and teams', async () => {
    expect((await call(postTeam, '/teams', 'editor', json({ name: 'X' }, 'POST'))).status).toBe(
      403,
    );
    await call(postTeam, '/teams', 'admin', json({ name: 'Alpha' }, 'POST'));
    expect((await call(postTeam, '/teams', 'admin', json({ name: 'Alpha' }, 'POST'))).status).toBe(
      409,
    );
    expect((await call(postTeam, '/teams', 'admin', json({ name: '  ' }, 'POST'))).status).toBe(
      422,
    );
    const team = await db.team.findFirstOrThrow();
    expect(
      (
        await call(
          putTeamMembers,
          `/teams/${team.id}/members`,
          'editor',
          json({ userIds: [] }, 'PUT'),
          { id: team.id },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          putTeamMembers,
          `/teams/${team.id}/members`,
          'admin',
          json({ userIds: ['nope'] }, 'PUT'),
          { id: team.id },
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await call(putTeamMembers, '/teams/nope/members', 'admin', json({ userIds: [] }, 'PUT'), {
          id: 'nope',
        })
      ).status,
    ).toBe(404);
  });

  it('debts can be assigned to a team and the team filter works in register, priority list and dashboard', async () => {
    const team = await (
      await call(postTeam, '/teams', 'admin', json({ name: 'Alpha' }, 'POST'))
    ).json();
    const make = async (title: string, teamId: string | null) =>
      (
        await call(
          postDebt,
          '/debts',
          'editor',
          json({ productId, title, kind: 'technical', teamId }, 'POST'),
        )
      ).json();
    const a = await make('im Team', team.id);
    await make('ohne Team', null);
    await db.debtItem.update({ where: { id: a.id }, data: { priorityCalculated: 80 } });

    const inTeam = async (path: string) =>
      (await call(listDebts, `${path}?teamId=${team.id}`, 'reader')).json();
    expect((await inTeam('/debts')).items.map((d: { title: string }) => d.title)).toEqual([
      'im Team',
    ]);
    const prio = await (
      await call(getPriorityList, `/priority-list?teamId=${team.id}`, 'reader')
    ).json();
    expect(prio.ranked.map((d: { title: string }) => d.title)).toEqual(['im Team']);
    expect(prio.unassessed).toEqual([]);
    const dash = await (await call(getDashboard, `/dashboard?teamId=${team.id}`, 'reader')).json();
    expect(dash.current.total).toBe(1);

    // moving the debt out of the team is possible, an unknown team or owner is refused readably
    const moved = await call(
      patchDebt,
      `/debts/${a.id}`,
      'editor',
      json({ teamId: null }, 'PATCH'),
      { id: a.id },
    );
    expect((await moved.json()).teamId).toBeNull();
    const badTeam = await call(
      patchDebt,
      `/debts/${a.id}`,
      'editor',
      json({ teamId: 'nope' }, 'PATCH'),
      { id: a.id },
    );
    expect(badTeam.status).toBe(422);
    expect((await badTeam.json()).message).toMatch(/Team/);
    const badOwner = await call(
      postDebt,
      '/debts',
      'editor',
      json({ productId, title: 'x', kind: 'technical', ownerId: 'nope' }, 'POST'),
    );
    expect(badOwner.status).toBe(422);
  });
});
