import { getDb, type PrismaClient, type Role } from '@tessera/db';
import { setDeps } from '../../src/lib/deps';
import type { TokenVerifier } from '../../src/auth/verify-token';

/** Fake OIDC: the token is `test:<subject>:<display name>`. */
export const fakeVerifier: TokenVerifier = async (token) => {
  const [kind, subject, name] = token.split(':');
  if (kind !== 'test' || !subject) throw new Error('bad token');
  return { subject, name: name ?? subject };
};

export const tokenFor = (subject: string, name = subject) => `test:${subject}:${name}`;

export function useTestDeps(): PrismaClient {
  const db = getDb();
  setDeps({ db, verifyToken: fakeVerifier });
  return db;
}

export async function resetDb(db: PrismaClient) {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE debt_event, debt_item, audit_entry, membership, team_member, team, product, app_user RESTART IDENTITY CASCADE',
  );
}

export async function seedUserWithRole(
  db: PrismaClient,
  subject: string,
  productId: string | null,
  role: Role | null,
) {
  const user = await db.user.upsert({
    where: { subject },
    update: {},
    create: { subject, name: subject },
  });
  if (productId && role) {
    await db.membership.create({ data: { userId: user.id, productId, role } });
  }
  return user;
}

export function authed(path: string, subject: string, init: RequestInit = {}): Request {
  return new Request(`http://test.local/api/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${tokenFor(subject)}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

type Handler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;

/** Invokes a route handler like Next.js would, authenticated as `subject`. */
export function call(
  route: { handle: Handler },
  path: string,
  subject: string,
  init: RequestInit = {},
  params: Record<string, string> = {},
) {
  return route.handle(authed(path, subject, init), { params: Promise.resolve(params) });
}
