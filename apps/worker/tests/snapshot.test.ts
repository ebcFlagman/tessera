import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadCube } from '@tessera/db';
import { aggregateCube } from '@tessera/domain';
import { ensureTodaySnapshot, snapshotDay, takeSnapshot } from '../src/jobs/metric-snapshot';
import { database, resetDb } from './helpers';

const db = database();
const DAY1 = new Date('2026-11-02T10:30:00Z');
const DAY2 = new Date('2026-11-03T08:00:00Z');

beforeEach(async () => {
  await resetDb(db);
  await db.$executeRawUnsafe('TRUNCATE TABLE metric_snapshot');
});
afterAll(() => db.$disconnect());

async function seed() {
  const p1 = await db.product.create({ data: { name: 'P1' } });
  const p2 = await db.product.create({ data: { name: 'P2' } });
  await db.product.create({ data: { name: 'Leer' } });
  const team = await db.team.create({ data: { name: 'Alpha' } });
  await db.debtItem.createMany({
    data: [
      { productId: p1.id, teamId: team.id, title: 'a', kind: 'technical', effortEstimate: 2 },
      {
        productId: p1.id,
        teamId: team.id,
        title: 'b',
        kind: 'architectural',
        effortEstimate: 3,
        status: 'planned',
      },
      { productId: p1.id, title: 'c', kind: 'technical', status: 'repaid', effortEstimate: 9 },
      {
        productId: p2.id,
        title: 'd',
        kind: 'technical',
        effortEstimate: 1.5,
        interestEstimate: 0.5,
      },
      { productId: p2.id, title: 'archiviert', kind: 'technical', archivedAt: new Date() },
    ],
  });
  return { p1, p2, team };
}

describe('daily snapshot', () => {
  it('stores one row per (product, team) partition and the parts add up to the live figures', async () => {
    const { p1, p2, team } = await seed();
    const result = await takeSnapshot(db, DAY1);
    expect(result.date).toEqual(snapshotDay(DAY1));

    const rows = await db.metricSnapshot.findMany({
      orderBy: [{ productId: 'asc' }, { teamId: 'asc' }],
    });
    const byKey = (productId: string, teamId: string | null) =>
      rows.find((r) => r.productId === productId && r.teamId === teamId);
    expect(byKey(p1.id, team.id)).toMatchObject({ total: 2, openCount: 2, openEffort: 5 });
    expect(byKey(p1.id, null)).toMatchObject({ total: 1, openCount: 0, openEffort: 0 }); // repaid
    expect(byKey(p2.id, null)).toMatchObject({
      total: 1,
      openCount: 1,
      openEffort: 1.5,
      openInterest: 0.5,
    });
    expect(rows.some((r) => r.total === 0 && r.teamId === null)).toBe(true); // the empty product

    const live = aggregateCube(await loadCube(db));
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(live.total);
    expect(rows.reduce((s, r) => s + r.openEffort, 0)).toBeCloseTo(live.openEffort);
  });

  it('is repeatable: running a day again replaces it instead of adding rows', async () => {
    await seed();
    await takeSnapshot(db, DAY1);
    const first = await db.metricSnapshot.count();
    await takeSnapshot(db, new Date(DAY1.getTime() + 3600_000));
    expect(await db.metricSnapshot.count()).toBe(first);
  });

  it('keeps one set per day, so a history builds up', async () => {
    const { p1 } = await seed();
    await takeSnapshot(db, DAY1);
    await db.debtItem.create({
      data: { productId: p1.id, title: 'neu', kind: 'technical', effortEstimate: 4 },
    });
    await takeSnapshot(db, DAY2);
    const days = await db.metricSnapshot.findMany({ distinct: ['date'], select: { date: true } });
    expect(days).toHaveLength(2);
    const total = async (d: Date) =>
      (await db.metricSnapshot.findMany({ where: { date: snapshotDay(d) } })).reduce(
        (s, r) => s + r.total,
        0,
      );
    expect(await total(DAY2)).toBe((await total(DAY1)) + 1);
  });

  it('the database refuses a duplicate partition for the same day', async () => {
    const { p1 } = await seed();
    const row = {
      date: snapshotDay(DAY1),
      productId: p1.id,
      teamId: null,
      total: 0,
      openCount: 0,
      openEffort: 0,
      openInterest: 0,
      unestimatedOpen: 0,
      countByStatus: {},
      countByKind: {},
      countByPriorityBand: {},
    };
    await db.metricSnapshot.create({ data: row });
    await expect(db.metricSnapshot.create({ data: row })).rejects.toThrow();
  });

  it('ensureTodaySnapshot only creates a snapshot when none exists for the day', async () => {
    await seed();
    expect(await ensureTodaySnapshot(db, DAY1)).not.toBeNull();
    expect(await ensureTodaySnapshot(db, DAY1)).toBeNull();
  });
});
