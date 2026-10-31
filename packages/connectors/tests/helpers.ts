import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConnectorContext, RawFinding } from '../src';

export const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, 'fixtures', name), 'utf8'));

export interface Route {
  /** substring of the request url */
  match: string;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** throw like a network failure */
  fail?: boolean;
}

/** Fake `fetch` that replays recorded responses and remembers every request. */
export function fakeHttp(routes: Route[]) {
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const http = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
    const route = routes.find((r) => url.includes(r.match));
    if (!route) throw new Error(`no fixture for ${url}`);
    if (route.fail) throw new TypeError('fetch failed');
    return new Response(JSON.stringify(route.body ?? {}), {
      status: route.status ?? 200,
      headers: { 'content-type': 'application/json', ...(route.headers ?? {}) },
    });
  }) as typeof fetch;
  return { http, requests };
}

export const ctx = <C>(
  config: C,
  http: typeof fetch,
  credentials = 'geheimes-token',
): ConnectorContext<C> => ({
  config,
  credentials,
  http,
});

export async function collect(source: AsyncIterable<RawFinding[]>): Promise<RawFinding[]> {
  const all: RawFinding[] = [];
  for await (const page of source) all.push(...page);
  return all;
}
