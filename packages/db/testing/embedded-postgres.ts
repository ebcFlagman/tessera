import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

export interface TestDatabase {
  url: string;
  stop(): Promise<void>;
}

/**
 * Throw-away PostgreSQL for tests (no Docker needed) with the real migrations applied.
 * Shared by the api and worker test suites.
 */
export async function startTestDatabase(port: number): Promise<TestDatabase> {
  const dir = mkdtempSync(join(tmpdir(), 'tessera-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'tessera',
    password: 'tessera',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  const stop = async () => {
    await pg.stop().catch(() => undefined);
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('tessera_test');
    const url = `postgresql://tessera:tessera@localhost:${port}/tessera_test`;
    try {
      execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
        cwd: resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe',
      });
    } catch (e) {
      const err = e as { stdout?: Buffer; stderr?: Buffer };
      throw new Error(`prisma migrate deploy failed:\n${err.stdout}\n${err.stderr}`);
    }
    return { url, stop };
  } catch (e) {
    await stop();
    throw e;
  }
}
