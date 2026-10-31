import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { aggregateCube, priorityBand, type Metrics } from '@tessera/domain';
import { loadCube, type Prisma } from '@tessera/db';
import { dashboard, resolveRange } from '../../src/services/dashboard';
import { queryDebts, type DebtQuery } from '../../src/services/debt-query';
import { resetDb, useTestDeps } from '../helpers/app';

const db = useTestDeps();
let p1 = '';
let p2 = '';
let teamA = '';
let teamB = '';

beforeEach(async () => {
  await resetDb(db);
  await db.$executeRawUnsafe('TRUNCATE TABLE metric_snapshot');
  p1 = (await db.product.create({ data: { name: 'P1' } })).id;
  p2 = (await db.product.create({ data: { name: 'P2' } })).id;
  teamA = (await db.team.create({ data: { name: 'A' } })).id;
  teamB = (await db.team.create({ data: { name: 'B' } })).id;
  const kinds = ['technical', 'architectural'] as const;
  const statuses = ['open', 'planned', 'in_progress', 'repaid', 'accepted'] as const;
  const data = Array.from({ length: 60 }, (_, i) => ({
    productId: i % 3 === 0 ? p2 : p1,
    teamId: i % 4 === 0 ? null : i % 4 === 1 ? teamA : teamB,
    title: `Schuld ${i}`,
    kind: kinds[i % 2]!,
    status: statuses[i % 5]!,
    effortEstimate: i % 7 === 0 ? null : (i % 6) + 0.5,
    interestEstimate: i % 5 === 0 ? null : (i % 3) / 2,
    priorityCalculated: i % 8 === 0 ? null : (i * 13) % 101,
    priorityOverride: i % 11 === 0 ? 95 : null,
    priorityOverrideReason: i % 11 === 0 ? 'Audit' : null,
    archivedAt: i % 13 === 0 ? new Date() : null,
  }));
  await db.debtItem.createMany({ data });
});
afterAll(() => db.$disconnect());

