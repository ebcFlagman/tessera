import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuditLog } from '../../src/routes/admin';
import {
  getAttention,
  getProductIntegrations,
  getRun,
  patchIntegration,
  postProductIntegration,
  postSync,
  postTest,
  removeIntegration,
} from '../../src/routes/integrations';
import { call, resetDb, seedUserWithRole, useTestDeps } from '../helpers/app';

/**
 * T111 / constitution IV: a credential must not appear in any response, log line or stored row
 * except its encrypted column. The test pushes secrets through every path that touches them,
 * including paths where a library error message would contain the secret.
 */
const SECRET = 'sqp_PLAINTEXT_SECRET_0123456789';
const ROTATED = 'sqp_ROTATED_SECRET_9876543210';
const LEAKY = 'sqp_LEAKED_VIA_ERROR_MESSAGE_42';

let httpMode: 'ok' | 'unauthorized' | 'throws' = 'ok';
const http = (async () => {
  if (httpMode === 'throws') throw new Error(`socket hang up while sending ${LEAKY}`);
  return new Response(JSON.stringify({ paging: { total: 1 } }), {
    status: httpMode === 'unauthorized' ? 401 : 200,
    headers: { 'content-type': 'application/json' },
  });
}) as typeof fetch;

let queueFails = false;
const db = useTestDeps({
  http,
  getQueue: async () => ({
    sendSync: async () => {
      if (queueFails) throw new Error(`redis refused connection for ${LEAKY}`);
    },
  }),
});

const seen: string[] = [];
const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
  vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
    seen.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  }),
);
let productId = '';
const json = (body: unknown, method: string) => ({ method, body: JSON.stringify(body) });

/** Every response body goes through here so nothing is forgotten. */
async function text(res: Response): Promise<string> {
  const t = await res.text();
  seen.push(t);
  return t;
}

beforeEach(async () => {
  await resetDb(db);
  seen.length = 0;
  httpMode = 'ok';
  queueFails = false;
  productId = (await db.product.create({ data: { name: 'Plattform' } })).id;
  await seedUserWithRole(db, 'admin', productId, 'admin');
});
afterEach(() => spies.forEach((s) => s.mockClear()));
afterAll(() => {
  spies.forEach((s) => s.mockRestore());
  return db.$disconnect();
});

describe('credentials never leave the encrypted column', () => {
  it('not in responses, logs, audit or stored rows over the whole life of an integration', async () => {
    const created = JSON.parse(
      await text(
        await call(
          postProductIntegration,
          `/products/${productId}/integrations`,
          'admin',
          json(
            { type: 'sonarcloud', name: 'Sonar', config: { projectKey: 'p' }, credentials: SECRET },
            'POST',
          ),
          { id: productId },
        ),
      ),
    );
    const id = created.id as string;
    const p = { id };

    await text(
      await call(
        getProductIntegrations,
        `/products/${productId}/integrations`,
        'admin',
        {},
        { id: productId },
      ),
    );
    await text(
      await call(
        patchIntegration,
        `/integrations/${id}`,
        'admin',
        json({ credentials: ROTATED }, 'PATCH'),
        p,
      ),
    );

    // a test against a source that rejects the token, and one whose network error mentions a secret
    httpMode = 'unauthorized';
    await text(await call(postTest, `/integrations/${id}/test`, 'admin', { method: 'POST' }, p));
    httpMode = 'throws';
    const leaky = await text(
      await call(postTest, `/integrations/${id}/test`, 'admin', { method: 'POST' }, p),
    );
    expect(JSON.parse(leaky)).toMatchObject({
      ok: false,
      message: expect.stringContaining('nicht erreichbar'),
    });

    // an import that cannot be queued, because the queue's error message contains a secret
    queueFails = true;
    const failing = await call(
      postSync,
      `/integrations/${id}/sync`,
      'admin',
      { method: 'POST' },
      p,
    );
    expect(failing.status).toBe(500);
    await text(failing);
    queueFails = false;
    const run = await db.syncRun.findFirstOrThrow();
    await text(await call(getRun, `/sync-runs/${run.id}`, 'admin', {}, { id: run.id }));
    await db.integration.update({
      where: { id },
      data: { status: 'error', lastError: 'SonarCloud lehnt die Zugangsdaten ab' },
    });
    await text(await call(getAttention, '/integrations?status=error', 'admin'));

    // the change log, read through the API like an auditor would
    await text(await call(getAuditLog, '/audit-log?limit=200', 'admin'));
    await text(
      await call(removeIntegration, `/integrations/${id}`, 'admin', { method: 'DELETE' }, p),
    );
    await text(await call(getAuditLog, '/audit-log?limit=200', 'admin'));

    const everything = [
      ...seen,
      // all stored rows; the encrypted credentials only count while the integration exists, so check it before too
      JSON.stringify(await db.auditEntry.findMany()),
      JSON.stringify(await db.syncRun.findMany()),
      JSON.stringify(await db.debtEvent.findMany()),
      JSON.stringify(await db.integration.findMany()),
    ].join('\n');

    for (const secret of [SECRET, ROTATED, LEAKY]) {
      expect(everything, `"${secret}" must not appear anywhere`).not.toContain(secret);
    }
    expect(seen.length).toBeGreaterThan(5); // the spies really captured something
  });

  it('the stored value is encrypted: the column holds ciphertext, not the secret', async () => {
    await call(
      postProductIntegration,
      `/products/${productId}/integrations`,
      'admin',
      json({ type: 'gitlab', name: 'GL', config: { projectId: '1' }, credentials: SECRET }, 'POST'),
      { id: productId },
    );
    const row = await db.integration.findFirstOrThrow();
    expect(row.credentialsEncrypted).toMatch(/^v1\./);
    expect(row.credentialsEncrypted).not.toContain(SECRET);
    // not even in a raw dump of the table
    const raw = JSON.stringify(await db.$queryRawUnsafe('SELECT * FROM integration'));
    expect(raw).not.toContain(SECRET);
  });

  it('unauthenticated and forbidden callers learn nothing about credentials either', async () => {
    const created = JSON.parse(
      await text(
        await call(
          postProductIntegration,
          `/products/${productId}/integrations`,
          'admin',
          json(
            { type: 'sonarcloud', name: 'S', config: { projectKey: 'p' }, credentials: SECRET },
            'POST',
          ),
          { id: productId },
        ),
      ),
    );
    await seedUserWithRole(db, 'outsider', null, null);
    const denied = await text(
      await call(
        patchIntegration,
        `/integrations/${created.id}`,
        'outsider',
        json({ credentials: LEAKY }, 'PATCH'),
        { id: created.id },
      ),
    );
    expect(denied).not.toContain(SECRET);
    expect(denied).not.toContain(LEAKY);
    const stored = (await db.integration.findFirstOrThrow()).credentialsEncrypted;
    expect(stored).toMatch(/^v1\./); // the refused change did not replace the credentials
  });
});
