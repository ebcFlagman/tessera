import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { decryptSecret } from '@tessera/domain';
import {
  getAttention,
  getProductIntegrations,
  getRun,
  getRuns,
  patchIntegration,
  postProductIntegration,
  postSync,
  postTest,
  removeIntegration,
} from '../../src/routes/integrations';
import { listDebts } from '../../src/routes/debts';
import {
  call,
  resetDb,
  seedUserWithRole,
  sentJobs,
  testKeyring,
  useTestDeps,
} from '../helpers/app';
import { assertMatchesContract } from './setup';

const TOKEN = 'sqp_super_secret_token_123';
let httpStatus = 200;
let httpBody: unknown = { paging: { total: 7 } };
const http = (async () =>
  new Response(JSON.stringify(httpBody), {
    status: httpStatus,
    headers: { 'content-type': 'application/json' },
  })) as typeof fetch;

const db = useTestDeps({ http });
let productId = '';
const json = (body: unknown, method: string) => ({ method, body: JSON.stringify(body) });
const valid = {
  type: 'sonarcloud',
  name: 'Sonar Plattform',
  config: { projectKey: 'acme_platform' },
  credentials: TOKEN,
};

async function create(subject = 'admin', body: unknown = valid) {
  return call(
    postProductIntegration,
    `/products/${productId}/integrations`,
    subject,
    json(body, 'POST'),
    { id: productId },
  );
}

beforeEach(async () => {
  await resetDb(db);
  sentJobs.length = 0;
  httpStatus = 200;
  httpBody = { paging: { total: 7 } };
  const p = await db.product.create({ data: { name: 'Plattform' } });
  productId = p.id;
  await seedUserWithRole(db, 'admin', p.id, 'admin');
  await seedUserWithRole(db, 'editor', p.id, 'editor');
  await seedUserWithRole(db, 'reader', null, null);
});
afterAll(() => db.$disconnect());

