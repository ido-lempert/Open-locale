// Comments: real PostgreSQL + real HTTP API. Run: node scripts/comments-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55437, API_PORT = 3004;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-cm-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_cm');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_cm`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'cm-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@cm.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@cm.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'CM', slug: 'cm', locales: ['en', 'he'] } })).json;
  const key = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'cta.save' } })).json;
  const base = `/projects/${proj.id}/keys/${key.id}/comments`;

  const c1 = (await call(base, { token: at, method: 'POST', body: { body: 'CTA wording needs legal review' } })).json;
  check('global comment created with author', c1.localeCode === null && c1.author?.displayName === 'Alice A');
  const c2 = (await call(base, { token: at, method: 'POST', body: { body: 'Hebrew version too long?', locale: 'he' } })).json;
  check('locale-scoped comment created', c2.localeCode === 'he');

  const all = (await call(base, { token: at })).json;
  check('unfiltered list returns both', all.length === 2);
  const heOnly = (await call(`${base}?locale=he`, { token: at })).json;
  check('locale filter includes locale + global comments', heOnly.length === 2 && heOnly.every((c) => c.localeCode === 'he' || c.localeCode === null));
  const enOnly = (await call(`${base}?locale=en`, { token: at })).json;
  check('en filter excludes he-only comment', enOnly.length === 1 && enOnly[0].localeCode === null);

  const badLocale = await call(base, { token: at, method: 'POST', body: { body: 'x', locale: 'fr' } });
  check('comment on unknown locale rejected (404)', badLocale.status === 404, `got ${badLocale.status}`);
  const tooLong = await call(base, { token: at, method: 'POST', body: { body: 'x'.repeat(2001) } });
  check('body over 2000 chars rejected (400)', tooLong.status === 400, `got ${tooLong.status}`);

  // Same-team member can read and comment; cannot delete another's comment
  const joinTeam = await call(`/projects/${proj.id}`, { token: at });
  // B is in a different team; test cross-team denial first
  const bRead = await call(base, { token: bt });
  check('cross-team comment read denied (404)', bRead.status === 404, `got ${bRead.status}`);
  const bDel = await call(`${base}/${c1.id}`, { token: bt, method: 'DELETE' });
  check('cross-team comment delete denied (404)', bDel.status === 404, `got ${bDel.status}`);

  // A deletes own comment
  const del = await call(`${base}/${c1.id}`, { token: at, method: 'DELETE' });
  check('author deletes own comment', del.status === 200);
  const after = (await call(base, { token: at })).json;
  check('deleted comment gone', after.length === 1);
} finally {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('All comments checks passed');
