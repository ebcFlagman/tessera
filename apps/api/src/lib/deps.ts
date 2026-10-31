import { getDb } from '@tessera/db';
import type { PrismaClient } from '@tessera/db';
import { createOidcVerifier, type TokenVerifier } from '../auth/verify-token';

export interface Deps {
  db: PrismaClient;
  verifyToken: TokenVerifier;
}

let override: Deps | undefined;
let cached: Deps | undefined;

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
  };
  return cached;
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}
