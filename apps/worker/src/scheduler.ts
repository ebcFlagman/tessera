import {
  SYNC_QUEUE,
  TICK_QUEUE,
  type JobQueue,
  type PrismaClient,
  type SyncJob,
} from '@tessera/db';
import { log } from './log';
import { runSync, type SyncDeps } from './jobs/sync-integration';

/** After this many postponements because of rate limits a run is given up. */
export const MAX_RATE_LIMIT_ATTEMPTS = 5;
const STALE_RUNNING_MS = 30 * 60_000;
const STALE_QUEUED_MS = 2 * 3600_000;

/**
 * Called every minute: enqueues an import for each integration whose interval has elapsed and
 * cleans up runs that were lost (worker crash, lost job).
 */
export async function tick(
  db: PrismaClient,
  queue: Pick<JobQueue, 'sendSync'>,
  now: Date = new Date(),
): Promise<{ enqueued: number; failedStale: number }> {
  const stale = await db.syncRun.updateMany({
    where: {
      OR: [
        { state: 'running', startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } },
        { state: 'queued', createdAt: { lt: new Date(now.getTime() - STALE_QUEUED_MS) } },
      ],
    },
    data: {
      state: 'failed',
      finishedAt: now,
      error: 'Der Import wurde abgebrochen (keine Rückmeldung des Workers)',
    },
  });

  const candidates = await db.integration.findMany({ where: { status: { not: 'disabled' } } });
  let enqueued = 0;
  for (const i of candidates) {
    const dueAt = i.lastAttemptAt ? i.lastAttemptAt.getTime() + i.scheduleMinutes * 60_000 : 0;
    if (dueAt > now.getTime()) continue;
    try {
      const run = await db.syncRun.create({ data: { integrationId: i.id, trigger: 'schedule' } });
      try {
        await queue.sendSync({ syncRunId: run.id, attempt: 0 });
        enqueued++;
      } catch (err) {
        await db.syncRun.update({
          where: { id: run.id },
          data: {
            state: 'failed',
            finishedAt: now,
            error: 'Der Import konnte nicht eingeplant werden',
          },
        });
        throw err;
      }
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') continue; // a run is already queued or running
      log.error('could not enqueue sync', {
        integrationId: i.id,
        error: String((err as Error).message),
      });
    }
  }
  return { enqueued, failedStale: stale.count };
}

/** One job: runs the import and, on rate limits, schedules a later retry instead of failing. */
export async function handleSyncJob(
  deps: SyncDeps,
  queue: Pick<JobQueue, 'sendSync'>,
  job: SyncJob,
) {
  const result = await runSync(deps, job.syncRunId);
  if (result.outcome !== 'rate_limited') return result;
  if (job.attempt + 1 >= MAX_RATE_LIMIT_ATTEMPTS) {
    await deps.db.syncRun.update({
      where: { id: job.syncRunId },
      data: {
        state: 'failed',
        finishedAt: new Date(),
        error: 'Die Quelle begrenzt die Anfragen dauerhaft; der Import wurde aufgegeben',
      },
    });
    return { outcome: 'failed' as const, error: 'rate limit' };
  }
  await queue.sendSync(
    { syncRunId: job.syncRunId, attempt: job.attempt + 1 },
    { startAfterSeconds: result.retryAfter },
  );
  return result;
}

export async function startWorker(deps: SyncDeps, queue: JobQueue) {
  await queue.boss.work<SyncJob>(SYNC_QUEUE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) await handleSyncJob(deps, queue, job.data);
  });
  await queue.boss.schedule(TICK_QUEUE, '* * * * *');
  await queue.boss.work(TICK_QUEUE, async () => {
    const r = await tick(deps.db, queue);
    if (r.enqueued || r.failedStale) log.info('tick', r);
  });
  log.info('worker ready');
}
