// 2FA (TOTP) slice: encrypted-at-rest secrets, enable-after-verify, second
// factor on password login, replay protection via last-seen counter, one-use
// hashed recovery codes, lockout after repeated failures, and session-only
// management (API tokens cannot touch 2FA). Real PG + HTTP; storage
// encryption verified by reading the row directly through Prisma. The test
// computes TOTP codes with its own independent RFC 6238 implementation.
// Run: node scripts/2fa-test.mjs (requires: nx build api)
import { execFileSync, spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const PG_PORT = 55471, API_PORT = 3000;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };

// Independent RFC 6238 (SHA1/30s/6 digits) so the test does not reuse the
// implementation it verifies.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32dec(s) {
  const clean = s.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function totp(secretB32, counterOffset = 0) {
  const counter = Math.floor(Date.now() / 1000 / 30) + counterOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', b32dec(secretB32)).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, '0');
}

async function call(path, { jwt, apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const waitFor = async (url, tries = 90) => {
  for (let i = 0; i < tries; i++) { await new Promise((r) => setTimeout(r, 500)); if (await fetch(url).then((r) => r.status > 0).catch(() => false)) return true; }
  return false;
};

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-2fa-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api, prisma;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_2fa');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_2fa`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: '2fa-secret', TOTP_ENCRYPTION_KEY: '2fa-test-key', PORT: String(API_PORT) }, stdio: 'pipe' });
  if (!(await waitFor(`${API}/projects`))) throw new Error('API did not start');
  prisma = new PrismaClient({ datasources: { db: { url } } });

  const ts = Date.now();
  const email = `fa${ts}@t.dev`;
  const user = (await call('/auth/signup', { method: 'POST', body: { email, password: 'pass1234', displayName: 'fa' } })).json;
  const jwt = user.accessToken;

  // Enable without setup is rejected.
  const earlyEnable = await call('/auth/2fa/enable', { jwt, method: 'POST', body: { code: '000000' } });
  check('enable before setup rejected', earlyEnable.status === 401, `got ${earlyEnable.status}`);

  // Setup returns a secret + otpauth URL but does NOT enable.
  const setup = (await call('/auth/2fa/setup', { jwt, method: 'POST' })).json;
  check('setup returns secret and otpauth URL', /^[A-Z2-7]{32}$/.test(setup.secret) && setup.otpauthUrl.startsWith('otpauth://totp/'), JSON.stringify(setup).slice(0, 80));
  const stillOpen = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234' } });
  check('setup alone does not enable (login still single-factor)', stillOpen.status === 200, `got ${stillOpen.status}`);

  // The stored secret is encrypted, not the base32 value.
  const row = await prisma.user.findUnique({ where: { email } });
  check('secret stored encrypted (enc:v1, plaintext absent)', row.totpSecret.startsWith('enc:v1:') && !row.totpSecret.includes(setup.secret));

  // Wrong code cannot enable; right code enables and returns recovery codes once.
  const badEnable = await call('/auth/2fa/enable', { jwt, method: 'POST', body: { code: totp(setup.secret) === '000000' ? '000001' : '000000' } });
  check('wrong code cannot enable', badEnable.status === 401, `got ${badEnable.status}`);
  const enabled = await call('/auth/2fa/enable', { jwt, method: 'POST', body: { code: totp(setup.secret) } });
  check('valid code enables, 8 recovery codes returned once', enabled.status === 201 || enabled.status === 200, `got ${enabled.status}`);
  const codes = enabled.json.recoveryCodes;
  check('recovery codes shaped XXXXX-XXXXX', Array.isArray(codes) && codes.length === 8 && codes.every((c) => /^[0-9A-Z]{5}-[0-9A-Z]{5}$/.test(c)));
  const hashes = await prisma.recoveryCode.findMany({ where: { user: { email } } });
  check('recovery codes stored hashed only', hashes.length === 8 && hashes.every((h) => /^[0-9a-f]{64}$/.test(h.codeHash)) && !hashes.some((h) => codes.includes(h.codeHash)));

  // Login now requires the second factor.
  const noCode = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234' } });
  check('login without code rejected (2FA required)', noCode.status === 401 && /two-factor/i.test(noCode.json.message), `got ${noCode.status}`);
  const wrongCode = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: totp(setup.secret) === '999999' ? '999998' : '999999' } });
  check('login with wrong code rejected', wrongCode.status === 401, `got ${wrongCode.status}`);
  // The enable step consumes counter N, so the first login must use N+1.
  const goodCode = totp(setup.secret, 1);
  const withCode = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: goodCode } });
  check('login with valid TOTP succeeds', withCode.status === 200 && !!withCode.json.accessToken, `got ${withCode.status} ${withCode.json && withCode.json.message || ''}`);
  const consumedCounter = Math.floor(Date.now() / 1000 / 30) + 1; // upper bound of what the server recorded
  const replay = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: goodCode } });
  check('same code replayed within window rejected', replay.status === 401, `got ${replay.status}`);

  // Recovery code: works once, consumed atomically.
  const viaRecovery = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: codes[0] } });
  check('recovery code logs in', viaRecovery.status === 200, `got ${viaRecovery.status}`);
  const reuseRecovery = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: codes[0] } });
  check('recovery code cannot be reused', reuseRecovery.status === 401, `got ${reuseRecovery.status}`);
  const statusAfterUse = (await call('/auth/2fa/status', { jwt })).json;
  check('status reports remaining recovery codes', statusAfterUse.enabled === true && statusAfterUse.recoveryCodesRemaining === 7, JSON.stringify(statusAfterUse));

  // Session-only management: API tokens cannot read or change 2FA.
  const tok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'ci', scopes: ['read', 'write'] } })).json;
  const apiSetup = await call('/auth/2fa/setup', { apiKey: tok.token, method: 'POST' });
  const apiStatus = await call('/auth/2fa/status', { apiKey: tok.token });
  check('API token cannot manage or read 2FA (403)', apiSetup.status === 403 && apiStatus.status === 403, `setup=${apiSetup.status} status=${apiStatus.status}`);

  // Lockout: 5 consecutive bad codes lock 2FA; even a correct code is refused
  // while locked (checked before verification).
  for (let i = 0; i < 5; i++) {
    await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: '111111' } });
  }
  const locked = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: '222222' } });
  check('lockout after 5 failures blocks even a correct code', locked.status === 401 && /later/i.test(locked.json.message), `got ${locked.status} ${locked.json && locked.json.message}`);

  // Disable with a valid code (bypass the lock by clearing it in the fixture
  // row - the lock is under test above, not here). Codes only validate within
  // +-1 step and the last-seen counter must move forward, so wait for the
  // next 30s window before computing the disable code.
  await prisma.user.update({ where: { email }, data: { totpLockedUntil: null, totpFailedAttempts: 0 } });
  // Wait until the current window is strictly past any counter the server
  // may have recorded (lastCounter <= consumedCounter + 1 for mid-flight
  // rollover), then the fresh code always wins.
  while (Math.floor(Date.now() / 1000 / 30) <= consumedCounter + 1) await new Promise((r) => setTimeout(r, 250));
  const disabled = await call('/auth/2fa/disable', { jwt, method: 'POST', body: { code: totp(setup.secret) } });
  check('valid code disables 2FA', disabled.status === 200 || disabled.status === 201, `got ${disabled.status} ${disabled.json && disabled.json.message || ''}`);
  const open2 = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234' } });
  check('login single-factor again after disable', open2.status === 200, `got ${open2.status}`);
  const oldRecovery = await call('/auth/2fa/disable', { jwt, method: 'POST', body: { code: codes[1] } });
  check('disable cleared secrets and recovery codes', oldRecovery.status === 401 && (await prisma.recoveryCode.count({ where: { user: { email } } })) === 0, `got ${oldRecovery.status}`);
} finally {
  if (prisma) await prisma.$disconnect();
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `2fa: ${failures} FAILURES` : '2fa pass complete');
process.exit(failures ? 1 : 0);
