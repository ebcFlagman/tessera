import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dashboard } from '../../src/services/dashboard';
import { queryDebts } from '../../src/services/debt-query';
import { exportDebts } from '../../src/services/export';
import { priorityList } from '../../src/services/priority-list';
import { resetDb, useTestDeps } from '../helpers/app';

/** SC-005: register, filter and dashboard views appear in under 3 seconds with up to 10,000 debts. */
const LIMIT_MS = 3000;
const N = 10_000;
const db = useTestDeps();

async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  console.log(`[perf] ${label}: ${ms} ms`);
  return { result, ms };
}

beforeAll(async () => {
  await resetDb(db);
  await db.$executeRawUnsafe('TRUNCATE TABLE metric_snapshot');
  const products = await Promise.all(
    Array.from({ length: 10 }, (_, i) => db.product.create({ data: { name: `Produkt ${i}` } })),
  );
  const teams = await Promise.all(
    Array.from({ length: 5 }, (_, i) => db.team.create({ data: { name: `Team ${i}` } })),
  );
  const kinds = ['technical', 'architectural'] as const;
  const statuses = ['open', 'planned', 'in_progress', 'repaid', 'accepted'] as const;
  for (let start = 0; start < N; start += 2500) {
    await db.debtItem.createMany({
      data: Array.from({ length: 2500 }, (_, j) => {
        const i = start + j;
        return {
          productId: products[i % products.length]!.id,
          teamId: i % 6 === 0 ? null : teams[i % teams.length]!.id,
          title: `Schuld ${i}: Modul ${i % 97} ist zu eng gekoppelt`,
          description: `Beschreibung der Schuld ${i} mit etwas mehr Text, damit die Suche etwas zu tun hat.`,
          kind: kinds[i % 2]!,
          status: statuses[i % 5]!,
          effortEstimate: i % 9 === 0 ? null : (i % 20) / 2,
          interestEstimate: (i % 7) / 4,
          priorityCalculated: i % 5 === 0 ? null : (i * 37) % 101,
        };
      }),
    });
  }
  await db.metricSnapshot.createMany({
    data: Array.from({ length: 90 }, (_, d) => ({
      date: new Date(Date.UTC(2026, 7, 1 + d)),
      productId: products[d % products.length]!.id,
      total: 100,
      openCount: 60,
      openEffort: 120,
      openInterest: 3,
      unestimatedOpen: 5,
      countByStatus: {},
      countByKind: {},
      countByPriorityBand: {},
    })),
  });
}, 120_000);
afterAll(() => db.$disconnect());

describe(`with ${N} debts`, () => {
  it('has the expected volume', async () => {
    expect(await db.debtItem.count()).toBe(N);
  });

  it('shows the first register page in under 3 s', async () => {
    const { result, ms } = await timed('register, newest first', () =>
      queryDebts(db, { includeArchived: false, sort: '-createdAt', limit: 25 }),
    );
    expect(result.items).toHaveLength(25);
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it('filters, searches and sorts by priority in under 3 s', async () => {
    const { result, ms } = await timed('register, search + filters + priority sort', () =>
      queryDebts(db, {
        q: 'modul 42',
        kind: 'technical',
        status: 'open',
        includeArchived: false,
        sort: '-priority',
        limit: 25,
      }),
    );
    expect(result.items.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it('pages deep into the register in under 3 s', async () => {
    const first = await queryDebts(db, { includeArchived: false, sort: 'title', limit: 100 });
    let cursor = first.nextCursor ?? undefined;
    for (let i = 0; i < 50 && cursor; i++) {
      cursor =
        (await queryDebts(db, { includeArchived: false, sort: 'title', limit: 100, cursor }))
          .nextCursor ?? undefined;
    }
    const { ms } = await timed('register, page 52', () =>
      queryDebts(db, {
        includeArchived: false,
        sort: 'title',
        limit: 100,
        ...(cursor ? { cursor } : {}),
      }),
    );
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it('computes the dashboard in under 3 s, unfiltered and filtered', async () => {
    const all = await timed('dashboard', () => dashboard(db, {}, new Date('2026-10-30T00:00:00Z')));
    expect(all.result.current.total).toBe(N);
    expect(all.result.history.length).toBeGreaterThan(0);
    expect(all.ms).toBeLessThan(LIMIT_MS);
    const team = (await db.team.findFirstOrThrow()).id;
    const filtered = await timed('dashboard, filtered', () => dashboard(db, { teamId: team }));
    expect(filtered.ms).toBeLessThan(LIMIT_MS);
  });

  it('builds the priority list and the full export in under 3 s', async () => {
    const list = await timed('priority list', () => priorityList(db, { limit: 50 }));
    expect(list.result.ranked.length).toBe(50);
    expect(list.ms).toBeLessThan(LIMIT_MS);

    const exported = await timed('export of all debts', () =>
      exportDebts(db, { includeArchived: false }).then((r) => r.text()),
    );
    expect(exported.result.split('\r\n').length).toBe(N + 2); // header + rows + trailing newline
    expect(exported.ms).toBeLessThan(LIMIT_MS);
  });
});
