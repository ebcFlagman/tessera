'use client';

import createClient, { type Middleware } from 'openapi-fetch';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import type { paths } from '@tessera/api-types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * The only place that talks HTTP to the backend. The client and its types are generated from the
 * backend's OpenAPI document (constitution VII) – never hand-write API calls elsewhere.
 */
export function createApiClient(getToken: () => string | undefined) {
  const client = createClient<paths>({ baseUrl: API_URL });
  const auth: Middleware = {
    onRequest({ request }) {
      const token = getToken();
      if (token) request.headers.set('authorization', `Bearer ${token}`);
      return request;
    },
  };
  client.use(auth);
  return client;
}

export function useApi() {
  const { data } = useSession();
  const token = data?.accessToken;
  return useMemo(() => createApiClient(() => token), [token]);
}

/** Unwraps an openapi-fetch result or throws a readable error for TanStack Query. */
export function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.data !== undefined) return result.data;
  const err = result.error as { message?: string } | undefined;
  throw new Error(err?.message ?? 'Anfrage fehlgeschlagen');
}
