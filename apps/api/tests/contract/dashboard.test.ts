import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { exportDashboardRoute, exportDebtsRoute, getDashboard } from '../../src/routes/dashboard';
import { getTeams } from '../../src/routes/admin';
import { call, resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';
import { assertMatchesContract } from './setup';

const db = useTestDeps();
let productId = '';
let otherProductId = '';

const parseCsv = (text: string) =>
  text
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n')
    .map((line) => line.split(';'));

beforeEach(async () => {
  await resetDb(db);
  await db.$executeRawUnsafe('TRUNCATE TABLE metric_snapshot');
  productId = (await db.product.create({ data: { name: 'Plattform' } })).id;
  otherProductId = (await db.product.create({ data: { name: 'Webshop' } })).id;
  const owner = await seedUserWithRole(db, 'reader', null, null);
  const team = await db.team.create({ data: { name: 'Alpha' } });
  await db.debtItem.createMany({
    data: [
      {
        productId,
        title: 'Modul A',
        kind: 'architectural',
        effortEstimate: 3,
        priorityCalculated: 80,
        ownerId: owner.id,
        teamId: team.id,
      },
      {
        productId,
        title: 'Veraltet; mit "Anführungszeichen"',
        kind: 'technical',
        status: 'repaid',
      },
      { productId: otherProductId, title: 'Anderes Produkt', kind: 'technical', effortEstimate: 1 },
    ],
  });
});
afterAll(() => db.$disconnect());

describe('dashboard API', () => {
  it('GET /dashboard returns the live figures and matches the contract', async () => {
    const res = await call(getDashboard, '/dashboard', 'reader');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).toMatchObject({ total: 3, openCount: 2, openEffort: 4 });
    expect(body.history).toEqual([]);
    assertMatchesContract('get', '/dashboard', 200, body);

    const filtered = await (
      await call(getDashboard, `/dashboard?productId=${productId}`, 'reader')
    ).json();
    expect(filtered.current).toMatchObject({ total: 2, openCount: 1, openEffort: 3 });
    expect(filtered.current.byPriorityBand).toMatchObject({ high: 1, unassessed: 1 });
  });

  it('validates the period (422)', async () => {
    for (const q of [
      'from=2026-13-40',
      'from=2026-11-05&to=2026-11-01',
      'from=2020-01-01&to=2026-01-01',
      'from=heute',
    ]) {
      const res = await call(getDashboard, `/dashboard?${q}`, 'reader');
      expect(res.status, q).toBe(422);
      assertMatchesContract('get', '/dashboard', 422, await res.json());
    }
  });

  it('GET /teams lists teams for the filter', async () => {
    const res = await call(getTeams, '/teams', 'reader');
    const body = await res.json();
    expect(body).toEqual([{ id: expect.any(String), name: 'Alpha', members: [] }]);
    assertMatchesContract('get', '/teams', 200, body);
  });
});

describe('CSV export', () => {
  it('exports the register with the documented headers, encoding and content type', async () => {
    const res = await call(exportDebtsRoute, '/exports/debts', 'reader');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="tessera-schulden-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM so Excel reads UTF-8
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    const rows = parseCsv(text);
    expect(rows[0]).toEqual(
      expect.arrayContaining(['Titel', 'Produkt', 'Art', 'Status', 'Priorität (gilt)']),
    );
    expect(rows).toHaveLength(4); // header + 3 debts
    // highest priority first; German labels
    expect(rows[1]).toEqual(
      expect.arrayContaining(['Modul A', 'Plattform', 'Architektur', 'Offen', '80', '3']),
    );
    assertMatchesContract('get', '/exports/debts', 200, text);
  });

  it('contains exactly what the register shows for the same filters', async () => {
    const rows = parseCsv(
      await (
        await call(exportDebtsRoute, `/exports/debts?productId=${otherProductId}`, 'reader')
      ).text(),
    );
    expect(rows.map((r) => r[0])).toEqual(['Titel', 'Anderes Produkt']);
    const repaid = parseCsv(
      await (await call(exportDebtsRoute, '/exports/debts?status=repaid', 'reader')).text(),
    );
    expect(repaid).toHaveLength(2);
  });

  it('quotes separators and quotes properly', async () => {
    const text = await (
      await call(exportDebtsRoute, '/exports/debts?status=repaid', 'reader')
    ).text();
    expect(text).toContain('"Veraltet; mit ""Anführungszeichen"""');
  });

  it('neutralises spreadsheet formulas in untrusted titles (CSV injection)', async () => {
    await db.debtItem.createMany({
      data: ['=HYPERLINK("http://evil.example")', '+cmd|calc', '-2+3', '@SUM(A1)'].map((title) => ({
        productId,
        title,
        kind: 'technical' as const,
      })),
    });
    const text = await (await call(exportDebtsRoute, '/exports/debts', 'reader')).text();
    const titles = parseCsv(text)
      .slice(1)
      .map((r) => r[0]);
    for (const t of titles) expect(t).not.toMatch(/^"?[=+\-@]/);
    expect(text).toContain("'=HYPERLINK");
    expect(text).toContain("'+cmd|calc");
    expect(text).toContain("'-2+3");
    expect(text).toContain("'@SUM(A1)");
  });

  it('exports the dashboard figures: live row first, then the history', async () => {
    await db.metricSnapshot.create({
      data: {
        date: new Date('2026-11-01T00:00:00Z'),
        productId,
        total: 5,
        openCount: 4,
        openEffort: 7.5,
        openInterest: 0,
        unestimatedOpen: 0,
        countByStatus: {},
        countByKind: {},
        countByPriorityBand: { high: 2 },
      },
    });
    const res = await call(
      exportDashboardRoute,
      '/exports/dashboard?from=2026-10-01&to=2026-11-30',
      'reader',
    );
    expect(res.headers.get('content-disposition')).toContain('tessera-dashboard-');
    const rows = parseCsv(await res.text());
    expect(rows[0]?.[0]).toBe('Datum');
    expect(rows[1]).toEqual(['aktuell', '3', '2', '4', '0', '1', '0', '0', '2']);
    expect(rows[2]).toEqual(['2026-11-01', '5', '4', '7.5', '0', '2', '0', '0', '0']);
  });

  it('requires authentication', async () => {
    const res = await exportDebtsRoute.handle(
      new Request('http://test.local/api/v1/exports/debts'),
      {
        params: Promise.resolve({}),
      },
    );
    expect(res.status).toBe(401);
  });
});
