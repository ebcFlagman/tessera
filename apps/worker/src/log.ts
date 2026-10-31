const SENSITIVE = /password|secret|token|credential|authorization|api[-_]?key/i;

function redact(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) ? '[REDACTED]' : redact(v)]),
  );
}

export const log = {
  info: (message: string, fields?: Record<string, unknown>) =>
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        at: new Date().toISOString(),
        ...(fields ? { fields: redact(fields) } : {}),
      }),
    ),
  error: (message: string, fields?: Record<string, unknown>) =>
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        at: new Date().toISOString(),
        ...(fields ? { fields: redact(fields) } : {}),
      }),
    ),
};
