import { randomBytes } from 'node:crypto';
import { getDb, type PrismaClient } from '@tessera/db';
import {
  ConnectorError,
  type Connector,
  type ConnectorContext,
  type RawFinding,
} from '@tessera/connectors';
import { encryptSecret, loadKeyring, type DebtDraft } from '@tessera/domain';
import type { SyncDeps } from '../src/jobs/sync-integration';

export const keyring = loadKeyring({ CREDENTIALS_KEY: randomBytes(32).toString('base64') });
export const TOKEN = 'plain-text-token-1234';

export const draft = (title: string, over: Partial<DebtDraft> = {}): DebtDraft => ({
  title,
  description: `Beschreibung ${title}`,
  kind: 'technical',
  effortEstimate: 1,
  url: `https://src.example/${encodeURIComponent(title)}`,
  ...over,
});

/** Scriptable connector: tests set what the "source" currently lists or which error it raises. */
export class FakeSource {
  listing: { externalId: string; draft: DebtDraft }[] = [];
  error: ConnectorError | undefined;
  /** raise the error after the first page */
  failAfterFirstPage = false;
  seenCredentials: string[] = [];

  connector: Connector<unknown> = {
    type: 'sonarcloud',
    configSchema: { parse: (c: unknown) => c } as never,
    testConnection: async () => ({ ok: true, message: 'ok' }),
    fetchFindings: (ctx: ConnectorContext) => this.fetch(ctx),
    mapToDebt: (f: RawFinding) => this.listing.find((l) => l.externalId === f.externalId)!.draft,
  };

  private async *fetch(ctx: ConnectorContext): AsyncIterable<RawFinding[]> {
    this.seenCredentials.push(ctx.credentials);
    if (this.error && !this.failAfterFirstPage) throw this.error;
    const raws = this.listing.map((l) => ({
      externalId: l.externalId,
      payload: { id: l.externalId },
    }));
    const half = Math.ceil(raws.length / 2);
    if (raws.slice(0, half).length) yield raws.slice(0, half);
    if (this.error) throw this.error;
    if (raws.slice(half).length) yield raws.slice(half);
  }
}

export function makeDeps(db: PrismaClient, source: FakeSource, now?: () => Date): SyncDeps {
  return {
    db,
    getConnector: () => source.connector,
    keyring,
    http: fetch,
    ...(now ? { now } : {}),
  };
}

export const database = () => getDb();

export async function setupIntegration(db: PrismaClient, over: { scheduleMinutes?: number } = {}) {
  const product = await db.product.create({
    data: { name: `P-${Math.random().toString(36).slice(2)}` },
  });
  const integration = await db.integration.create({
    data: {
      productId: product.id,
      type: 'sonarcloud',
      name: 'Test',
      config: { projectKey: 'demo' },
      credentialsEncrypted: encryptSecret(TOKEN, keyring),
      ...(over.scheduleMinutes ? { scheduleMinutes: over.scheduleMinutes } : {}),
    },
  });
  return { product, integration };
}

export async function newRun(db: PrismaClient, integrationId: string) {
  return db.syncRun.create({ data: { integrationId, trigger: 'manual' } });
}

export async function resetDb(db: PrismaClient) {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE finding, sync_run, integration, assessment, assessment_model, debt_event, debt_item, audit_entry, membership, team_member, team, product, app_user RESTART IDENTITY CASCADE',
  );
}
