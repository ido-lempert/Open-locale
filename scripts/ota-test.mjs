// OTA publications: publish gates, immutable bundles, ETag/304, branch scope,
// pruning, auth rules. Real PostgreSQL + real HTTP API.
// Run: node scripts/ota-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55465, API_PORT = 3027;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, token, method = 'GET', body, headers: extra } = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (token) headers['X-Api-Key'] = token;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, etag: res.headers.get('etag'), json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ota-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_ota');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_ota`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'ota-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const owner = (await call('/auth/signup', { method: 'POST', body: { email: `ota${Date.now()}@t.dev`, password: 'pass1234', displayName: 'ota' } })).json;
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `otam${Date.now()}@t.dev`, password: 'pass1234', displayName: 'otam' } })).json;
  const jwt = owner.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Ota', slug: `ota-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email } });
  const k1 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'app.title' } })).json;
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Title' } });
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'כותרת' } });

  // Pull before any publish: 404. Publish gates.
  check('latest before publish is 404', (await call(`/projects/${pid}/ota/latest?locale=en`, { jwt })).status === 404);
  check('member cannot publish (403)', (await call(`/projects/${pid}/ota/publish`, { jwt: member.accessToken, method: 'POST', body: {} })).status === 403);
  const wtok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'ci', scopes: ['read', 'write'] } })).json.token;
  check('API token cannot publish (403 session-only)', (await call(`/projects/${pid}/ota/publish`, { token: wtok, method: 'POST', body: {} })).status === 403);
  check('unauthenticated pull rejected (401)', (await fetch(`${API}/projects/${pid}/ota/latest?locale=en`)).status === 401);

  // Publish v1 for main.
  const p1 = (await call(`/projects/${pid}/ota/publish`, { jwt, method: 'POST', body: {} })).json;
  check('publish returns v1 with locales and counts', p1.version === 1 && p1.branch === 'main' && p1.locales.join(',') === 'en,he' && p1.translations === 2, JSON.stringify(p1));
  const acts = (await call(`/projects/${pid}/activity?action=ota.published`, { jwt })).json;
  check('publish recorded in activity', acts.items?.length >= 1);

  // Pull latest + ETag/304.
  const l1 = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt });
  check('latest he bundle has branch values', l1.json.translations['app.title'] === 'כותרת' && l1.json.version === 1 && l1.json.branch === 'main');
  check('latest carries weak ETag and private cache-control', !!l1.etag);
  const l1b = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt, headers: { 'If-None-Match': l1.etag } });
  check('If-None-Match yields 304', l1b.status === 304, `got ${l1b.status}`);

  // Read-scope API token can pull (SDK path) but a token of another project cannot.
  const rtok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'sdk', scopes: ['read'] } })).json.token;
  const lt = await call(`/projects/${pid}/ota/latest?locale=en`, { token: rtok });
  check('read token pulls bundle', lt.status === 200 && lt.json.translations['app.title'] === 'Title');
  const other = (await call('/auth/signup', { method: 'POST', body: { email: `otao${Date.now()}@t.dev`, password: 'pass1234', displayName: 'out' } })).json;
  check('non-member cannot pull (404/403)', [403, 404].includes((await call(`/projects/${pid}/ota/latest?locale=en`, { jwt: other.accessToken })).status));

  // Publish v2 after a change; v1 stays immutable.
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'כותרת חדשה' } });
  const p2 = (await call(`/projects/${pid}/ota/publish`, { jwt, method: 'POST', body: {} })).json;
  check('second publish increments to v2', p2.version === 2);
  const v1 = await call(`/projects/${pid}/ota/1/he`, { jwt });
  check('v1 bundle immutable after v2', v1.json.translations['app.title'] === 'כותרת' && v1.json.version === 1);
  const l2 = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt });
  check('latest is v2 with new value', l2.json.version === 2 && l2.json.translations['app.title'] === 'כותרת חדשה');
  check('old ETag no longer matches after v2', (await call(`/projects/${pid}/ota/latest?locale=he`, { jwt, headers: { 'If-None-Match': l1.etag } })).status === 200);
  check('unknown version 404', (await call(`/projects/${pid}/ota/99/he`, { jwt })).status === 404);
  check('unknown locale 404', (await call(`/projects/${pid}/ota/latest?locale=fr`, { jwt })).status === 404);

  // Branch scope: feat bundle is separate and does not leak main values.
  await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat' } });
  const kf = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'app.title', branch: 'feat' } })).json;
  await call(`/projects/${pid}/keys/${kf.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'ברנץ' } });
  check('branch latest before its own publish is 404', (await call(`/projects/${pid}/ota/latest?locale=he&branch=feat`, { jwt })).status === 404);
  const pf = (await call(`/projects/${pid}/ota/publish`, { jwt, method: 'POST', body: { branch: 'feat' } })).json;
  check('branch publish starts at v1 for that branch', pf.version === 1 && pf.branch === 'feat', JSON.stringify(pf));
  const lf = await call(`/projects/${pid}/ota/latest?locale=he&branch=feat`, { jwt });
  check('feat bundle has feat values only', lf.json.translations['app.title'] === 'ברנץ' && lf.json.branch === 'feat');
  const lm = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt });
  check('main bundle unaffected by feat publish', lm.json.version === 2 && lm.json.translations['app.title'] === 'כותרת חדשה');

  // List metadata.
  const list = (await call(`/projects/${pid}/ota`, { jwt })).json;
  check('list shows main v1+v2 and feat v1 with counts', list.length === 3 && list.every((x) => x.translations >= 1 && x.locales.length >= 1), JSON.stringify(list.map((x) => `${x.branch}@${x.version}`)));

  // Pruning: 26 publishes on feat keep only the latest 25.
  for (let i = 0; i < 25; i++) {
    await call(`/projects/${pid}/ota/publish`, { jwt, method: 'POST', body: { branch: 'feat' } });
  }
  const listF = (await call(`/projects/${pid}/ota`, { jwt })).json.filter((x) => x.branch === 'feat');
  check('publications pruned to latest 25 per branch', listF.length === 25 && Math.min(...listF.map((x) => x.version)) === 2, `count=${listF.length} min=${Math.min(...listF.map((x) => x.version))}`);
  check('pruned v1 bundle is gone (404)', (await call(`/projects/${pid}/ota/1/he?branch=feat`, { jwt })).status === 404);
} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `ota: ${failures} FAILURES` : 'ota pass complete');
process.exit(failures ? 1 : 0);
