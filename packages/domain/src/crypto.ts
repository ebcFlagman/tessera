import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AppError } from './errors';

/** key id -> 32-byte key */
export type Keyring = { current: { id: string; key: Buffer }; all: Map<string, Buffer> };

const VERSION = 'v1';

function parseKey(base64: string, label: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32) throw new Error(`${label} must be 32 bytes, base64 encoded`);
  return key;
}

/**
 * Reads the keyring from the environment:
 * CREDENTIALS_KEY (+ CREDENTIALS_KEY_ID) encrypts; CREDENTIALS_PREVIOUS_KEYS (JSON `{id: base64}`)
 * keeps old keys decryptable during a rotation.
 */
export function loadKeyring(env: Record<string, string | undefined>): Keyring {
  const raw = env.CREDENTIALS_KEY;
  if (!raw) throw new Error('Missing environment variable CREDENTIALS_KEY');
  const id = env.CREDENTIALS_KEY_ID || 'default';
  const current = { id, key: parseKey(raw, 'CREDENTIALS_KEY') };
  const all = new Map<string, Buffer>([[id, current.key]]);
  if (env.CREDENTIALS_PREVIOUS_KEYS) {
    const previous = JSON.parse(env.CREDENTIALS_PREVIOUS_KEYS) as Record<string, string>;
    for (const [pid, b64] of Object.entries(previous)) all.set(pid, parseKey(b64, `key ${pid}`));
  }
  return { current, all };
}

/** AES-256-GCM. Format: `v1.<keyId>.<iv>.<tag>.<ciphertext>` (base64url parts). */
export function encryptSecret(plain: string, keyring: Keyring): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyring.current.key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const b = (x: Buffer) => x.toString('base64url');
  return [VERSION, keyring.current.id, b(iv), b(tag), b(ct)].join('.');
}

export function decryptSecret(payload: string, keyring: Keyring): string {
  const [version, keyId, iv, tag, ct] = payload.split('.');
  if (version !== VERSION || !keyId || !iv || !tag || !ct) {
    throw new AppError('internal', 'Gespeicherte Zugangsdaten haben ein unbekanntes Format');
  }
  const key = keyring.all.get(keyId);
  if (!key) throw new AppError('internal', `Schlüssel „${keyId}“ für die Zugangsdaten fehlt`);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ct, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new AppError('internal', 'Zugangsdaten konnten nicht entschlüsselt werden');
  }
}

/** True when the payload was encrypted with another key than the current one. */
export function needsRotation(payload: string, keyring: Keyring): boolean {
  return payload.split('.')[1] !== keyring.current.id;
}
