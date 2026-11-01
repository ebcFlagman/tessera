import type { Prisma, PrismaClient } from '@tessera/db';
import { ConnectorError, type ConnectorRegistry, type RawFinding } from '@tessera/connectors';
import {
  AppError,
  decryptSecret,
  fingerprintOf,
  reconcile,
  type DebtDraft,
  type ExistingDebt,
  type ExistingFinding,
  type Keyring,
} from '@tessera/domain';
import { log } from '../log';

export interface SyncDeps {
  db: PrismaClient;
  getConnector: ConnectorRegistry;
  keyring: Keyring;
  http: typeof fetch;
  /** hosts besides sonarcloud.io and gitlab.com that sources may use */
  allowedHosts?: string[];
  now?: () => Date;
}

export type SyncOutcome =
  | { outcome: 'succeeded'; counts: SyncCounts }
  | { outcome: 'failed'; error: string }
  | { outcome: 'rate_limited'; retryAfter: number }
  | { outcome: 'skipped' };

export interface SyncCounts {
  created: number;
  updated: number;
  repaid: number;
  reopened: number;
  unchanged: number;
  total: number;
}

const SOURCE_ORIGIN = {
  title: 'source',
  description: 'source',
  kind: 'source',
  effortEstimate: 'source',
};

/** Message that is safe to show to users and to store: never contains credentials. */
function safeMessage(err: unknown): string {
  if (err instanceof ConnectorError || err instanceof AppError) return err.message;
  return 'Unerwarteter Fehler beim Import';
}

/**
 * Executes one import run: fetch the complete listing, then apply it in a single transaction.
 * Any failure before the transaction leaves the existing data untouched (FR-013).
 */
export async function runSync(deps: SyncDeps, syncRunId: string): Promise<SyncOutcome> {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());
  const run = await db.syncRun.findUnique({
    where: { id: syncRunId },
    include: { integration: true },
  });
  if (!run || (run.state !== 'queued' && run.state !== 'running')) return { outcome: 'skipped' };
  const integration = run.integration;

  await db.syncRun.update({ where: { id: run.id }, data: { state: 'running', startedAt: now() } });
  await db.integration.update({ where: { id: integration.id }, data: { lastAttemptAt: now() } });

  try {
    const connector = deps.getConnector(integration.type);
    const config = connector.configSchema.parse(integration.config);
    const token = decryptSecret(integration.credentialsEncrypted, deps.keyring);
    const ctx = {
      config,
      credentials: token,
      http: deps.http,
      allowedHosts: deps.allowedHosts ?? [],
    };

    const listing: { externalId: string; draft: DebtDraft; raw: RawFinding }[] = [];
    for await (const page of connector.fetchFindings(ctx)) {
      for (const raw of page) {
        listing.push({ externalId: raw.externalId, draft: connector.mapToDebt(raw, config), raw });
      }
    }

    const counts = await db.$transaction(
      (tx) => applyListing(tx, integration.id, integration.productId, listing, now()),
      { timeout: 120_000, maxWait: 10_000 },
    );

    await db.syncRun.update({
      where: { id: run.id },
      data: {
        state: 'succeeded',
        finishedAt: now(),
        counts: counts as unknown as Prisma.InputJsonValue,
        error: null,
      },
    });
    await db.integration.update({
      where: { id: integration.id },
      data: { status: 'ok', lastSyncAt: now(), lastError: null },
    });
    await db.auditEntry.create({
      data: {
        action: 'integration.synced',
        targetType: 'integration',
        targetId: integration.id,
        details: { runId: run.id, ...counts },
      },
    });
    return { outcome: 'succeeded', counts };
  } catch (err) {
    if (err instanceof ConnectorError && err.kind === 'RateLimited') {
      // not a failure of the integration: go back to the queue, the caller schedules the retry
      await db.syncRun.update({
        where: { id: run.id },
        data: { state: 'queued', startedAt: null },
      });
      return { outcome: 'rate_limited', retryAfter: err.retryAfter ?? 60 };
    }
    const error = safeMessage(err);
    log.error('sync failed', {
      runId: run.id,
      integrationId: integration.id,
      kind: err instanceof ConnectorError ? err.kind : 'unexpected',
      error,
    });
    await db.syncRun.update({
      where: { id: run.id },
      data: { state: 'failed', finishedAt: now(), error },
    });
    await db.integration.update({
      where: { id: integration.id },
      data: { status: 'error', lastError: error },
    });
    return { outcome: 'failed', error };
  }
}

