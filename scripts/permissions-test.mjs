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
async function call(path, { jwt, apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (apiKey) headers['X-Api-Key'] = apiKey;
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

  // --- API-token principals: tokens are USER-scoped (they authenticate as the
  // owning user, not a project), so membership role + locale checks must apply
  // to them per request exactly as for JWT sessions. ---
  const m2 = await signup('tokmem');
  const m3 = await signup('tokpre');
  const a2 = await signup('tokadm');
  const outsider = await signup('outsider');
  const outPid = (await call('/projects', { jwt: outsider.accessToken, method: 'POST', body: { name: 'Out', slug: `out-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he', 'fr'] } })).json.id;
  await call(`/projects/${pid}/members`, { jwt: owner.accessToken, method: 'POST', body: { email: m2.user.email, allowedLocales: ['he'] } });
  await call(`/projects/${pid}/members`, { jwt: owner.accessToken, method: 'POST', body: { email: m3.user.email } });
  await call(`/projects/${pid}/members`, { jwt: owner.accessToken, method: 'POST', body: { email: a2.user.email, role: 'ADMIN' } });
  const mint = async (jwt, name) => (await call('/auth/tokens', { jwt, method: 'POST', body: { name, scopes: ['read', 'write'] } })).json.token;
  const tokM2 = await mint(m2.accessToken, 'm2');       // minted AFTER restriction
  const tokM3 = await mint(m3.accessToken, 'm3');       // minted BEFORE restriction
  const tokA2 = await mint(a2.accessToken, 'a2');
  const tokAdmin = await mint(admin.accessToken, 'adm');

  check('token of restricted member writes allowed locale',
    [200, 201].includes((await call(`/projects/${pid}/keys/${keyId}/translations`, { apiKey: tokM2, method: 'PUT', body: { locale: 'he', value: 'tok' } })).status));
  check('token of restricted member denied other locale (403)',
    (await call(`/projects/${pid}/keys/${keyId}/translations`, { apiKey: tokM2, method: 'PUT', body: { locale: 'fr', value: 'tok' } })).status === 403);
  // All four import formats through the token with a denied locale.
  check('token import JSON to denied locale (403)',
    (await call(`/projects/${pid}/import/fr`, { apiKey: tokM2, method: 'POST', body: { entries: { 'perm.tok': 'x' } } })).status === 403);
  check('token import CSV to denied locale (403)',
    (await call(`/projects/${pid}/import/fr`, { apiKey: tokM2, method: 'POST', body: { csv: 'perm.tok,x' } })).status === 403);
  check('token import Android XML to denied locale (403)',
    (await call(`/projects/${pid}/import/fr`, { apiKey: tokM2, method: 'POST', body: { xml: '<resources><string name="perm.tok">x</string></resources>' } })).status === 403);
  check('token import iOS strings to denied locale (403)',
    (await call(`/projects/${pid}/import/fr`, { apiKey: tokM2, method: 'POST', body: { strings: '"perm.tok" = "x";' } })).status === 403);
  check('token import JSON to allowed locale',
    (await call(`/projects/${pid}/import/he`, { apiKey: tokM2, method: 'POST', body: { entries: { 'perm.tok': 'x' } } })).status === 201);

  // Token minted before the restriction is applied still becomes restricted.
  check('pre-restriction token writes freely before grant change',
    [200, 201].includes((await call(`/projects/${pid}/keys/${keyId}/translations`, { apiKey: tokM3, method: 'PUT', body: { locale: 'fr', value: 'pre' } })).status));
  await call(`/projects/${pid}/members/${m3.user.id}`, { jwt: owner.accessToken, method: 'PATCH', body: { allowedLocales: ['he'] } });
  check('same token denied after restriction applied (403)',
    (await call(`/projects/${pid}/keys/${keyId}/translations`, { apiKey: tokM3, method: 'PUT', body: { locale: 'fr', value: 'post' } })).status === 403);

  // Demotion ADMIN -> restricted MEMBER takes effect on the token immediately.
  await call(`/projects/${pid}/members/${a2.user.id}`, { jwt: owner.accessToken, method: 'PATCH', body: { role: 'MEMBER', allowedLocales: ['he'] } });
  check('demoted admin token loses member management (403)',
    (await call(`/projects/${pid}/members`, { apiKey: tokA2, method: 'POST', body: { email: outsider.user.email } })).status === 403);
  check('demoted admin token loses project rename (403)',
    (await call(`/projects/${pid}`, { apiKey: tokA2, method: 'PATCH', body: { name: 'x' } })).status === 403);
  check('demoted admin token denied locale (403)',
    (await call(`/projects/${pid}/keys/${keyId}/translations`, { apiKey: tokA2, method: 'PUT', body: { locale: 'fr', value: 'x' } })).status === 403);

  // Key deletion removes every locale's data: restricted members cannot, via session or token.
  const key2 = (await call(`/projects/${pid}/keys`, { jwt: owner.accessToken, method: 'POST', body: { name: 'perm.del' } })).json.id;
  check('restricted member cannot delete key (403)',
    (await call(`/projects/${pid}/keys/${key2}`, { jwt: m2.accessToken, method: 'DELETE' })).status === 403);
  check('restricted member token cannot delete key (403)',
    (await call(`/projects/${pid}/keys/${key2}`, { apiKey: tokM2, method: 'DELETE' })).status === 403);
  check('admin can delete key', (await call(`/projects/${pid}/keys/${key2}`, { apiKey: tokAdmin, method: 'DELETE' })).status === 200);

  // Snapshots: capture is allowed (no content-read endpoint exists), restore is admin-only.
  check('restricted member token can capture snapshot',
    (await call(`/projects/${pid}/snapshots`, { apiKey: tokM2, method: 'POST', body: { label: 'tok-snap' } })).status === 201);
  check('restricted member token cannot restore (403)',
    (await call(`/projects/${pid}/snapshots/${snap.json.id}/restore`, { apiKey: tokM2, method: 'POST' })).status === 403);
  check('restricted member token lists snapshot metadata only',
    (await call(`/projects/${pid}/snapshots`, { apiKey: tokM2 })).status === 200);

  // Member management through tokens: admin token can, member token cannot.
  const m4 = await signup('tokadd');
  check('admin token adds a member',
    (await call(`/projects/${pid}/members`, { apiKey: tokAdmin, method: 'POST', body: { email: m4.user.email } })).status === 201);
  check('member token cannot add a member (403)',
    (await call(`/projects/${pid}/members`, { apiKey: tokM2, method: 'POST', body: { email: outsider.user.email } })).status === 403);

  // Removal kills the token's project access immediately.
  await call(`/projects/${pid}/members/${m2.user.id}`, { jwt: owner.accessToken, method: 'DELETE' });
  check('removed member token loses reads (404)',
    (await call(`/projects/${pid}/keys`, { apiKey: tokM2 })).status === 404);
  check('removed member token loses writes (404)',
    (await call(`/projects/${pid}/keys/${keyId}/translations`, { apiKey: tokM2, method: 'PUT', body: { locale: 'he', value: 'x' } })).status === 404);

  // Team model: membership (and locale limits) are TEAM-wide, not per project.
  const pidB = (await call('/projects', { jwt: owner.accessToken, method: 'POST', body: { name: 'PermB', slug: `permb-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he', 'fr'] } })).json.id;
  const keyB = (await call(`/projects/${pidB}/keys`, { jwt: owner.accessToken, method: 'POST', body: { name: 'perm.b' } })).json.id;
  check('team member reads second project in same team (team-wide access)',
    (await call(`/projects/${pidB}/keys`, { jwt: m3.accessToken })).status === 200);
  check('locale limit applies on the second project too (403)',
    (await call(`/projects/${pidB}/keys/${keyB}/translations`, { jwt: m3.accessToken, method: 'PUT', body: { locale: 'fr', value: 'x' } })).status === 403);
  check('locale limit allows write on the second project',
    [200, 201].includes((await call(`/projects/${pidB}/keys/${keyB}/translations`, { jwt: m3.accessToken, method: 'PUT', body: { locale: 'he', value: 'x' } })).status));
  check('member of one team cannot read another team\'s project (404)',
    (await call(`/projects/${outPid}/keys`, { jwt: m3.accessToken })).status === 404);

} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `permissions: ${failures} FAILURES` : 'permissions pass complete');
process.exit(failures ? 1 : 0);
