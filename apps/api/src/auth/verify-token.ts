import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { PrismaClient, User } from '@tessera/db';
import { AppError } from '@tessera/domain';

export interface Identity {
  subject: string;
  name: string;
  email?: string;
}

export type TokenVerifier = (token: string) => Promise<Identity>;

/** Verifies Keycloak access tokens against the realm's JWKS. */
export function createOidcVerifier(opts: { issuer: string; audience: string }): TokenVerifier {
  const jwks = createRemoteJWKSet(new URL(`${opts.issuer}/protocol/openid-connect/certs`));
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: opts.issuer,
        audience: opts.audience,
      });
      if (!payload.sub) throw new Error('token without subject');
      const name =
        (payload.name as string | undefined) ??
        (payload.preferred_username as string | undefined) ??
        payload.sub;
      const email = payload.email as string | undefined;
      return { subject: payload.sub, name, ...(email ? { email } : {}) };
    } catch {
      throw new AppError('unauthenticated', 'Ungültiges oder abgelaufenes Token');
    }
  };
}

export function bearerToken(header: string | null): string {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new AppError('unauthenticated', 'Anmeldung erforderlich');
  return match[1];
}

/** Mirrors the OIDC identity into the user table (used for owners, memberships, audit). */
export async function syncUser(db: PrismaClient, identity: Identity): Promise<User> {
  return db.user.upsert({
    where: { subject: identity.subject },
    update: { name: identity.name, email: identity.email ?? null },
    create: { subject: identity.subject, name: identity.name, email: identity.email ?? null },
  });
}
