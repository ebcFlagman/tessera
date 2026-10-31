import type { PrismaClient, User } from '@tessera/db';
import { AppError, errorBodySchema } from '@tessera/domain';
import { ZodError, type ZodTypeAny, type z as zt } from 'zod';
import { bearerToken, syncUser } from '../auth/verify-token';
import { getDeps } from '../lib/deps';
import { logger } from '../lib/logger';
import { registry, ErrorSchema } from './registry';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface RouteSpec<P extends ZodTypeAny, Q extends ZodTypeAny, B extends ZodTypeAny> {
  method: Method;
  /** OpenAPI path relative to /api/v1, e.g. `/debts/{id}`. */
  path: string;
  summary: string;
  tags: string[];
  params?: P;
  query?: Q;
  body?: B;
  /** Success status and body schema (undefined body = no content). */
  success: { status: 200 | 201 | 202 | 204; schema?: ZodTypeAny; description: string };
  /** Extra documented error statuses besides the standard 401/403/422. */
  errors?: (404 | 409)[];
}

export interface RouteContext<P, Q, B> {
  db: PrismaClient;
  user: User;
  params: P;
  query: Q;
  body: B;
}

/** Shape Next.js passes to route handlers (params are async since Next 15). */
type NextCtx = { params: Promise<Record<string, string>> };

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ErrorSchema } },
});

/**
 * Defines one API route. The same definition registers the OpenAPI operation and produces
 * the Next.js handler, so the backend code is the single source of the contract (constitution VII).
 */
export function defineRoute<
  P extends ZodTypeAny = ZodTypeAny,
  Q extends ZodTypeAny = ZodTypeAny,
  B extends ZodTypeAny = ZodTypeAny,
>(
  spec: RouteSpec<P, Q, B>,
  handler: (ctx: RouteContext<zt.infer<P>, zt.infer<Q>, zt.infer<B>>) => Promise<unknown>,
) {
  const responses: Record<string, unknown> = {
    [spec.success.status]: spec.success.schema
      ? {
          description: spec.success.description,
          content: { 'application/json': { schema: spec.success.schema } },
        }
      : { description: spec.success.description },
    401: errorResponse('Nicht angemeldet'),
    403: errorResponse('Keine Berechtigung'),
    422: errorResponse('Validierungsfehler'),
  };
  for (const s of spec.errors ?? []) {
    responses[s] = errorResponse(s === 404 ? 'Nicht gefunden' : 'Konflikt');
  }

  registry.registerPath({
    method: spec.method,
    path: spec.path,
    summary: spec.summary,
    tags: spec.tags,
    security: [{ bearerAuth: [] }],
    request: {
      ...(spec.params ? { params: spec.params as never } : {}),
      ...(spec.query ? { query: spec.query as never } : {}),
      ...(spec.body
        ? { body: { content: { 'application/json': { schema: spec.body } }, required: true } }
        : {}),
    },
    responses: responses as never,
  });

  const handle = async (req: Request, nextCtx: NextCtx): Promise<Response> => {
    try {
      const { db, verifyToken } = getDeps();
      const identity = await verifyToken(bearerToken(req.headers.get('authorization')));
      const user = await syncUser(db, identity);

      const rawParams = (await nextCtx?.params) ?? {};
      const params = spec.params ? spec.params.parse(rawParams) : undefined;
      const url = new URL(req.url);
      const query = spec.query
        ? spec.query.parse(Object.fromEntries(url.searchParams.entries()))
        : undefined;
      const body = spec.body ? spec.body.parse(await readJson(req)) : undefined;

      const result = await handler({ db, user, params, query, body });
      if (spec.success.status === 204 || result === undefined) {
        return new Response(null, { status: spec.success.status });
      }
      return Response.json(spec.success.schema ? spec.success.schema.parse(result) : result, {
        status: spec.success.status,
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  };

  return { spec, handle };
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError('validation_failed', 'Ungültiger JSON-Body');
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(errorBodySchema.parse(err.toBody()), { status: err.status });
  }
  if (err instanceof ZodError) {
    const e = new AppError('validation_failed', 'Eingabe ungültig', { issues: err.issues });
    return Response.json(e.toBody(), { status: e.status });
  }
  logger.error('unhandled error', { error: err instanceof Error ? err.message : String(err) });
  const e = new AppError('internal', 'Interner Fehler');
  return Response.json(e.toBody(), { status: e.status });
}
