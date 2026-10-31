import PgBoss from 'pg-boss';

export const SYNC_QUEUE = 'tessera-sync';
export const TICK_QUEUE = 'tessera-tick';

export interface SyncJob {
  syncRunId: string;
  /** how often this run was already postponed because of rate limits */
  attempt: number;
}

export interface JobQueue {
  boss: PgBoss;
  sendSync(job: SyncJob, opts?: { startAfterSeconds?: number }): Promise<void>;
  stop(): Promise<void>;
}

/** pg-boss on the application database (constitution VI): no extra infrastructure. */
export async function createJobQueue(connectionString: string, max = 4): Promise<JobQueue> {
  const boss = new PgBoss({ connectionString, schema: 'pgboss', max });
  boss.on('error', (err) =>
    console.error(JSON.stringify({ level: 'error', message: 'pg-boss', error: err.message })),
  );
  await boss.start();
  for (const name of [SYNC_QUEUE, TICK_QUEUE]) {
    await boss.createQueue(name).catch(() => undefined); // already exists
  }
  return {
    boss,
    async sendSync(job, opts) {
      await boss.send(SYNC_QUEUE, job, {
        ...(opts?.startAfterSeconds ? { startAfter: opts.startAfterSeconds } : {}),
        singletonKey: `${job.syncRunId}:${job.attempt}`,
        retryLimit: 2,
        retryDelay: 30,
        retryBackoff: true,
        expireInSeconds: 3600,
      });
    },
    stop: () => boss.stop({ graceful: true, timeout: 10_000 }),
  };
}
