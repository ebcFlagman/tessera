import { describe, expect, it } from 'vitest';
import { redact } from '../src/lib/logger';

describe('redact', () => {
  it('hides secrets recursively and keeps other fields', () => {
    const out = redact({
      name: 'x',
      credentials: 'abc',
      nested: { Authorization: 'Bearer t', ok: 1, list: [{ apiKey: 'k' }] },
    });
    expect(out).toEqual({
      name: 'x',
      credentials: '[REDACTED]',
      nested: { Authorization: '[REDACTED]', ok: 1, list: [{ apiKey: '[REDACTED]' }] },
    });
  });
});
