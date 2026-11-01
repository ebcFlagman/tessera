import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError } from '@tessera/connectors';
import { createJobQueue, SNAPSHOT_QUEUE, SYNC_QUEUE, type SyncJob } from '@tessera/db';
import { MAX_RATE_LIMIT_ATTEMPTS, handleSyncJob, startWorker, tick } from '../src/scheduler';
import {
  FakeSource,
  database,
  draft,
  makeDeps,
  newRun,
  resetDb,
  setupIntegration,
} from './helpers';

const db = database();
const sent: { job: SyncJob; startAfterSeconds?: number }[] = [];
const queue = {
  sendSync: async (job: SyncJob, opts?: { startAfterSeconds?: number }) => {
    sent.push({
      job,
      ...(opts?.startAfterSeconds ? { startAfterSeconds: opts.startAfterSeconds } : {}),
    });
  },
};
// relative to the real clock: runs are created with the database clock
const T0 = new Date();
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

beforeEach(async () => {
  await resetDb(db);
  sent.length = 0;
});
afterAll(() => db.$disconnect());

describe('tick (schedule)', () => {
  it('enqueues a new integration at once and then waits for the interval', async () => {
    const { integration } = await setupIntegration(db, { scheduleMinutes: 60 });
    expect((await tick(db, queue, T0)).enqueued).toBe(1);
    expect(sent).toHaveLength(1);
    await db.syncRun.updateMany({ data: { state: 'succeeded' } });
    await db.integration.update({ where: { id: integration.id }, data: { lastAttemptAt: T0 } });

    expect((await tick(db, queue, minutes(30))).enqueued).toBe(0);
    expect((await tick(db, queue, minutes(61))).enqueued).toBe(1);
  });

  it('backs off after a failure: the interval counts from the last attempt, not the last success', async () => {
    const { integration } = await setupIntegration(db, { scheduleMinutes: 60 });
    await db.integration.update({
      where: { id: integration.id },
      data: { status: 'error', lastError: 'x', lastAttemptAt: T0, lastSyncAt: null },
    });
    expect((await tick(db, queue, minutes(5))).enqueued).toBe(0);
    expect((await tick(db, queue, minutes(60))).enqueued).toBe(1);
  });

  it('never queues a second run while one is active, and skips disabled integrations', async () => {
    const { integration } = await setupIntegration(db);
    await tick(db, queue, T0);
    expect((await tick(db, queue, minutes(120))).enqueued).toBe(0); // first run still queued
    await db.syncRun.deleteMany();
    await db.integration.update({ where: { id: integration.id }, data: { status: 'disabled' } });
    expect((await tick(db, queue, minutes(500))).enqueued).toBe(0);
  });

  it('gives up runs that were lost (worker crash or lost job) so the schedule can continue', async () => {
    const { integration } = await setupIntegration(db);
    const run = await newRun(db, integration.id);
    await db.syncRun.update({
      where: { id: run.id },
      data: { state: 'running', startedAt: new Date(T0.getTime() - 45 * 60_000) },
    });
    const r = await tick(db, queue, T0);
    expect(r.failedStale).toBe(1);
    expect(await db.syncRun.findUnique({ where: { id: run.id } })).toMatchObject({
      state: 'failed',
    });
  });

  it('marks a run failed when it cannot be queued, so nothing stays blocked', async () => {
    await setupIntegration(db);
    const broken = { sendSync: vi.fn().mockRejectedValue(new Error('queue down')) };
    await tick(db, broken, T0);
    const runs = await db.syncRun.findMany();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.state).toBe('failed');
  });
});

describe('rate limits', () => {
  it('postpones the run by retryAfter and gives up after the maximum number of attempts', async () => {
    const { integration } = await setupIntegration(db);
    const source = new FakeSource();
    source.error = new ConnectorError('RateLimited', 'begrenzt', 90);
    const run = await newRun(db, integration.id);

    await handleSyncJob(makeDeps(db, source), queue, { syncRunId: run.id, attempt: 0 });
    expect(sent).toEqual([{ job: { syncRunId: run.id, attempt: 1 }, startAfterSeconds: 90 }]);
    expect((await db.syncRun.findUnique({ where: { id: run.id } }))?.state).toBe('queued');
    expect((await db.integration.findUnique({ where: { id: integration.id } }))?.status).toBe('ok');

    sent.length = 0;
    await handleSyncJob(makeDeps(db, source), queue, {
      syncRunId: run.id,
      attempt: MAX_RATE_LIMIT_ATTEMPTS - 1,
    });
    expect(sent).toHaveLength(0);
    expect(await db.syncRun.findUnique({ where: { id: run.id } })).toMatchObject({
      state: 'failed',
    });
  });
});

describe('snapshot job through the real queue', () => {
  it('start-up creates the snapshot of today and a job sent to the snapshot queue writes one', async () => {
    const { product } = await setupIntegration(db);
    await db.debtItem.create({ data: { productId: product.id, title: 'x', kind: 'technical' } });
    await db.$executeRawUnsafe('TRUNCATE TABLE metric_snapshot');

    const real = await createJobQueue(process.env.DATABASE_URL!, 3);
    try {
      await startWorker(makeDeps(db, new FakeSource()), real);
      expect(await db.metricSnapshot.count()).toBeGreaterThan(0); // written at start-up
      await db.$executeRawUnsafe('TRUNCATE TABLE metric_snapshot');
      await real.boss.send(SNAPSHOT_QUEUE, {});
      await vi.waitFor(async () => expect(await db.metricSnapshot.count()).toBeGreaterThan(0), {
        timeout: 20_000,
        interval: 250,
      });
    } finally {
      await real.boss.offWork(SNAPSHOT_QUEUE).catch(() => undefined);
      await real.boss.offWork(SYNC_QUEUE).catch(() => undefined);
      await real.stop();
    }
  });
});

describe('queue round trip (pg-boss on PostgreSQL)', () => {
  it('a job sent through the real queue is picked up by the worker and imported', async () => {
    const { integration } = await setupIntegration(db);
    const source = new FakeSource();
    source.listing = [{ externalId: 'issue:A', draft: draft('A') }];
    const run = await newRun(db, integration.id);

    const real = await createJobQueue(process.env.DATABASE_URL!, 3);
    try {
      await startWorker(makeDeps(db, source), real);
      await real.sendSync({ syncRunId: run.id, attempt: 0 });
      await vi.waitFor(
        async () => {
          expect((await db.syncRun.findUnique({ where: { id: run.id } }))?.state).toBe('succeeded');
        },
        { timeout: 20_000, interval: 250 },
      );
      expect(await db.debtItem.count()).toBe(1);
    } finally {
      await real.boss.offWork(SYNC_QUEUE).catch(() => undefined);
      await real.stop();
    }
  });
});
