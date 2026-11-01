import { ConnectorError, isHostAllowed, type ConnectorType } from '@tessera/connectors';
import type { Integration, Prisma, PrismaClient, SyncRun, User } from '@tessera/db';
import { AppError, decryptSecret, encryptSecret } from '@tessera/domain';
import { ZodError } from 'zod';
import { requireProductRole } from '../auth/authorize';
import type { Deps } from '../lib/deps';
import { writeAudit } from './audit';

export const toSyncRunDto = (r: SyncRun) => ({
  id: r.id,
  integrationId: r.integrationId,
  state: r.state,
  trigger: r.trigger,
  startedAt: r.startedAt?.toISOString() ?? null,
  finishedAt: r.finishedAt?.toISOString() ?? null,
  counts: r.counts as Record<string, number>,
  error: r.error,
  createdAt: r.createdAt.toISOString(),
});

/** Never includes credentials, only whether some are stored. */
export const toIntegrationDto = (i: Integration, latestRun: SyncRun | null = null) => ({
  id: i.id,
  productId: i.productId,
  type: i.type,
  name: i.name,
  config: i.config as Record<string, unknown>,
  scheduleMinutes: i.scheduleMinutes,
  status: i.status,
  hasCredentials: i.credentialsEncrypted.length > 0,
  lastAttemptAt: i.lastAttemptAt?.toISOString() ?? null,
  lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
  lastError: i.lastError,
  latestRun: latestRun ? toSyncRunDto(latestRun) : null,
  createdAt: i.createdAt.toISOString(),
});

async function latestRuns(db: PrismaClient, ids: string[]) {
  const runs = await db.syncRun.findMany({
    where: { integrationId: { in: ids } },
    orderBy: [{ integrationId: 'asc' }, { createdAt: 'desc' }],
    distinct: ['integrationId'],
  });
  return new Map(runs.map((r) => [r.integrationId, r]));
}

async function load(db: PrismaClient, id: string): Promise<Integration> {
  const integration = await db.integration.findUnique({ where: { id } });
  if (!integration) throw new AppError('not_found', 'Integration nicht gefunden');
  return integration;
}

