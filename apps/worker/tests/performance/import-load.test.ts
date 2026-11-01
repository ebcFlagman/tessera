import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getConnector } from '@tessera/connectors';
import { encryptSecret } from '@tessera/domain';
import { runSync } from '../../src/jobs/sync-integration';
import { database, keyring, newRun, resetDb, TOKEN } from '../helpers';

/**
 * SC-003: a first import of up to 1,000 findings finishes in under 10 minutes, and repeating it
 * creates no duplicates. Runs the real SonarCloud connector against a local server that pages like
 * the real API (500 per page), through the real database path.
 */
const N = 1000;
const LIMIT_MS = 10 * 60_000;
const db = database();
let server: Server;
let baseUrl = '';
let issues: { key: string; message: string }[] = [];
let requests = 0;

beforeAll(async () => {
  server = createServer((req, res) => {
    requests++;
    const url = new URL(req.url ?? '/', 'http://localhost');
    const send = (body: unknown) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === '/api/issues/search') {
      const page = Number(url.searchParams.get('p'));
      const size = Number(url.searchParams.get('ps'));
      return send({
        paging: { pageIndex: page, pageSize: size, total: issues.length },
        issues: issues.slice((page - 1) * size, page * size).map((i) => ({
          key: i.key,
          rule: 'java:S3776',
          severity: 'MAJOR',
          message: i.message,
          component: 'demo:src/Order.java',
          line: 10,
          type: 'CODE_SMELL',
          effort: '30min',
          tags: [],
        })),
      });
    }
    if (url.pathname === '/api/hotspots/search') {
      return send({ paging: { pageIndex: 1, pageSize: 500, total: 0 }, hotspots: [] });
    }
    return send({ component: { measures: [] } });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
  requests = 0;
  issues = Array.from({ length: N }, (_, i) => ({
    key: `K${i}`,
    message: `Issue ${i}: Methode zu komplex`,
  }));
});

async function setup() {
  const product = await db.product.create({ data: { name: 'P' } });
  return db.integration.create({
    data: {
      productId: product.id,
      type: 'sonarcloud',
      name: 'Load',
      config: { projectKey: 'demo', baseUrl },
      credentialsEncrypted: encryptSecret(TOKEN, keyring),
    },
  });
}
const deps = () => ({ db, getConnector, keyring, http: fetch, allowedHosts: ['localhost'] });

describe(`import of ${N} findings`, () => {
  it('finishes within the time limit, pages like the real API, and is idempotent', async () => {
    const integration = await setup();

    const first = await newRun(db, integration.id);
    const t0 = performance.now();
    const result = await runSync(deps(), first.id);
    const firstMs = Math.round(performance.now() - t0);
    console.log(`[perf] first import of ${N} findings: ${firstMs} ms (${requests} requests)`);
    expect(result).toMatchObject({ outcome: 'succeeded', counts: { created: N, total: N } });
    expect(firstMs).toBeLessThan(LIMIT_MS);
    expect(requests).toBeGreaterThanOrEqual(4); // 2 issue pages + hotspots + measures
    expect(await db.debtItem.count()).toBe(N);
    expect(await db.finding.count()).toBe(N);

    // the same listing again: no duplicates, nothing changed
    const second = await newRun(db, integration.id);
    const t1 = performance.now();
    const again = await runSync(deps(), second.id);
    console.log(`[perf] repeated import: ${Math.round(performance.now() - t1)} ms`);
    expect(again).toMatchObject({
      outcome: 'succeeded',
      counts: { created: 0, updated: 0, repaid: 0, unchanged: N },
    });
    expect(await db.debtItem.count()).toBe(N);
    expect(await db.finding.count()).toBe(N);
  });

  it('repays only what disappeared when part of the findings is resolved', async () => {
    const integration = await setup();
    await runSync(deps(), (await newRun(db, integration.id)).id);
    issues = issues.slice(100); // 100 resolved in the source
    const t = performance.now();
    const result = await runSync(deps(), (await newRun(db, integration.id)).id);
    console.log(
      `[perf] import with 100 resolved findings: ${Math.round(performance.now() - t)} ms`,
    );
    expect(result).toMatchObject({ counts: { repaid: 100, created: 0, unchanged: N - 100 } });
    expect(await db.debtItem.count({ where: { status: 'repaid' } })).toBe(100);
    expect(await db.debtItem.count({ where: { status: 'open' } })).toBe(N - 100);
  });
});
