const SENSITIVE = /password|secret|token|credential|authorization|api[-_]?key|cookie/i;

/** Replaces values of sensitive keys, recursively (constitution IV). */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE.test(k) ? '[REDACTED]' : redact(v, depth + 1),
    ]),
  );
}

type Level = 'info' | 'warn' | 'error';

function write(level: Level, message: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    message,
    at: new Date().toISOString(),
    ...(fields ? { fields: redact(fields) } : {}),
  });
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export const logger = {
  info: (m: string, f?: Record<string, unknown>) => write('info', m, f),
  warn: (m: string, f?: Record<string, unknown>) => write('warn', m, f),
  error: (m: string, f?: Record<string, unknown>) => write('error', m, f),
};