describe('integrations API', () => {
  it('creates an integration and never exposes or leaks the credentials', async () => {
    const res = await create();
    expect(res.status).toBe(201);
    const text = await res.text();
    expect(text).not.toContain(TOKEN);
    const body = JSON.parse(text);
    expect(body).toMatchObject({
      hasCredentials: true,
      status: 'ok',
      scheduleMinutes: 60,
      config: { projectKey: 'acme_platform' },
    });
    expect(body).not.toHaveProperty('credentials');
    assertMatchesContract('post', '/products/{id}/integrations', 201, body);

    const stored = await db.integration.findUniqueOrThrow({ where: { id: body.id } });
    expect(stored.credentialsEncrypted).not.toContain(TOKEN);
    expect(decryptSecret(stored.credentialsEncrypted, testKeyring)).toBe(TOKEN);
    const audit = JSON.stringify(await db.auditEntry.findMany());
    expect(audit).toContain('integration.created');
    expect(audit).not.toContain(TOKEN);

    const list = await call(
      getProductIntegrations,
      `/products/${productId}/integrations`,
      'reader',
      {},
      { id: productId },
    );
    const listText = await list.text();
    expect(listText).not.toContain(TOKEN);
    assertMatchesContract('get', '/products/{id}/integrations', 200, JSON.parse(listText));
  });

  it('validates the source settings (422) and only lets product admins connect (403)', async () => {
    const bad = await create('admin', { ...valid, config: {} });
    expect(bad.status).toBe(422);
    const badBody = await bad.json();
    expect(badBody.code).toBe('validation_failed');
    assertMatchesContract('post', '/products/{id}/integrations', 422, badBody);
    expect((await create('editor')).status).toBe(403);
    expect((await create('reader')).status).toBe(403);
    expect(await db.integration.count()).toBe(0);
  });

  it('refuses source addresses that are not allowed (SSRF) until the host is granted', async () => {
    const internal = await create('admin', {
      ...valid,
      config: { projectKey: 'x', baseUrl: 'http://169.254.169.254/latest' },
    });
    expect(internal.status).toBe(422);
    expect((await internal.json()).message).toMatch(/nicht erlaubt/);
    expect(await db.integration.count()).toBe(0);

    useTestDeps({ http, allowedHosts: ['sonar.intern.example'] });
    const granted = await create('admin', {
      ...valid,
      config: { projectKey: 'x', baseUrl: 'https://sonar.intern.example' },
    });
    expect(granted.status).toBe(201);
    useTestDeps({ http });
  });

  it('PATCH changes schedule and credentials; the audit records the fields but not the values', async () => {
    const created = await (await create()).json();
    const res = await call(
      patchIntegration,
      `/integrations/${created.id}`,
      'admin',
      json({ scheduleMinutes: 30, credentials: 'neues-geheimnis-999' }, 'PATCH'),
      { id: created.id },
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('neues-geheimnis-999');
    expect(JSON.parse(text).scheduleMinutes).toBe(30);
    assertMatchesContract('patch', '/integrations/{id}', 200, JSON.parse(text));
    const audit = await db.auditEntry.findFirstOrThrow({
      where: { action: 'integration.updated' },
    });
    expect((audit.details as { fields: string[] }).fields.sort()).toEqual([
      'credentials',
      'scheduleMinutes',
    ]);
    expect(JSON.stringify(await db.auditEntry.findMany())).not.toContain('neues-geheimnis-999');

    const tooOften = await call(
      patchIntegration,
      `/integrations/${created.id}`,
      'admin',
      json({ scheduleMinutes: 1 }, 'PATCH'),
      { id: created.id },
    );
    expect(tooOften.status).toBe(422);
    const denied = await call(
      patchIntegration,
      `/integrations/${created.id}`,
      'editor',
      json({ scheduleMinutes: 30 }, 'PATCH'),
      { id: created.id },
    );
    expect(denied.status).toBe(403);
  });

  it('POST /test reports success and readable failures without the token', async () => {
    const created = await (await create()).json();
    const ok = await call(
      postTest,
      `/integrations/${created.id}/test`,
      'admin',
      { method: 'POST' },
      { id: created.id },
    );
    expect(ok.status).toBe(200);
    const okBody = await ok.json();
    expect(okBody).toMatchObject({ ok: true });
    assertMatchesContract('post', '/integrations/{id}/test', 200, okBody);

    httpStatus = 401;
    const bad = await call(
      postTest,
      `/integrations/${created.id}/test`,
      'admin',
      { method: 'POST' },
      { id: created.id },
    );
    const text = await bad.text();
    expect(JSON.parse(text)).toMatchObject({ ok: false });
    expect(JSON.parse(text).message).toMatch(/Zugangsdaten/);
    expect(text).not.toContain(TOKEN);
  });

  it('POST /sync answers 202 with a queued run, enqueues a job, and reuses an active run', async () => {
    const created = await (await create()).json();
    const first = await call(
      postSync,
      `/integrations/${created.id}/sync`,
      'admin',
      { method: 'POST' },
      { id: created.id },
    );
    expect(first.status).toBe(202);
    const run = await first.json();
    expect(run).toMatchObject({ state: 'queued', trigger: 'manual', integrationId: created.id });
    assertMatchesContract('post', '/integrations/{id}/sync', 202, run);
    expect(sentJobs).toEqual([{ syncRunId: run.id, attempt: 0 }]);

    const second = await (
      await call(
        postSync,
        `/integrations/${created.id}/sync`,
        'admin',
        { method: 'POST' },
        { id: created.id },
      )
    ).json();
    expect(second.id).toBe(run.id); // no second run while one is active
    expect(sentJobs).toHaveLength(1);
    expect(await db.syncRun.count()).toBe(1);

    const status = await call(getRun, `/sync-runs/${run.id}`, 'reader', {}, { id: run.id });
    expect(status.status).toBe(200);
    assertMatchesContract('get', '/sync-runs/{id}', 200, await status.json());
    const runs = await call(
      getRuns,
      `/integrations/${created.id}/sync-runs`,
      'reader',
      {},
      { id: created.id },
    );
    assertMatchesContract('get', '/integrations/{id}/sync-runs', 200, await runs.json());

    expect(
      (
        await call(
          postSync,
          `/integrations/${created.id}/sync`,
          'editor',
          { method: 'POST' },
          { id: created.id },
        )
      ).status,
    ).toBe(403);
  });

  it('refuses to sync a disabled integration (409) and fails the run when queueing is impossible', async () => {
    const created = await (await create()).json();
    await call(
      patchIntegration,
      `/integrations/${created.id}`,
      'admin',
      json({ disabled: true }, 'PATCH'),
      { id: created.id },
    );
    const res = await call(
      postSync,
      `/integrations/${created.id}/sync`,
      'admin',
      { method: 'POST' },
      { id: created.id },
    );
    expect(res.status).toBe(409);
    await call(
      patchIntegration,
      `/integrations/${created.id}`,
      'admin',
      json({ disabled: false }, 'PATCH'),
      { id: created.id },
    );

    useTestDeps({
      http,
      getQueue: async () => ({
        sendSync: async () => {
          throw new Error('queue down');
        },
      }),
    });
    const failing = await call(
      postSync,
      `/integrations/${created.id}/sync`,
      'admin',
      { method: 'POST' },
      { id: created.id },
    );
    expect(failing.status).toBe(500);
    expect((await db.syncRun.findFirstOrThrow()).state).toBe('failed'); // nothing stays blocked
    useTestDeps({ http });
  });

  it('GET /integrations?status=error lists failing integrations of administered products only', async () => {
    const created = await (await create()).json();
    await db.integration.update({
      where: { id: created.id },
      data: { status: 'error', lastError: 'SonarCloud lehnt die Zugangsdaten ab' },
    });
    const asAdmin = await (await call(getAttention, '/integrations?status=error', 'admin')).json();
    expect(asAdmin).toHaveLength(1);
    expect(asAdmin[0].lastError).toMatch(/Zugangsdaten/);
    assertMatchesContract('get', '/integrations', 200, asAdmin);
    expect(await (await call(getAttention, '/integrations?status=error', 'editor')).json()).toEqual(
      [],
    );
    expect(await (await call(getAttention, '/integrations?status=error', 'reader')).json()).toEqual(
      [],
    );
  });

  it('DELETE disconnects the source but keeps imported debts', async () => {
    const created = await (await create()).json();
    const debt = await db.debtItem.create({
      data: { productId, title: 'importiert', kind: 'technical' },
    });
    await db.finding.create({
      data: {
        integrationId: created.id,
        externalId: 'issue:1',
        debtId: debt.id,
        fingerprint: 'x',
        raw: {},
      },
    });
    const res = await call(
      removeIntegration,
      `/integrations/${created.id}`,
      'admin',
      { method: 'DELETE' },
      { id: created.id },
    );
    expect(res.status).toBe(204);
    expect(await db.integration.count()).toBe(0);
    expect(await db.finding.count()).toBe(0);
    expect(await db.debtItem.count()).toBe(1);
    expect(
      (
        await call(
          removeIntegration,
          `/integrations/${created.id}`,
          'admin',
          { method: 'DELETE' },
          { id: created.id },
        )
      ).status,
    ).toBe(404);
  });

  it('the register shows the source of imported debts and filters by source', async () => {
    const created = await (await create()).json();
    const imported = await db.debtItem.create({
      data: { productId, title: 'importiert', kind: 'technical' },
    });
    await db.debtItem.create({ data: { productId, title: 'manuell', kind: 'technical' } });
    await db.finding.create({
      data: {
        integrationId: created.id,
        externalId: 'issue:42',
        debtId: imported.id,
        fingerprint: 'x',
        raw: {},
        url: 'https://sonarcloud.io/x',
        conflicts: [{ field: 'title', sourceValue: 'andere' }],
      },
    });

    const all = await (await call(listDebts, '/debts', 'reader')).json();
    const src = all.items.find((i: { title: string }) => i.title === 'importiert').source;
    expect(src).toMatchObject({
      type: 'sonarcloud',
      externalId: 'issue:42',
      url: 'https://sonarcloud.io/x',
      gone: false,
      findingCount: 1,
    });
    expect(src.conflicts).toEqual([{ field: 'title', sourceValue: 'andere' }]);
    assertMatchesContract('get', '/debts', 200, all);

    const titles = async (q: string) =>
      (await (await call(listDebts, `/debts?source=${q}`, 'reader')).json()).items.map(
        (i: { title: string }) => i.title,
      );
    expect(await titles('sonarcloud')).toEqual(['importiert']);
    expect(await titles('gitlab')).toEqual([]);
    expect(await titles('manual')).toEqual(['manuell']);
  });
});
