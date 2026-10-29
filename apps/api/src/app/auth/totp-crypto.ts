// AES-256-GCM encryption for TOTP secrets at rest. The key comes from
// TOTP_ENCRYPTION_KEY (any string, sha256-expanded to 32 bytes). In
// development it falls back to a built-in key with the same caveat as the
// dev JWT secret: fine for loopback, never for a deployment reachable by
// other machines.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const DEV_FALLBACK_TOTP_KEY = 'open-locale-dev-totp-key';

function key(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY || DEV_FALLBACK_TOTP_KEY;
  return createHash('sha256').update(raw).digest();
}

export function encryptTotpSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}

export function decryptTotpSecret(stored: string): string {
  const [enc, v, ivB, tagB, ctB] = stored.split(':');
  if (enc !== 'enc' || v !== 'v1') throw new Error('Unknown TOTP secret encoding');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
}
