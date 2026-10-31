import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const PORT = 54330;

/**
 * Starts a throw-away PostgreSQL (no Docker needed), applies the real migrations and exposes
 * DATABASE_URL to the test workers.
 */
export default async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'tessera-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'tessera',
    password: 'tessera',
    port: PORT,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('tessera_test');

  const url = `postgresql://tessera:tessera@localhost:${PORT}/tessera_test`;
  process.env.DATABASE_URL = url;
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '../../../../packages/db'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  return async () => {
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
