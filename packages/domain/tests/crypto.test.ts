import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, loadKeyring, needsRotation } from '../src';

const b64 = () => randomBytes(32).toString('base64');
const ring = (id: string, key: string, previous?: Record<string, string>) =>
  loadKeyring({
    CREDENTIALS_KEY: key,
    CREDENTIALS_KEY_ID: id,
    ...(previous ? { CREDENTIALS_PREVIOUS_KEYS: JSON.stringify(previous) } : {}),
  });

describe('credential encryption', () => {
  it('round-trips and never contains the plaintext', () => {
    const keyring = ring('k1', b64());
    const payload = encryptSecret('glpat-geheim', keyring);
    expect(payload).not.toContain('geheim');
    expect(decryptSecret(payload, keyring)).toBe('glpat-geheim');
  });

  it('uses a fresh IV, so equal secrets encrypt differently', () => {
    const keyring = ring('k1', b64());
    expect(encryptSecret('x', keyring)).not.toBe(encryptSecret('x', keyring));
  });

  it('rejects tampered payloads and wrong keys', () => {
    const keyring = ring('k1', b64());
    const payload = encryptSecret('secret', keyring);
    const parts = payload.split('.');
    parts[4] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptSecret(parts.join('.'), keyring)).toThrow();
    expect(() => decryptSecret(payload, ring('k1', b64()))).toThrow();
    expect(() => decryptSecret('garbage', keyring)).toThrow();
  });

  it('supports rotation: old payloads stay readable and are flagged for re-encryption', () => {
    const oldKey = b64();
    const oldPayload = encryptSecret('secret', ring('old', oldKey));
    const rotated = ring('new', b64(), { old: oldKey });
    expect(decryptSecret(oldPayload, rotated)).toBe('secret');
    expect(needsRotation(oldPayload, rotated)).toBe(true);
    expect(needsRotation(encryptSecret('secret', rotated), rotated)).toBe(false);
  });

  it('requires a 32-byte key', () => {
    expect(() => loadKeyring({ CREDENTIALS_KEY: Buffer.from('short').toString('base64') })).toThrow(
      /32 bytes/,
    );
    expect(() => loadKeyring({})).toThrow(/CREDENTIALS_KEY/);
  });
});
