import { createJobQueue, getDb } from '@tessera/db';
import { getConnector } from '@tessera/connectors';
import { loadKeyring } from '@tessera/domain';
import { log } from './log';
import { startWorker } from './scheduler';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Missing environment variable DATABASE_URL');
  const queue = await createJobQueue(url);
  await startWorker(
    {
      db: getDb(),
      getConnector,
      keyring: loadKeyring(process.env),
      http: fetch,
      allowedHosts: (process.env.SOURCE_ALLOWED_HOSTS ?? '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean),
    },
    queue,
  );
  const stop = async () => {
    await queue.stop();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((err) => {
  log.error('worker crashed', { error: String(err?.message ?? err) });
  process.exit(1);
});
