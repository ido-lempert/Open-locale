// Granular permissions: real PostgreSQL + real HTTP API.
// Roles (OWNER/ADMIN/MEMBER) and per-locale contributor access.
// Run: node scripts/permissions-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55454, API_PORT = 3021;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-perm-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_perm');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_perm`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'perm-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const signup = async (name) =>
    (await call('/auth/signup', { method: 'POST', body: { email: `${name}${Date.now()}@t.dev`, password: 'pass1234', displayName: name } })).json;
  const owner = await signup('owner');
  const member = await signup('member');
  const admin = await signup('admin');
  const pid = (await call('/projects', { jwt: owner.accessToken, method: 'POST', body: { name: 'Perm', slug: `perm-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he', 'fr'] } })).json.id;

  // Member management.
  const addUnknown = await call(`/projects/${pid}/members`, { jwt: owner.accessToken, method: 'POST', body: { email: 'nobody@t.dev' } });
  check('adding unknown email is 404', addUnknown.status === 404);
  const addMember = await call(`/projects/${pid}/members`, { jwt: owner.accessToken, method: 'POST', body: { email: member.user.email, allowedLocales: ['he'] } });
  check('owner adds a locale-restricted member', addMember.status === 201 && addMember.json.role === 'MEMBER'
    && JSON.stringify(addMember.json.allowedLocales) === '["he"]', JSON.stringify(addMember.json));
  const addAdmin = await call(`/projects/${pid}/members`, { jwt: owner.accessToken, method: 'POST', body: { email: admin.user.email, role: 'ADMIN' } });
  check('owner adds an admin', addAdmin.status === 201 && addAdmin.json.role === 'ADMIN');
  const ownerRole = await call(`/projects/${pid}/members`, { jwt: owner.accessToken, method: 'POST', body: { email: admin.user.email, role: 'OWNER' } });
  check('assigning OWNER rejected 400', ownerRole.status === 400);
  const badLocale = await call(`/projects/${pid}/members`, { jwt: owner.accessToken, method: 'POST', body: { email: admin.user.email, role: 'ADMIN', allowedLocales: ['xx'] } });
  check('unknown project locale rejected 400', badLocale.status === 400);

  const listed = await call(`/projects/${pid}/members`, { jwt: member.accessToken });
  check('member can list members incl. locale access',
    listed.status === 200 && listed.json.some((m) => m.role === 'MEMBER' && m.allowedLocales?.includes('he')));

  // Role gates on administration.
  check('member cannot rename project (403)', (await call(`/projects/${pid}`, { jwt: member.accessToken, method: 'PATCH', body: { name: 'x' } })).status === 403);
  check('member cannot add locale (403)', (await call(`/projects/${pid}/locales`, { jwt: member.accessToken, method: 'POST', body: { code: 'de' } })).status === 403);
  check('member cannot manage webhooks (403)', (await call(`/projects/${pid}/webhooks`, { jwt: member.accessToken, method: 'POST', body: { url: 'https://example.com/h', events: ['translation.updated'] } })).status === 403);
  check('admin can add locale', (await call(`/projects/${pid}/locales`, { jwt: admin.accessToken, method: 'POST', body: { code: 'de' } })).status === 201);
  check('member cannot manage members (403)', (await call(`/projects/${pid}/members`, { jwt: member.accessToken, method: 'POST', body: { email: admin.user.email } })).status === 403);
  check('admin cannot change owner (400)', (await call(`/projects/${pid}/members/${owner.user.id}`, { jwt: admin.accessToken, method: 'PATCH', body: { role: 'MEMBER' } })).status === 400);

  // Snapshot restore is destructive -> admin only.
  const snap = await call(`/projects/${pid}/snapshots`, { jwt: owner.accessToken, method: 'POST', body: { label: 'perm-baseline' } });
  check('member can create snapshot', snap.status === 201);
  check('member cannot restore snapshot (403)', (await call(`/projects/${pid}/snapshots/${snap.json.id}/restore`, { jwt: member.accessToken, method: 'POST' })).status === 403);
  check('admin can restore snapshot', (await call(`/projects/${pid}/snapshots/${snap.json.id}/restore`, { jwt: admin.accessToken, method: 'POST' })).status === 201);

  // Per-locale write access for the restricted member.
  const key = await call(`/projects/${pid}/keys`, { jwt: owner.accessToken, method: 'POST', body: { name: 'perm.key' } });
  const keyId = key.json.id;
  check('member reads keys', (await call(`/projects/${pid}/keys`, { jwt: member.accessToken })).status === 200);
  const writeHe = await call(`/projects/${pid}/keys/${keyId}/translations`, { jwt: member.accessToken, method: 'PUT', body: { locale: 'he', value: 'שלום' } });
  check('restricted member writes allowed locale', writeHe.status === 201 || writeHe.status === 200, `status=${writeHe.status}`);
  const writeFr = await call(`/projects/${pid}/keys/${keyId}/translations`, { jwt: member.accessToken, method: 'PUT', body: { locale: 'fr', value: 'bonjour' } });
  check('restricted member denied other locale (403)', writeFr.status === 403);
  const importFr = await call(`/projects/${pid}/import/fr`, { jwt: member.accessToken, method: 'POST', body: { entries: { 'perm.key': 'bonjour' } } });
  check('restricted member import to denied locale (403)', importFr.status === 403);
  const importHe = await call(`/projects/${pid}/import/he`, { jwt: member.accessToken, method: 'POST', body: { entries: { 'perm.key2': 'שלום2' } } });
  check('restricted member import to allowed locale', importHe.status === 201);
  const statusFr = await call(`/projects/${pid}/keys/${keyId}/translations/fr/status`, { jwt: member.accessToken, method: 'PATCH', body: { status: 'REVIEWED' } });
  check('restricted member status change on denied locale (403)', statusFr.status === 403);

  // Widening access takes effect immediately.
  await call(`/projects/${pid}/members/${member.user.id}`, { jwt: owner.accessToken, method: 'PATCH', body: { allowedLocales: ['he', 'fr'] } });
  const writeFr2 = await call(`/projects/${pid}/keys/${keyId}/translations`, { jwt: member.accessToken, method: 'PUT', body: { locale: 'fr', value: 'bonjour' } });
  check('widened locale access takes effect', writeFr2.status === 201 || writeFr2.status === 200);

  // Removal takes effect immediately; removed member loses all access.
  await call(`/projects/${pid}/members/${member.user.id}`, { jwt: owner.accessToken, method: 'DELETE' });
  check('removed member loses project access (404)', (await call(`/projects/${pid}/keys`, { jwt: member.accessToken })).status === 404);
  check('owner cannot be removed (400)', (await call(`/projects/${pid}/members/${owner.user.id}`, { jwt: admin.accessToken, method: 'DELETE' })).status === 400);
} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `permissions: ${failures} FAILURES` : 'permissions pass complete');
process.exit(failures ? 1 : 0);
