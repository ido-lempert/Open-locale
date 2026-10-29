// Activity log: real PostgreSQL + real HTTP API. Run: node scripts/activity-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55438, API_PORT = 3005;
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

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-act-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_act');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_act`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'act-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@act.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@act.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'ACT', slug: 'act', locales: ['en', 'he'] } })).json;
  const act = `/projects/${proj.id}/activity`;

  // Drive one of each auditable action
  const key = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'cta.save' } })).json;
  const upsertRes = await call(`/projects/${proj.id}/keys/${key.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Save now' } });
  check('translation upsert accepted', upsertRes.status === 200 || upsertRes.status === 201, `got ${upsertRes.status}`);
  await call(`/projects/${proj.id}/keys/${key.id}/translations/en/status`, { token: at, method: 'PATCH', body: { status: 'TRANSLATED' } });
  await call(`/projects/${proj.id}/keys/${key.id}/tags`, { token: at, method: 'PATCH', body: { tags: ['web'] } });
  const comment = (await call(`/projects/${proj.id}/keys/${key.id}/comments`, { token: at, method: 'POST', body: { body: 'note', locale: 'en' } })).json;
  await call(`/projects/${proj.id}/keys/${key.id}/comments/${comment.id}`, { token: at, method: 'DELETE' });
  await call(`/projects/${proj.id}`, { token: at, method: 'PATCH', body: { name: 'ACT Renamed' } });
  await call(`/projects/${proj.id}/locales`, { token: at, method: 'POST', body: { code: 'de' } });
  const imp = await call(`/projects/${proj.id}/import/he`, { token: at, method: 'POST', body: { locale: 'he', entries: { 'cta.save': 'שמור' } } });
  check('import accepted', imp.status === 200 || imp.status === 201, `got ${imp.status} ${JSON.stringify(imp.json)}`);
  await call(`/projects/${proj.id}/locales/de`, { token: at, method: 'DELETE' });

  // Failed mutation must leave no audit row
  const beforeFail = (await call(act, { token: at })).json.items.length;
  const bad = await call(`/projects/${proj.id}/keys/${key.id}/comments`, { token: at, method: 'POST', body: { body: 'x', locale: 'fr' } });
  check('comment with unknown locale rejected (404)', bad.status === 404, `got ${bad.status}`);
  const afterFail = (await call(act, { token: at })).json.items.length;
  check('failed mutation leaves no activity row', afterFail === beforeFail, `${beforeFail} -> ${afterFail}`);

  await call(`/projects/${proj.id}/keys/${key.id}`, { token: at, method: 'DELETE' });

  const feed = (await call(act, { token: at, method: 'GET' })).json;
  const actions = feed.items.map((e) => e.action);
  for (const expected of ['key.created', 'translation.value', 'translation.status', 'key.tags', 'comment.added', 'comment.deleted', 'project.renamed', 'project.import', 'locale.added', 'locale.removed', 'key.deleted']) {
    check(`feed includes ${expected}`, actions.includes(expected));
  }
  check('most recent first', feed.items[0].action === 'key.deleted', feed.items[0].action);
  check('actor name attached', feed.items.every((e) => e.actor?.displayName === 'Alice A'));
  const valEv = feed.items.find((e) => e.action === 'translation.value');
  check('value change carries old/new + key name', valEv.keyName === 'cta.save' && valEv.detail.value === 'Save now', JSON.stringify(valEv.detail));
  const impEv = feed.items.find((e) => e.action === 'project.import');
  check('import summary carries counts', impEv.detail.translationsUpserted === 1 && impEv.localeCode === 'he', JSON.stringify(impEv.detail));

  const onlyComments = (await call(`${act}?action=comment.added`, { token: at })).json;
  check('action filter returns only that action', onlyComments.items.length === 1 && onlyComments.items[0].action === 'comment.added');

  const page1 = (await call(`${act}?limit=3`, { token: at })).json;
  check('page 1 has 3 + cursor', page1.items.length === 3 && !!page1.nextCursor);
  const page2 = (await call(`${act}?limit=3&cursor=${page1.nextCursor}`, { token: at })).json;
  const ids1 = new Set(page1.items.map((e) => e.id));
  check('page 2 continues without overlap', page2.items.length >= 1 && page2.items.every((e) => !ids1.has(e.id)));
  check('pages stay in order', new Date(page1.items[2].createdAt) >= new Date(page2.items[0].createdAt));

  const cross = await call(act, { token: bt });
  check('cross-team activity read denied (404)', cross.status === 404, `got ${cross.status}`);
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
console.log('All activity checks passed');
process.exitCode = 0;
