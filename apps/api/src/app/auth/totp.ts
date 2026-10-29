// Minimal TOTP (RFC 6238) over node:crypto - no external dependency.
// Secrets are 160-bit random, base32-encoded (RFC 4648, no padding) for
// authenticator-app entry; codes are 6 digits over a 30s step verified
// with a +-1 step window for clock skew.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const code = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

export function totpCode(secretB32: string, atMs = Date.now()): string {
  return hotp(base32Decode(secretB32), Math.floor(atMs / 1000 / 30));
}

export function verifyTotp(secretB32: string, code: string, atMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(atMs / 1000 / 30);
  const presented = Buffer.from(code);
  for (const w of [-1, 0, 1]) {
    const expected = Buffer.from(hotp(base32Decode(secretB32), counter + w));
    if (timingSafeEqual(presented, expected)) return true;
  }
  return false;
}

export function otpauthUrl(secretB32: string, email: string): string {
  const label = encodeURIComponent(`Open-locale:${email}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent('Open-locale')}&digits=6&period=30`;
}

// One-use recovery codes: 10 Crockford-base32 chars grouped XXXXX-XXXXX,
// shown once at enable, stored sha256-hashed, consumed on use.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateRecoveryCodes(count = 8): string[] {
  // 16 Crockford-base32 chars (~80 bits) grouped XXXXXXXX-XXXXXXXX.
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(16);
    let raw = '';
    for (const b of bytes) raw += CROCKFORD[b % 32];
    codes.push(`${raw.slice(0, 8)}-${raw.slice(8)}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}