function parseConfig(deps: Deps, type: ConnectorType, config: unknown): Record<string, unknown> {
  try {
    const parsed = deps.getConnector(type).configSchema.parse(config) as Record<string, unknown>;
    if (typeof parsed.baseUrl === 'string' && !isHostAllowed(parsed.baseUrl, deps.allowedHosts)) {
      throw new AppError(
        'validation_failed',
        'Diese Basis-URL ist nicht erlaubt. Ein Administrator des Systems muss den Host über SOURCE_ALLOWED_HOSTS freigeben.',
      );
    }
    return parsed;
  } catch (err) {
    if (err instanceof ZodError) {
      throw new AppError('validation_failed', 'Die Einstellungen der Quelle sind ungültig', {
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    throw err;
  }
}

export async function listIntegrations(db: PrismaClient, productId: string) {
  const rows = await db.integration.findMany({
    where: { productId },
    orderBy: { createdAt: 'asc' },
  });
  const runs = await latestRuns(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((i) => toIntegrationDto(i, runs.get(i.id) ?? null));
}

/** Integrations in error state of products the user administers (for the in-app notice). */
export async function listAttention(db: PrismaClient, user: User) {
  const rows = await db.integration.findMany({
    where: {
      status: 'error',
      product: { memberships: { some: { userId: user.id, role: 'admin' } }, archivedAt: null },
    },
    orderBy: { createdAt: 'asc' },
  });
  const runs = await latestRuns(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((i) => toIntegrationDto(i, runs.get(i.id) ?? null));
}

export async function createIntegration(
  deps: Deps,
  user: User,
  productId: string,
  input: {
    type: ConnectorType;
    name: string;
    config: Record<string, unknown>;
    credentials: string;
    scheduleMinutes?: number | undefined;
  },
) {
  const { db } = deps;
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('not_found', 'Produkt nicht gefunden');
  await requireProductRole(db, user, productId, 'admin');
  if (product.archivedAt) throw new AppError('conflict', 'Das Produkt ist archiviert');
  const config = parseConfig(deps, input.type, input.config);

  return db.$transaction(async (tx) => {
    const created = await tx.integration.create({
      data: {
        productId,
        type: input.type,
        name: input.name,
        config: config as Prisma.InputJsonValue,
        credentialsEncrypted: encryptSecret(input.credentials, deps.getKeyring()),
        ...(input.scheduleMinutes ? { scheduleMinutes: input.scheduleMinutes } : {}),
      },
    });
    await writeAudit(tx, {
      actorId: user.id,
      action: 'integration.created',
      targetType: 'integration',
      targetId: created.id,
      details: { type: created.type, name: created.name, productId },
    });
    return created;
  });
}

export async function updateIntegration(
  deps: Deps,
  user: User,
  id: string,
  patch: {
    name?: string | undefined;
    config?: Record<string, unknown> | undefined;
    credentials?: string | undefined;
    scheduleMinutes?: number | undefined;
    disabled?: boolean | undefined;
  },
) {
  const { db } = deps;
  const current = await load(db, id);
  await requireProductRole(db, user, current.productId, 'admin');

  const data: Prisma.IntegrationUpdateInput = {};
  const fields: string[] = [];
  if (patch.name !== undefined) {
    data.name = patch.name;
    fields.push('name');
  }
  if (patch.config !== undefined) {
    data.config = parseConfig(deps, current.type, patch.config) as Prisma.InputJsonValue;
    fields.push('config');
  }
  if (patch.credentials !== undefined) {
    data.credentialsEncrypted = encryptSecret(patch.credentials, deps.getKeyring());
    fields.push('credentials'); // the value itself is never recorded
  }
  if (patch.scheduleMinutes !== undefined) {
    data.scheduleMinutes = patch.scheduleMinutes;
    fields.push('scheduleMinutes');
  }
  if (patch.disabled !== undefined) {
    data.status = patch.disabled ? 'disabled' : 'ok';
    fields.push(patch.disabled ? 'disabled' : 'enabled');
  }
  // changed settings should be tried again soon rather than after the old interval
  if (patch.config !== undefined || patch.credentials !== undefined) data.lastAttemptAt = null;
  if (fields.length === 0) return current;

  return db.$transaction(async (tx) => {
    const updated = await tx.integration.update({ where: { id }, data });
    await writeAudit(tx, {
      actorId: user.id,
      action: 'integration.updated',
      targetType: 'integration',
      targetId: id,
      details: { fields },
    });
    return updated;
  });
}

/** Disconnects the source. Imported debts stay; they just lose their source reference. */
export async function deleteIntegration(db: PrismaClient, user: User, id: string) {
  const current = await load(db, id);
  await requireProductRole(db, user, current.productId, 'admin');
  await db.$transaction(async (tx) => {
    await tx.integration.delete({ where: { id } });
    await writeAudit(tx, {
      actorId: user.id,
      action: 'integration.deleted',
      targetType: 'integration',
      targetId: id,
      details: { type: current.type, name: current.name, productId: current.productId },
    });
  });
}

export async function testIntegration(deps: Deps, user: User, id: string) {
  const current = await load(deps.db, id);
  await requireProductRole(deps.db, user, current.productId, 'admin');
  const connector = deps.getConnector(current.type);
  try {
    const config = connector.configSchema.parse(current.config);
    const credentials = decryptSecret(current.credentialsEncrypted, deps.getKeyring());
    return await connector.testConnection({
      config,
      credentials,
      http: deps.http,
      allowedHosts: deps.allowedHosts,
    });
  } catch (err) {
    if (err instanceof ConnectorError) return { ok: false, message: err.message };
    if (err instanceof ZodError)
      return { ok: false, message: 'Die Einstellungen der Quelle sind ungültig' };
    if (err instanceof AppError) return { ok: false, message: err.message };
    return { ok: false, message: 'Die Verbindung konnte nicht geprüft werden' };
  }
}

/** Starts an import. A second request while one is queued or running returns that run. */
export async function requestSync(deps: Deps, user: User, id: string) {
  const { db } = deps;
  const current = await load(db, id);
  await requireProductRole(db, user, current.productId, 'admin');
  if (current.status === 'disabled') {
    throw new AppError('conflict', 'Die Integration ist deaktiviert');
  }

  let run: SyncRun;
  try {
    run = await db.syncRun.create({
      data: { integrationId: id, trigger: 'manual', requestedBy: user.id },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      const active = await db.syncRun.findFirst({
        where: { integrationId: id, state: { in: ['queued', 'running'] } },
      });
      if (active) return active;
    }
    throw err;
  }
  try {
    const queue = await deps.getQueue();
    await queue.sendSync({ syncRunId: run.id, attempt: 0 });
  } catch {
    await db.syncRun.update({
      where: { id: run.id },
      data: {
        state: 'failed',
        finishedAt: new Date(),
        error: 'Der Import konnte nicht eingeplant werden',
      },
    });
    throw new AppError('internal', 'Der Import konnte nicht eingeplant werden');
  }
  await writeAudit(db, {
    actorId: user.id,
    action: 'integration.sync-requested',
    targetType: 'integration',
    targetId: id,
    details: { runId: run.id },
  });
  return run;
}

export async function getSyncRun(db: PrismaClient, id: string) {
  const run = await db.syncRun.findUnique({ where: { id } });
  if (!run) throw new AppError('not_found', 'Importlauf nicht gefunden');
  return run;
}

export async function listSyncRuns(db: PrismaClient, integrationId: string, limit = 10) {
  await load(db, integrationId);
  return db.syncRun.findMany({
    where: { integrationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