/** The register's own view: page through everything it lists for the filters and add it up. */
async function fromRegister(filter: Pick<DebtQuery, 'productId' | 'teamId'>): Promise<Metrics> {
  const items: Awaited<ReturnType<typeof queryDebts>>['items'] = [];
  let cursor: string | undefined;
  do {
    const page = await queryDebts(db, {
      ...filter,
      includeArchived: false,
      sort: 'title',
      limit: 7,
      cursor,
    });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  const open = items.filter((d) => ['open', 'planned', 'in_progress'].includes(d.status));
  const count = <T extends string>(keys: readonly T[], pick: (d: (typeof items)[number]) => T) =>
    Object.fromEntries(keys.map((k) => [k, items.filter((d) => pick(d) === k).length])) as Record<
      T,
      number
    >;
  return {
    total: items.length,
    openCount: open.length,
    openEffort: Math.round(open.reduce((s, d) => s + (d.effortEstimate ?? 0), 0) * 100) / 100,
    openInterest: Math.round(open.reduce((s, d) => s + (d.interestEstimate ?? 0), 0) * 100) / 100,
    unestimatedOpen: open.filter((d) => d.effortEstimate === null).length,
    byStatus: count(['open', 'planned', 'in_progress', 'repaid', 'accepted'], (d) => d.status),
    byKind: count(['architectural', 'technical'], (d) => d.kind),
    byPriorityBand: count(['high', 'medium', 'low', 'unassessed'], (d) =>
      priorityBand(d.priorityEffective),
    ),
  };
}

describe('dashboard figures match the register (SC-006)', () => {
  it.each([
    ['no filter', {}],
    ['product', { productId: 'p1' }],
    ['other product', { productId: 'p2' }],
    ['team', { teamId: 'teamA' }],
    ['product and team', { productId: 'p1', teamId: 'teamB' }],
  ])('%s: every figure equals what the register lists', async (_name, spec) => {
    const filter = {
      ...('productId' in spec ? { productId: spec.productId === 'p1' ? p1 : p2 } : {}),
      ...('teamId' in spec ? { teamId: spec.teamId === 'teamA' ? teamA : teamB } : {}),
    };
    const dash = await dashboard(db, filter);
    const reg = await fromRegister(filter);
    expect(reg.total).toBeGreaterThan(0);
    expect(dash.current).toEqual(reg);
  });

  it('archived debts are in neither', async () => {
    const all = await dashboard(db, {});
    expect(all.current.total).toBe(60 - Math.ceil(60 / 13));
    expect(all.current.total).toBe((await fromRegister({})).total);
  });

  it('a manual priority override moves the debt between bands in both views', async () => {
    const debt = await db.debtItem.findFirstOrThrow({
      where: { archivedAt: null, priorityOverride: null, priorityCalculated: { lt: 40 } },
    });
    const before = (await dashboard(db, {})).current.byPriorityBand;
    await db.debtItem.update({
      where: { id: debt.id },
      data: { priorityOverride: 90, priorityOverrideReason: 'Test' },
    });
    const after = (await dashboard(db, {})).current.byPriorityBand;
    expect(after.high).toBe(before.high + 1);
    expect(after.low).toBe(before.low - 1);
    expect((await fromRegister({})).byPriorityBand).toEqual(after);
  });

  it('the cube the snapshots use is the one behind the dashboard', async () => {
    expect((await dashboard(db, {})).current).toEqual(aggregateCube(await loadCube(db)));
  });
});

describe('history from snapshots', () => {
  const snap = (
    over: Pick<Prisma.MetricSnapshotCreateManyInput, 'date' | 'productId' | 'teamId'> &
      Partial<Prisma.MetricSnapshotCreateManyInput>,
  ): Prisma.MetricSnapshotCreateManyInput => ({
    total: 1,
    openCount: 1,
    openEffort: 2,
    openInterest: 0,
    unestimatedOpen: 0,
    countByStatus: { open: 1 },
    countByKind: { technical: 1 },
    countByPriorityBand: { low: 1 },
    ...over,
  });

  it('sums the partitions of a day for the selected product and team and orders by day', async () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    await db.metricSnapshot.createMany({
      data: [
        snap({ date: d('2026-11-02'), productId: p1, teamId: teamA }),
        snap({
          date: d('2026-11-02'),
          productId: p1,
          teamId: teamB,
          total: 3,
          openCount: 2,
          openEffort: 5,
        }),
        snap({ date: d('2026-11-02'), productId: p2, teamId: null }),
        snap({ date: d('2026-11-01'), productId: p1, teamId: teamA, total: 9 }),
      ],
    });
    const now = new Date('2026-11-05T12:00:00Z');
    const all = await dashboard(db, { from: '2026-11-01', to: '2026-11-05' }, now);
    expect(all.history.map((h) => [h.date, h.total, h.openEffort])).toEqual([
      ['2026-11-01', 9, 2],
      ['2026-11-02', 5, 9],
    ]);
    expect(all.lastSnapshotDate).toBe('2026-11-02');
    expect(all.history[1]?.byStatus.open).toBe(3);

    const productOnly = await dashboard(
      db,
      { productId: p1, from: '2026-11-02', to: '2026-11-02' },
      now,
    );
    expect(productOnly.history[0]).toMatchObject({ total: 4, openCount: 3, openEffort: 7 });
    const teamOnly = await dashboard(
      db,
      { teamId: teamB, from: '2026-11-02', to: '2026-11-02' },
      now,
    );
    expect(teamOnly.history[0]).toMatchObject({ total: 3 });
  });

  it('has no history without snapshots and ranges are validated', async () => {
    expect((await dashboard(db, {})).history).toEqual([]);
    const now = new Date('2026-11-05T12:00:00Z');
    expect(resolveRange({}, now).from.toISOString().slice(0, 10)).toBe('2026-08-08'); // 90 days
    expect(() => resolveRange({ from: '2026-11-05', to: '2026-11-01' })).toThrow(/Startdatum/);
    expect(() => resolveRange({ from: '2024-01-01', to: '2026-01-01' })).toThrow(/höchstens/);
    expect(() => resolveRange({ from: '2026-02-30' })).toThrow(/gültiges Datum/);
  });
});
