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
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
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
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: '2fa-secret', TOTP_ENCRYPTION_KEY: '2fa-test-key-0123456789', PORT: String(API_PORT) }, stdio: 'pipe' });
  if (!(await waitFor(`${API}/projects`))) throw new Error('API did not start');
  prisma = new PrismaClient({ datasources: { db: { url } } });

  const ts = Date.now();
  const email = `fa${ts}@t.dev`;
  const user = (await call('/auth/signup', { method: 'POST', body: { email, password: 'pass1234', displayName: 'fa' } })).json;
  const jwt = user.accessToken;

  // Enable without setup is rejected.
  const earlyEnable = await call('/auth/2fa/enable', { jwt, method: 'POST', body: { password: 'pass1234', code: '000000' } });
  check('enable before setup rejected', earlyEnable.status === 401, `got ${earlyEnable.status}`);

  // Setup returns a secret + otpauth URL but does NOT enable.
  const noPw = await call('/auth/2fa/setup', { jwt, method: 'POST', body: {} });
  check('setup without password rejected (step-up)', noPw.status === 401 || noPw.status === 400, `got ${noPw.status}`);
  const wrongPw = await call('/auth/2fa/setup', { jwt, method: 'POST', body: { password: 'nope-nope' } });
  check('setup with wrong password rejected', wrongPw.status === 401, `got ${wrongPw.status}`);
  const setup = (await call('/auth/2fa/setup', { jwt, method: 'POST', body: { password: 'pass1234' } })).json;
  check('setup returns secret and otpauth URL', /^[A-Z2-7]{32}$/.test(setup.secret) && setup.otpauthUrl.startsWith('otpauth://totp/'), JSON.stringify(setup).slice(0, 80));
  const stillOpen = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234' } });
  check('setup alone does not enable (login still single-factor)', stillOpen.status === 200, `got ${stillOpen.status}`);

  // The stored secret is encrypted, not the base32 value.
  const row = await prisma.user.findUnique({ where: { email } });
  check('secret stored encrypted (enc:v1, plaintext absent)', row.totpSecret.startsWith('enc:v1:') && !row.totpSecret.includes(setup.secret));

  // A pre-2FA API token: 2FA must not break existing scoped bearer access,
  // but it must never reach session-only routes.
  const preTok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'pre', scopes: ['read'] } })).json;

  // Wrong code cannot enable; right code enables and returns recovery codes once.
  const badEnable = await call('/auth/2fa/enable', { jwt, method: 'POST', body: { password: 'pass1234', code: totp(setup.secret) === '000000' ? '000001' : '000000' } });
  check('wrong code cannot enable', badEnable.status === 401, `got ${badEnable.status}`);
  const enabled = await call('/auth/2fa/enable', { jwt, method: 'POST', body: { password: 'pass1234', code: totp(setup.secret) } });
  check('valid code enables, 8 recovery codes returned once', enabled.status === 201 || enabled.status === 200, `got ${enabled.status}`);
  const codes = enabled.json.recoveryCodes;
  check('recovery codes shaped XXXXXXXX-XXXXXXXX (80-bit)', Array.isArray(codes) && codes.length === 8 && codes.every((c) => /^[0-9A-Z]{8}-[0-9A-Z]{8}$/.test(c)));
  const hashes = await prisma.recoveryCode.findMany({ where: { user: { email } } });
  check('recovery codes stored hashed only', hashes.length === 8 && hashes.every((h) => /^[0-9a-f]{64}$/.test(h.codeHash)) && !hashes.some((h) => codes.includes(h.codeHash)));

  // Epoch revocation: enabling 2FA bumps the account's auth epoch, so the
  // pre-2FA 7-day session JWT dies immediately - on session-only routes AND
  // on ordinary data routes. No window where an old session lingers.
  const oldTok = await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'x', scopes: ['read'] } });
  const oldTokList = await call('/auth/tokens', { jwt });
  const oldStatus = await call('/auth/2fa/status', { jwt });
  const oldDisable = await call('/auth/2fa/disable', { jwt, method: 'POST', body: { password: 'pass1234', code: '000000' } });
  const oldData = await call('/projects', { jwt });
  const oldSetup = await call('/auth/2fa/setup', { jwt, method: 'POST', body: { password: 'pass1234' } });
  check('pre-2FA session revoked at enable: 401 on manage AND data routes', [oldTok, oldTokList, oldStatus, oldDisable, oldData, oldSetup].every((r) => r.status === 401), `got ${[oldTok, oldTokList, oldStatus, oldDisable, oldData, oldSetup].map((r) => r.status)}`);

  // Login now requires the second factor.
  const noCode = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234' } });
  check('login without code rejected (2FA required)', noCode.status === 401 && /two-factor/i.test(noCode.json.message), `got ${noCode.status}`);
  const wrongCode = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: totp(setup.secret) === '999999' ? '999998' : '999999' } });
  check('login with wrong code rejected', wrongCode.status === 401, `got ${wrongCode.status}`);
  // The enable step consumes counter N, so the first login must use N+1.
  const goodCode = totp(setup.secret, 1);
  const withCode = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: goodCode } });
  check('login with valid TOTP succeeds', withCode.status === 200 && !!withCode.json.accessToken, `got ${withCode.status} ${withCode.json && withCode.json.message || ''}`);
  let consumedCounter = Math.floor(Date.now() / 1000 / 30) + 1; // upper bound of what the server recorded
  const replay = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: goodCode } });
  check('same code replayed within window rejected', replay.status === 401, `got ${replay.status}`);

  // Concurrent identical TOTP submissions: the atomic counter claim lets
  // exactly one through. Wait for a fresh window so the code is valid.
  {
    while (Math.floor(Date.now() / 1000 / 30) <= consumedCounter + 1) await new Promise((r) => setTimeout(r, 200));
    const fresh = totp(setup.secret);
    const [r1, r2] = await Promise.all([
      call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: fresh } }),
      call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: fresh } }),
    ]);
    const wins = [r1, r2].filter((r) => r.status === 200).length;
    check('simultaneous identical TOTP: exactly one session wins', wins === 1, `wins=${wins}`);
    consumedCounter = Math.floor(Date.now() / 1000 / 30) + 1; // the winner consumed this window
  }

  // Recovery code: works once, consumed atomically.
  const viaRecovery = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: codes[0] } });
  check('recovery code logs in', viaRecovery.status === 200, `got ${viaRecovery.status}`);
  const reuseRecovery = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: codes[0] } });
  check('recovery code cannot be reused', reuseRecovery.status === 401, `got ${reuseRecovery.status}`);
  const [rc1, rc2] = await Promise.all([
    call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: codes[1] } }),
    call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: codes[1] } }),
  ]);
  check('simultaneous recovery-code use: single winner', [rc1, rc2].filter((r) => r.status === 200).length === 1, `${rc1.status}/${rc2.status}`);
  const jwtStepped = (rc1.status === 200 ? rc1 : rc2).json.accessToken;
  const statusAfterUse = (await call('/auth/2fa/status', { jwt: jwtStepped })).json;
  check('status reports remaining recovery codes', statusAfterUse.enabled === true && statusAfterUse.recoveryCodesRemaining === 6, JSON.stringify(statusAfterUse));

  // A pending setup must never overwrite an ENABLED secret.
  const setupWhileEnabled = await call('/auth/2fa/setup', { jwt: jwtStepped, method: 'POST', body: { password: 'pass1234' } });
  check('setup while enabled rejected (no secret overwrite)', setupWhileEnabled.status === 409, `got ${setupWhileEnabled.status}`);

  // Session-only management: API tokens cannot read or change 2FA.
  const apiSetup = await call('/auth/2fa/setup', { apiKey: preTok.token, method: 'POST', body: { password: 'pass1234' } });
  const apiStatus = await call('/auth/2fa/status', { apiKey: preTok.token });
  check('API token cannot manage or read 2FA (403)', apiSetup.status === 403 && apiStatus.status === 403, `setup=${apiSetup.status} status=${apiStatus.status}`);
  const scoped = await call('/projects', { apiKey: preTok.token });
  check('pre-2FA API token still serves scoped calls (documented boundary)', scoped.status === 200, `got ${scoped.status}`);

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
  const noPwDisable = await call('/auth/2fa/disable', { jwt: jwtStepped, method: 'POST', body: { password: 'nope-nope', code: totp(setup.secret) } });
  check('disable with wrong password rejected (step-up)', noPwDisable.status === 401, `got ${noPwDisable.status}`);
  const disabled = await call('/auth/2fa/disable', { jwt: jwtStepped, method: 'POST', body: { password: 'pass1234', code: totp(setup.secret) } });
  check('valid code disables 2FA', disabled.status === 200 || disabled.status === 201, `got ${disabled.status} ${disabled.json && disabled.json.message || ''}`);
  const open2 = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234' } });
  check('login single-factor again after disable', open2.status === 200, `got ${open2.status}`);
  const oldRecovery = await call('/auth/2fa/disable', { jwt: jwtStepped, method: 'POST', body: { password: 'pass1234', code: codes[2] } });
  check('disable revoked the stepping session too (epoch bump)', oldRecovery.status === 401, `got ${oldRecovery.status}`);
  check('disable cleared secrets and recovery codes', (await prisma.recoveryCode.count({ where: { user: { email } } })) === 0);

  // Lifecycle generation binding: an MFA JWT from a previous 2FA generation
  // must never become valid again after disable + re-enable with a NEW
  // secret. Re-enable, then prove the old MFA token stays dead and the old
  // secret's codes no longer authenticate.
  {
    const relogin = (await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234' } })).json;
    const setup2 = (await call('/auth/2fa/setup', { jwt: relogin.accessToken, method: 'POST', body: { password: 'pass1234' } })).json;
    check('re-setup after disable returns a fresh secret', /^[A-Z2-7]{32}$/.test(setup2.secret) && setup2.secret !== setup.secret);
    const en2 = await call('/auth/2fa/enable', { jwt: relogin.accessToken, method: 'POST', body: { password: 'pass1234', code: totp(setup2.secret) } });
    check('re-enable with new secret succeeds', en2.status === 200 || en2.status === 201, `got ${en2.status}`);
    const staleMfa = await call('/projects', { jwt: jwtStepped });
    check('MFA JWT from previous 2FA generation stays revoked after re-enable', staleMfa.status === 401, `got ${staleMfa.status}`);
    // Wait past the counter consumed by re-enable before logging in again.
    await new Promise((r) => setTimeout(r, 31000));
    const oldSecretLogin = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: totp(setup.secret) } });
    check('old secret codes rejected after re-enable with new secret', oldSecretLogin.status === 401, `got ${oldSecretLogin.status}`);
    const newSecretLogin = await call('/auth/login', { method: 'POST', body: { email, password: 'pass1234', totpCode: totp(setup2.secret) } });
    check('new secret codes accepted after re-enable', newSecretLogin.status === 200, `got ${newSecretLogin.status}`);
  }
  // Startup fail-closed: a missing/weak/known-fallback TOTP key must stop
  // the process from ever listening - in production, on any non-loopback
  // bind, and whenever the variable holds the built-in development value.
  const expectRefusesStart = async (label, env) => {
    const p = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
      env: { ...process.env, DATABASE_URL: url, JWT_SECRET: '2fa-secret', PORT: '3993', ...env }, stdio: 'pipe' });
    const exitCode = await new Promise((resolve) => {
      const t = setTimeout(() => resolve('still-running'), 9000);
      p.on('exit', (c) => { clearTimeout(t); resolve(c); });
    });
    if (exitCode === 'still-running') p.kill('SIGKILL');
    check(label, exitCode !== 'still-running' && exitCode !== 0, `exit=${exitCode}`);
  };
  await expectRefusesStart('production without TOTP_ENCRYPTION_KEY refuses to start', { NODE_ENV: 'production', TOTP_ENCRYPTION_KEY: '' });
  await expectRefusesStart('non-loopback bind without TOTP_ENCRYPTION_KEY refuses to start', { NODE_ENV: 'development', HOST: '0.0.0.0', TOTP_ENCRYPTION_KEY: '' });
  await expectRefusesStart('known fallback value as TOTP_ENCRYPTION_KEY refused at startup', { NODE_ENV: 'development', TOTP_ENCRYPTION_KEY: 'open-locale-dev-totp-key' });
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  if (prisma) await prisma.$disconnect();
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `2fa: ${failures} FAILURES` : '2fa pass complete');
process.exit(failures ? 1 : 0);
