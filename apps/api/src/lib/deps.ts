import { getConnector, type ConnectorRegistry } from '@tessera/connectors';
import { createJobQueue, getDb, type JobQueue, type PrismaClient } from '@tessera/db';
import { loadKeyring, type Keyring } from '@tessera/domain';
import { createOidcVerifier, type TokenVerifier } from '../auth/verify-token';

export interface Deps {
  db: PrismaClient;
  verifyToken: TokenVerifier;
  /** Job queue; connected on first use so requests that never enqueue stay cheap. */
  getQueue: () => Promise<Pick<JobQueue, 'sendSync'>>;
  getConnector: ConnectorRegistry;
  /** Credential encryption keys; read on first use. */
  getKeyring: () => Keyring;
  http: typeof fetch;
  /** hosts besides sonarcloud.io and gitlab.com that sources may use (SOURCE_ALLOWED_HOSTS) */
  allowedHosts: string[];
}

let override: Deps | undefined;
let cached: Deps | undefined;
let queue: Promise<JobQueue> | undefined;

/** Tests inject fake dependencies here. */
export function setDeps(deps: Deps | undefined) {
  override = deps;
}

export function getDeps(): Deps {
  if (override) return override;
  cached ??= {
    db: getDb(),
    verifyToken: createOidcVerifier({
      issuer: requiredEnv('OIDC_ISSUER'),
      audience: requiredEnv('OIDC_AUDIENCE'),
    }),
    getQueue: () => (queue ??= createJobQueue(requiredEnv('DATABASE_URL'), 2)),
    getConnector,
    getKeyring: () => loadKeyring(process.env),
    http: fetch,
    allowedHosts: (process.env.SOURCE_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean),
  };
  return cached;
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}
