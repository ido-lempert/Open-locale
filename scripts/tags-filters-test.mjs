// Tags + filters: real PostgreSQL + real HTTP API. Run: node scripts/tags-filters-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55436, API_PORT = 3003;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tf-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_tf');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_tf`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'tf-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@tf.io', password: 'password-a', displayName: 'A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@tf.io', password: 'password-b', displayName: 'B' } })).json;
  const at = a.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'TF', slug: 'tf', locales: ['en'] } })).json;
  const k1 = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'web.title', tags: ['web', 'homepage'] } })).json;
  const k2 = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'email.subject' } })).json;
  check('key created with tags', JSON.stringify(k1.tags) === JSON.stringify(['web', 'homepage']));

  const tagged = await call(`/projects/${proj.id}/keys?tag=web`, { token: at });
  check('filter by tag returns only tagged keys', tagged.json.length === 1 && tagged.json[0].name === 'web.title');

  const setRes = await call(`/projects/${proj.id}/keys/${k2.id}/tags`, { token: at, method: 'PATCH', body: { tags: [' email ', 'email', '', 'ops'] } });
  check('setTags trims, dedupes and drops empties', JSON.stringify(setRes.json.tags) === JSON.stringify(['email', 'ops']), JSON.stringify(setRes.json.tags));

  const tooMany = await call(`/projects/${proj.id}/keys/${k2.id}/tags`, { token: at, method: 'PATCH', body: { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) } });
  check('more than 20 tags rejected (400)', tooMany.status === 400, `got ${tooMany.status}`);
  const tooLong = await call(`/projects/${proj.id}/keys/${k2.id}/tags`, { token: at, method: 'PATCH', body: { tags: ['x'.repeat(41)] } });
  check('tag over 40 chars rejected (400)', tooLong.status === 400, `got ${tooLong.status}`);

  await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Hi' } });
  await call(`/projects/${proj.id}/keys/${k1.id}/translations/en/status`, { token: at, method: 'PATCH', body: { status: 'REVIEWED' } });
  const reviewed = await call(`/projects/${proj.id}/keys?status=REVIEWED&locale=en`, { token: at });
  check('filter by status+locale matches only reviewed', reviewed.json.length === 1 && reviewed.json[0].name === 'web.title');
  const unverified = await call(`/projects/${proj.id}/keys?status=UNVERIFIED&locale=en`, { token: at });
  check('filter by UNVERIFIED excludes reviewed key', !unverified.json.some((k) => k.name === 'web.title'));
  const combo = await call(`/projects/${proj.id}/keys?search=email&tag=ops`, { token: at });
  check('search + tag combine', combo.json.length === 1 && combo.json[0].name === 'email.subject');

  const bTags = await call(`/projects/${proj.id}/keys/${k1.id}/tags`, { token: b.accessToken, method: 'PATCH', body: { tags: ['evil'] } });
  check('cross-team setTags denied (404)', bTags.status === 404, `got ${bTags.status}`);
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
console.log('All tags/filters checks passed');
process.exitCode = 0;
