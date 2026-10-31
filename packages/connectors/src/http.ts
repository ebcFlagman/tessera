import { ConnectorError, type ConnectorContext } from './types';

/** The hosted services; any other host must be allowed explicitly (protects against SSRF). */
export const OFFICIAL_HOSTS = ['sonarcloud.io', 'gitlab.com'];

export function isHostAllowed(url: string, extra: string[] = []): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    return [...OFFICIAL_HOSTS, ...extra].includes(hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface JsonResponse {
  body: unknown;
  headers: Headers;
}

/**
 * GET with uniform error mapping. Messages are German, user-facing and never contain
 * credentials or request headers.
 */
export async function getJson(
  ctx: ConnectorContext,
  url: string,
  headers: Record<string, string>,
  source: string,
): Promise<JsonResponse> {
  if (!isHostAllowed(url, ctx.allowedHosts)) {
    throw new ConnectorError(
      'InvalidConfig',
      `${source}: Die Adresse der Quelle ist nicht erlaubt. Ein Administrator muss den Host freigeben.`,
    );
  }
  let res: Response;
  try {
    res = await ctx.http(url, {
      headers: { accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ConnectorError('Unreachable', `${source} ist nicht erreichbar`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new ConnectorError(
      'InvalidCredentials',
      `${source} lehnt die Zugangsdaten ab (abgelaufen, widerrufen oder ohne Berechtigung)`,
    );
  }
  if (res.status === 404) {
    throw new ConnectorError(
      'InvalidConfig',
      `${source}: Projekt nicht gefunden, bitte Einstellungen prüfen`,
    );
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after'));
    throw new ConnectorError(
      'RateLimited',
      `${source} begrenzt die Anfragen, der Import wird später wiederholt`,
      Number.isFinite(retry) && retry > 0 ? retry : 60,
    );
  }
  if (!res.ok) {
    throw new ConnectorError('Unreachable', `${source} antwortet mit Fehler ${res.status}`);
  }
  try {
    return { body: await res.json(), headers: res.headers };
  } catch {
    throw new ConnectorError('PartialData', `${source} lieferte eine unlesbare Antwort`);
  }
}

export function trimUrl(base: string): string {
  return base.replace(/\/+$/, '');
}

export const MAX_TITLE = 200;
export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
