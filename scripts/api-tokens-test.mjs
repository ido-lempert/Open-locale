// Scoped API tokens: real PostgreSQL + real HTTP API.
// Covers the v1 token surface: create/list/revoke, scope enforcement, expiry,
// hash-at-rest, and the rule that token management is session-only.
// Run: node scripts/api-tokens-test.mjs   (requires dist/apps/api built)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';

const PG_PORT = 55449, API_PORT = 3016;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tok-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_tok');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_tok`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'tok-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  // Signup + JWT.
  const email = `tok${Date.now()}@t.dev`;
  const signup = await call('/auth/signup', { method: 'POST', body: { email, password: 'pass1234', displayName: 'Tok' } });
  const jwt = signup.json.accessToken;
  check('signup issues a session JWT', signup.status === 201 && !!jwt);

  const created = await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'ci', scopes: ['read', 'write'] } });
  check('create token returns the raw token once', created.status === 201 && created.json.token?.startsWith('ol_'));
  const rwToken = created.json.token;

  const ro = await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'readonly', scopes: ['read'] } });
  check('create read-only token', ro.status === 201 && ro.json.token?.startsWith('ol_'));
  const roToken = ro.json.token;

  const badScopes = await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'bad', scopes: ['admin'] } });
  check('unknown scope rejected with 400', badScopes.status === 400);

  const noRead = await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'bad', scopes: ['write'] } });
  check('write without read rejected with 400', noRead.status === 400);

  const listed = await call('/auth/tokens', { jwt });
  check('list tokens returns metadata without raw values',
    listed.status === 200 && listed.json.length === 2 && listed.json.every((t) => !t.token && !t.tokenHash));

  // Hash at rest: the raw token must never be stored.
  const db = new Client({ connectionString: url });
  await db.connect();
  const rows = (await db.query('SELECT "tokenHash" FROM api_tokens')).rows;
  check('database stores only SHA-256 hashes',
    rows.length === 2 && rows.every((r) => /^[0-9a-f]{64}$/.test(r.tokenHash)) &&
    !rows.some((r) => r.tokenHash.includes('ol_')));
  await db.end();

  // Token auth on a real endpoint: create a project, then read it with X-Api-Key.
  const proj = await call('/projects', { jwt, method: 'POST', body: { name: 'Tok Proj', slug: `tok-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } });
  check('project created for token tests', proj.status === 201 && !!proj.json?.id, `status=${proj.status}`);
  const pid = proj.json.id;
  const readViaKey = await call(`/projects/${pid}/keys`, { apiKey: rwToken });
  check('read+write token reads via X-Api-Key', readViaKey.status === 200 && Array.isArray(readViaKey.json));
  const writeViaKey = await call(`/projects/${pid}/keys`, { apiKey: rwToken, method: 'POST', body: { name: 'tok.key' } });
  check('read+write token writes', writeViaKey.status === 201);

  const roRead = await call(`/projects/${pid}/keys`, { apiKey: roToken });
  check('read-only token reads', roRead.status === 200);
  const roWrite = await call(`/projects/${pid}/keys`, { apiKey: roToken, method: 'POST', body: { name: 'tok.key2' } });
  check('read-only token write rejected with 403', roWrite.status === 403);

  // Session-only token management: an API token must not mint/list/revoke tokens.
  const mintViaToken = await call('/auth/tokens', { apiKey: rwToken, method: 'POST', body: { name: 'child' } });
  check('API token cannot create tokens', mintViaToken.status === 403);
  const listViaToken = await call('/auth/tokens', { apiKey: rwToken });
  check('API token cannot list tokens', listViaToken.status === 403);
  const revokeViaToken = await call(`/auth/tokens/${ro.json.id}`, { apiKey: rwToken, method: 'DELETE' });
  check('API token cannot revoke tokens', revokeViaToken.status === 403);

  // Expiry.
  const exp = await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'expired', scopes: ['read'], expiresAt: new Date(Date.now() + 60_000).toISOString() } });
  check('create token with future expiry', exp.status === 201);
  const pastExp = await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'bad', scopes: ['read'], expiresAt: new Date(Date.now() - 60_000).toISOString() } });
  check('past expiry rejected with 400', pastExp.status === 400);
  const db2 = new Client({ connectionString: url });
  await db2.connect();
  // Prisma stores JS Dates in this timestamp-without-tz column as UTC wall time;
  // a tz-aware now() would be converted to the DB session zone first, so use a
  // fixed naive UTC literal to match the application's write convention.
  await db2.query(`UPDATE api_tokens SET "expiresAt" = timestamp '2020-01-01 00:00:00' WHERE name = 'expired'`);
  await db2.end();
  const expUse = await call(`/projects/${pid}/keys`, { apiKey: exp.json.token });
  check('expired token rejected with 401', expUse.status === 401, `status=${expUse.status}`);

  // Revocation takes effect immediately.
  const revoked = await call(`/auth/tokens/${created.json.id}`, { jwt, method: 'DELETE' });
  check('revoke token', revoked.status === 200 || revoked.status === 204);
  const afterRevoke = await call(`/projects/${pid}/keys`, { apiKey: rwToken });
  check('revoked token rejected with 401', afterRevoke.status === 401);

  const badKey = await call(`/projects/${pid}/keys`, { apiKey: 'ol_nonexistent' });
  check('unknown token rejected with 401', badKey.status === 401);

  // OpenAPI v1 docs.
  const docs = await fetch(`${API}/openapi.json`);
  const spec = await docs.json().catch(() => null);
  check('openapi.json served without auth', docs.status === 200 && spec?.openapi === '3.0.3');
  const docPaths = Object.keys(spec?.paths ?? {});
  const ops = docPaths.reduce((n, k) => n + Object.keys(spec.paths[k]).length, 0);
  check('spec covers the v1 surface (49+ operations)', ops >= 49, `${docPaths.length} paths, ${ops} operations`);
  check('spec documents token auth schemes',
    !!spec?.components?.securitySchemes?.bearerAuth && !!spec?.components?.securitySchemes?.apiKeyAuth);
  check('spec documents webhooks + exports',
    !!spec?.paths?.['/api/projects/{projectId}/webhooks'] &&
    !!spec?.paths?.['/api/projects/{projectId}/export/{locale}/android']);
} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `api-tokens: ${failures} FAILURES` : 'api-tokens pass complete');
process.exit(failures ? 1 : 0);
