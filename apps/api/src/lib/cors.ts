/**
 * CORS for the browser frontend, which runs on a different origin than the API.
 * Only the configured origins are allowed (never `*`), because requests carry bearer tokens.
 */
export function allowedOrigins(env: string | undefined): string[] {
  return (env ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type';
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}
