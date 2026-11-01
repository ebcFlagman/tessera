import { describe, expect, it } from 'vitest';
import { allowedOrigins, corsHeaders } from '../src/lib/cors';

describe('cors', () => {
  const allowed = allowedOrigins('http://localhost:3000, https://tessera.example.test');

  it('allows only configured origins and never uses a wildcard', () => {
    const ok = corsHeaders('http://localhost:3000', allowed);
    expect(ok['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    expect(ok['Access-Control-Allow-Headers']).toContain('Authorization');
    expect(ok['Access-Control-Expose-Headers']).toBe('Content-Disposition');
    const bad = corsHeaders('http://evil.example', allowed);
    expect(bad['Access-Control-Allow-Origin']).toBeUndefined();
    expect(Object.values(ok)).not.toContain('*');
  });

  it('defaults to the local web app and ignores requests without an origin', () => {
    expect(allowedOrigins(undefined)).toEqual(['http://localhost:3000']);
    expect(corsHeaders(null, allowed)['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
