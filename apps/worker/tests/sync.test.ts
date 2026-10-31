import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ConnectorError } from '@tessera/connectors';
import { runSync } from '../src/jobs/sync-integration';
import {
  FakeSource,
  TOKEN,
  database,
  draft,
  makeDeps,
  newRun,
  resetDb,
  setupIntegration,
} from './helpers';

const db = database();
let source: FakeSource;
let integrationId = '';
let productId = '';

const sync = async () => {
  const run = await newRun(db, integrationId);
  return { run, result: await runSync(makeDeps(db, source), run.id) };
};
const listing = (...titles: string[]) =>
  titles.map((t) => ({ externalId: `issue:${t}`, draft: draft(t) }));

beforeEach(async () => {
  await resetDb(db);
  source = new FakeSource();
  const s = await setupIntegration(db);
  integrationId = s.integration.id;
  productId = s.product.id;
});
afterAll(() => db.$disconnect());

describe('import run', () => {
  it('creates debts with source references, history and a run summary', async () => {
    source.listing = listing('A', 'B', 'C');
    const { run, result } = await sync();
    expect(result).toMatchObject({ outcome: 'succeeded', counts: { created: 3, total: 3 } });

    const debts = await db.debtItem.findMany({
      where: { productId },
      include: { findings: true, events: true },
    });
    expect(debts).toHaveLength(3);
    expect(debts[0]?.findings).toHaveLength(1);
    expect(debts[0]?.status).toBe('open');
    expect(debts[0]?.fieldOrigin).toMatchObject({ title: 'source', effortEstimate: 'source' });
    expect(debts[0]?.events.map((e) => e.type)).toEqual(['imported']);
    expect(debts[0]?.events[0]?.actorId).toBeNull(); // done by the system

    const saved = await db.syncRun.findUnique({ where: { id: run.id } });
    expect(saved?.state).toBe('succeeded');
    expect(saved?.counts).toMatchObject({ created: 3 });
    const integration = await db.integration.findUnique({ where: { id: integrationId } });
    expect(integration).toMatchObject({ status: 'ok', lastError: null });
    expect(integration?.lastSyncAt).not.toBeNull();
  });

  it('is idempotent: a second identical run creates no duplicates and no events', async () => {
    source.listing = listing('A', 'B');
    await sync();
    const before = await db.debtEvent.count();
    const { result } = await sync();
    expect(result).toMatchObject({
      outcome: 'succeeded',
      counts: { created: 0, updated: 0, repaid: 0, unchanged: 2 },
    });
    expect(await db.debtItem.count()).toBe(2);
    expect(await db.finding.count()).toBe(2);
    expect(await db.debtEvent.count()).toBe(before);
  });

  it('updates source fields but protects manually edited ones and records the conflict', async () => {
    source.listing = listing('A');
    await sync();
    const debt = (await db.debtItem.findFirst())!;
    await db.debtItem.update({
      where: { id: debt.id },
      data: {
        title: 'Mein Titel',
        fieldOrigin: { ...(debt.fieldOrigin as object), title: 'manual' },
      },
    });
    source.listing = [
      {
        externalId: 'issue:A',
        draft: draft('A', { title: 'Quelle neu', description: 'neu', effortEstimate: 3 }),
      },
    ];
    const { result } = await sync();
    expect(result).toMatchObject({ counts: { updated: 1 } });

    const after = (await db.debtItem.findUnique({
      where: { id: debt.id },
      include: { findings: true },
    }))!;
    expect(after.title).toBe('Mein Titel'); // manual wins
    expect(after.description).toBe('neu');
    expect(after.effortEstimate).toBe(3);
    expect(after.findings[0]?.conflicts).toEqual([{ field: 'title', sourceValue: 'Quelle neu' }]);
  });

  it('repays debts whose finding disappeared, even a manually accepted one, and reopens on return', async () => {
    source.listing = listing('A', 'B');
    await sync();
    const a = (await db.debtItem.findFirst({ where: { title: 'A' } }))!;
    await db.debtItem.update({
      where: { id: a.id },
      data: { status: 'accepted', acceptedReason: 'bewusst' },
    });

    source.listing = listing('B'); // A is resolved in the source
    const { result } = await sync();
    expect(result).toMatchObject({ counts: { repaid: 1 } });
    const repaid = (await db.debtItem.findUnique({
      where: { id: a.id },
      include: { events: true, findings: true },
    }))!;
    expect(repaid.status).toBe('repaid');
    expect(repaid.findings[0]?.goneAt).not.toBeNull();
    const event = repaid.events.find((e) => e.type === 'repaid_by_source');
    expect(event?.changes).toMatchObject({
      status: { from: 'accepted', to: 'repaid' },
      reason: 'in Quelle behoben',
    });
    expect(event?.actorId).toBeNull();

    source.listing = listing('A', 'B'); // it comes back
    const again = await sync();
    expect(again.result).toMatchObject({ counts: { reopened: 1, created: 0 } });
    const reopened = (await db.debtItem.findUnique({
      where: { id: a.id },
      include: { findings: true },
    }))!;
    expect(reopened.status).toBe('open');
    expect(reopened.findings[0]?.goneAt).toBeNull();
    expect(await db.debtItem.count()).toBe(2); // no duplicate for the returning finding
  });

  it('fails with a readable message, keeps existing data, and recovers on the next run', async () => {
    source.listing = listing('A');
    await sync();
    const snapshot = JSON.stringify(await db.debtItem.findMany({ orderBy: { id: 'asc' } }));

    source.error = new ConnectorError('InvalidCredentials', 'SonarCloud lehnt die Zugangsdaten ab');
    const { run, result } = await sync();
    expect(result).toMatchObject({
      outcome: 'failed',
      error: 'SonarCloud lehnt die Zugangsdaten ab',
    });
    const failedRun = await db.syncRun.findUnique({ where: { id: run.id } });
    expect(failedRun).toMatchObject({
      state: 'failed',
      error: 'SonarCloud lehnt die Zugangsdaten ab',
    });
    expect(await db.integration.findUnique({ where: { id: integrationId } })).toMatchObject({
      status: 'error',
      lastError: 'SonarCloud lehnt die Zugangsdaten ab',
    });
    expect(JSON.stringify(await db.debtItem.findMany({ orderBy: { id: 'asc' } }))).toBe(snapshot);

    source.error = undefined;
    await sync();
    expect(await db.integration.findUnique({ where: { id: integrationId } })).toMatchObject({
      status: 'ok',
      lastError: null,
    });
  });

  it('a listing that breaks half-way changes nothing (absent findings are not treated as resolved)', async () => {
    source.listing = listing('A', 'B', 'C', 'D');
    await sync();
    const snapshot = JSON.stringify(await db.debtItem.findMany({ orderBy: { id: 'asc' } }));
    source.listing = listing('A'); // first page only, then the source breaks
    source.error = new ConnectorError('PartialData', 'unvollständig');
    source.failAfterFirstPage = true;
    const { result } = await sync();
    expect(result.outcome).toBe('failed');
    expect(JSON.stringify(await db.debtItem.findMany({ orderBy: { id: 'asc' } }))).toBe(snapshot);
    expect(await db.finding.count({ where: { goneAt: { not: null } } })).toBe(0);
  });

  it('hands the decrypted token to the connector but never stores or logs it', async () => {
    source.listing = listing('A');
    await sync();
    expect(source.seenCredentials).toEqual([TOKEN]);

    source.error = new ConnectorError('Unreachable', 'SonarCloud ist nicht erreichbar');
    await sync();
    const stored = JSON.stringify({
      runs: await db.syncRun.findMany(),
      integration: await db.integration.findMany({
        select: { lastError: true, config: true, status: true },
      }),
      audit: await db.auditEntry.findMany(),
      findings: await db.finding.findMany(),
    });
    expect(stored).not.toContain(TOKEN);
  });

  it('turns an unexpected error into a generic message without internals', async () => {
    source.connector.fetchFindings = () => ({
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          throw new Error(`boom with ${TOKEN}`);
        },
      }),
    });
    const { result } = await sync();
    expect(result).toEqual({ outcome: 'failed', error: 'Unerwarteter Fehler beim Import' });
    expect(JSON.stringify(await db.syncRun.findMany())).not.toContain(TOKEN);
  });

  it('skips runs that are not queued', async () => {
    source.listing = listing('A');
    const { run } = await sync();
    expect(await runSync(makeDeps(db, source), run.id)).toEqual({ outcome: 'skipped' });
    expect(await runSync(makeDeps(db, source), 'does-not-exist')).toEqual({ outcome: 'skipped' });
  });
});