async function applyListing(
  tx: Prisma.TransactionClient,
  integrationId: string,
  productId: string,
  listing: { externalId: string; draft: DebtDraft; raw: RawFinding }[],
  now: Date,
): Promise<SyncCounts> {
  const findings = await tx.finding.findMany({ where: { integrationId } });
  const debtRows = await tx.debtItem.findMany({
    where: { id: { in: [...new Set(findings.map((f) => f.debtId))] } },
  });
  const debts = new Map<string, ExistingDebt>(
    debtRows.map((d) => [
      d.id,
      {
        id: d.id,
        status: d.status,
        fieldOrigin: d.fieldOrigin as Record<string, string>,
        title: d.title,
        description: d.description,
        kind: d.kind,
        effortEstimate: d.effortEstimate,
      },
    ]),
  );
  const existing: ExistingFinding[] = findings.map((f) => ({
    externalId: f.externalId,
    debtId: f.debtId,
    goneAt: f.goneAt,
    firstSeenAt: f.firstSeenAt,
    fingerprint: f.fingerprint,
  }));
  const byExternal = new Map(listing.map((l) => [l.externalId, l]));
  const storedFindings = new Map(findings.map((f) => [f.externalId, f]));

  const plan = reconcile({
    findings: existing,
    debts,
    incoming: listing.map(({ externalId, draft }) => ({ externalId, draft })),
  });

  for (const c of plan.create) {
    const item = byExternal.get(c.externalId)!;
    const debt = await tx.debtItem.create({
      data: {
        productId,
        title: c.draft.title,
        description: c.draft.description,
        kind: c.draft.kind,
        effortEstimate: c.draft.effortEstimate,
        fieldOrigin: SOURCE_ORIGIN,
        findings: {
          create: {
            integrationId,
            externalId: c.externalId,
            fingerprint: c.fingerprint,
            url: c.draft.url,
            raw: item.raw.payload as Prisma.InputJsonValue,
            firstSeenAt: now,
            lastSeenAt: now,
          },
        },
      },
    });
    await tx.debtEvent.create({
      data: {
        debtId: debt.id,
        actorId: null,
        type: 'imported',
        changes: { externalId: c.externalId },
      },
    });
  }

  for (const u of plan.update) {
    await tx.debtItem.update({ where: { id: u.debtId }, data: u.patch });
    await tx.debtEvent.create({
      data: {
        debtId: u.debtId,
        actorId: null,
        type: 'updated_by_source',
        changes: u.changes as Prisma.InputJsonValue,
      },
    });
  }

  for (const t of plan.touch) {
    const stored = storedFindings.get(t.externalId)!;
    const item = byExternal.get(t.externalId)!;
    await tx.finding.update({
      where: { id: stored.id },
      data: {
        fingerprint: t.fingerprint,
        url: item.draft.url,
        raw: item.raw.payload as Prisma.InputJsonValue,
        conflicts: t.conflicts as unknown as Prisma.InputJsonValue,
        lastSeenAt: now,
        goneAt: null,
      },
    });
  }

  if (plan.markGone.length > 0) {
    await tx.finding.updateMany({
      where: { integrationId, externalId: { in: plan.markGone } },
      data: { goneAt: now },
    });
  }

  for (const r of plan.repay) {
    await tx.debtItem.update({ where: { id: r.debtId }, data: { status: 'repaid' } });
    await tx.debtEvent.create({
      data: {
        debtId: r.debtId,
        actorId: null,
        type: 'repaid_by_source',
        changes: { status: { from: r.previousStatus, to: 'repaid' }, reason: 'in Quelle behoben' },
      },
    });
  }

  for (const r of plan.reopen) {
    await tx.debtItem.update({ where: { id: r.debtId }, data: { status: 'open' } });
    await tx.debtEvent.create({
      data: {
        debtId: r.debtId,
        actorId: null,
        type: 'reopened_by_source',
        changes: { status: { from: 'repaid', to: 'open' }, reason: 'in Quelle wieder aufgetaucht' },
      },
    });
  }

  return { ...plan.counts, total: listing.length };
}

export { fingerprintOf };
