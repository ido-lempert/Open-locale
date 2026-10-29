// Authorization baseline test: real PostgreSQL + real HTTP API.
// Proves cross-team access is denied on every route family and that
// unauthenticated requests are rejected. Run: node scripts/authz-http-test.mjs
// Requires: nx build api (dist/apps/api/main.js must exist).
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55433;
const API_PORT = 3001;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
function check(name, cond, extra = '') {
  if (cond) console.log(`PASS ${name}`);
  else { failures += 1; console.log(`FAIL ${name} ${extra}`); }
}

async function call(path, { token, apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const res = await fetch(`${API}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-authz-'));
const pg = new EmbeddedPostgres({
  databaseDir: dataDir, user: 'postgres', password: 'postgres',
  port: PG_PORT, persistent: false,
});
let api;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('openlocale_authz');
  const url = `postgresql://postgres:postgres@${'localhost'}:${PG_PORT}/openlocale_authz`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe',
  });

  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'test-secret', PORT: String(API_PORT) },
    stdio: 'pipe',
  });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  // Unauthenticated access
  const noAuth = await call('/projects');
  check('unauthenticated request rejected with 401', noAuth.status === 401);
  const badJwt = await call('/projects', { token: 'not-a-jwt' });
  check('garbage Bearer token rejected with 401', badJwt.status === 401);
  const badKey = await call('/projects', { apiKey: 'ol_garbage' });
  check('garbage API key rejected with 401', badKey.status === 401);

  // Two users in two different teams
  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@x.io', password: 'password-a', displayName: 'A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@x.io', password: 'password-b', displayName: 'B' } })).json;
  check('two signups issue tokens', Boolean(a?.accessToken && b?.accessToken));

  const proj = (await call('/projects', {
    token: a.accessToken, method: 'POST',
    body: { name: 'A Shop', slug: 'a-shop', locales: ['en', 'he'] },
  })).json;
  const key = (await call(`/projects/${proj.id}/keys`, {
    token: a.accessToken, method: 'POST', body: { name: 'cart.title' },
  })).json;
  await call(`/projects/${proj.id}/keys/${key.id}/translations`, {
    token: a.accessToken, method: 'PUT', body: { locale: 'en', value: 'Cart' },
  });
  check('user A seeded project, key and translation', Boolean(proj.id && key.id));

  // Cross-team negative access: every route family must deny B
  const bt = b.accessToken;
  const listB = await call('/projects', { token: bt });
  check('B project list does not include A project', !listB.json?.some?.((p) => p.id === proj.id));
  const cases = [
    ['GET project', `/projects/${proj.id}`, { method: 'GET' }],
    ['PATCH project', `/projects/${proj.id}`, { method: 'PATCH', body: { name: 'hijack' } }],
    ['DELETE project', `/projects/${proj.id}`, { method: 'DELETE' }],
    ['add locale', `/projects/${proj.id}/locales`, { method: 'POST', body: { code: 'fr' } }],
    ['remove locale', `/projects/${proj.id}/locales/en`, { method: 'DELETE' }],
    ['list keys', `/projects/${proj.id}/keys`, { method: 'GET' }],
    ['create key', `/projects/${proj.id}/keys`, { method: 'POST', body: { name: 'evil.key' } }],
    ['update key', `/projects/${proj.id}/keys/${key.id}`, { method: 'PATCH', body: { description: 'x' } }],
    ['delete key', `/projects/${proj.id}/keys/${key.id}`, { method: 'DELETE' }],
    ['upsert translation', `/projects/${proj.id}/keys/${key.id}/translations`, { method: 'PUT', body: { locale: 'en', value: 'pwned' } }],
    ['export JSON', `/projects/${proj.id}/export/en`, { method: 'GET' }],
    ['import JSON', `/projects/${proj.id}/import/he`, { method: 'POST', body: { locale: 'he', entries: { evil: 'x' } } }],
  ];
  for (const [name, path, init] of cases) {
    const res = await call(path, { ...init, token: bt });
    check(`cross-team ${name} denied (404)`, res.status === 404, `got ${res.status}`);
  }

  // Cross-project key reference: B's own project must not accept A's key id
  const q = (await call('/projects', { token: bt, method: 'POST', body: { name: 'B Shop', slug: 'b-shop', locales: ['en'] } })).json;
  const xkey = await call(`/projects/${q.id}/keys/${key.id}/translations`, {
    token: bt, method: 'PUT', body: { locale: 'en', value: 'x' },
  });
  check('foreign key id on own project rejected (404)', xkey.status === 404, `got ${xkey.status}`);

  // API tokens: creation, scoping, revocation
  const roToken = (await call('/auth/tokens', { token: a.accessToken, method: 'POST', body: { name: 'ci-read', scopes: ['read'] } })).json;
  check('read-only token created with raw value shown once', Boolean(roToken?.token?.startsWith('ol_')) && Boolean(roToken?.id));
  const list = await call('/auth/tokens', { token: a.accessToken });
  check('token list has no tokenHash or raw token', list.status === 200 && !JSON.stringify(list.json).includes('tokenHash') && !JSON.stringify(list.json).includes(roToken.token));
  const roGet = await call(`/projects/${proj.id}`, { apiKey: roToken.token });
  check('read-only token can GET', roGet.status === 200);
  const roWrite = await call(`/projects/${proj.id}/keys`, { apiKey: roToken.token, method: 'POST', body: { name: 'nope.key' } });
  check('read-only token write rejected (403)', roWrite.status === 403, `got ${roWrite.status}`);
  const bList = await call('/auth/tokens', { token: bt });
  check('B token list excludes A tokens', !bList.json?.some?.((t) => t.id === roToken.id));
  const bRevoke = await call(`/auth/tokens/${roToken.id}`, { token: bt, method: 'DELETE' });
  check('cross-user token revoke denied (404)', bRevoke.status === 404, `got ${bRevoke.status}`);
  const aRevoke = await call(`/auth/tokens/${roToken.id}`, { token: a.accessToken, method: 'DELETE' });
  check('owner can revoke token', aRevoke.status === 200);
  const afterRevoke = await call(`/projects/${proj.id}`, { apiKey: roToken.token });
  check('revoked token rejected (401)', afterRevoke.status === 401);

  // A's data untouched after B's attempts
  const after = await call(`/projects/${proj.id}`, { token: a.accessToken });
  const exp = await call(`/projects/${proj.id}/export/en`, { token: a.accessToken });
  check('A project intact after B attempts', after.status === 200 && after.json.name === 'A Shop'
    && exp.json?.cart?.title === 'Cart' && !after.json.locales?.some?.((l) => l.code === 'fr'));
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('All authorization baseline checks passed');
process.exitCode = 0;
