// Glossary: real PostgreSQL + real HTTP API. Run: node scripts/glossary-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55443, API_PORT = 3010;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { token, apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-gl-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_gl');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_gl`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'gl-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@gl.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@gl.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'GL', slug: 'gl', locales: ['en', 'he', 'de'] } })).json;
  const base = `/projects/${proj.id}/glossary`;

  const t1 = (await call(base, { token: at, method: 'POST', body: { term: 'checkout', notes: 'Payment flow', translations: { he: 'קופה', de: 'Kasse', fr: 'ignored?' } } })).json;
  check('unknown locale in translations rejected', !t1.id, JSON.stringify(t1).slice(0, 60));
  const t2 = (await call(base, { token: at, method: 'POST', body: { term: 'checkout', notes: 'Payment flow', translations: { he: 'קופה', de: 'Kasse' } } })).json;
  check('term created with translations', t2.term === 'checkout' && t2.translations.he === 'קופה');
  const dupe = await call(base, { token: at, method: 'POST', body: { term: 'Checkout' } });
  check('duplicate term (case-insensitive) rejected (409)', dupe.status === 409, `got ${dupe.status}`);
  const empty = await call(base, { token: at, method: 'POST', body: { term: '   ' } });
  check('whitespace-only term rejected (400)', empty.status === 400, `got ${empty.status}`);
  const badType = await call(base, { token: at, method: 'POST', body: { term: 'x', translations: { he: 5 } } });
  check('non-string translation rejected (400)', badType.status === 400, `got ${badType.status}`);

  const dnt = (await call(base, { token: at, method: 'POST', body: { term: 'Open-locale', doNotTranslate: true } })).json;
  check('do-not-translate term created', dnt.doNotTranslate === true);

  const upd = (await call(`${base}/${t2.id}`, { token: at, method: 'PATCH', body: { translations: { he: 'קופה ראשית', de: '' } } })).json;
  check('update replaces translations, empties dropped', upd.translations.he === 'קופה ראשית' && !('de' in upd.translations), JSON.stringify(upd.translations));

  const list = (await call(base, { token: at })).json;
  const terms = list.map((t) => t.term);
  check('list sorted deterministically', list.length === 2 && terms.join('|') === [...terms].sort().join('|'), terms.join('|'));

  const ro = (await call('/auth/tokens', { token: at, method: 'POST', body: { name: 'ro', scopes: ['read'] } })).json;
  const roRead = await call(base, { apiKey: ro.token });
  const roWrite = await call(base, { apiKey: ro.token, method: 'POST', body: { term: 'x' } });
  check('read-only token: list 200 / create 403', roRead.status === 200 && roWrite.status === 403, `${roRead.status}/${roWrite.status}`);

  const cross = await call(base, { token: bt });
  const crossWrite = await call(base, { token: bt, method: 'POST', body: { term: 'x' } });
  check('cross-team list/create denied (404)', cross.status === 404 && crossWrite.status === 404, `${cross.status}/${crossWrite.status}`);

  const del = await call(`${base}/${dnt.id}`, { token: at, method: 'DELETE' });
  check('delete works', del.status === 200);
  const after = (await call(base, { token: at })).json;
  check('deleted term gone', after.length === 1);

  // DB-level case-insensitive uniqueness (functional unique index closes the service-check race)
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/openlocale_gl` } } });
  try {
    await prisma.glossaryTerm.create({ data: { projectId: proj.id, term: 'CHECKOUT' } });
    check('DB rejects different-case duplicate term', false);
  } catch (e) {
    check('DB rejects different-case duplicate term', String(e.code ?? e).includes('P2002'), String(e.code ?? e));
  }
  const other = (await call('/projects', { token: at, method: 'POST', body: { name: 'GL2', slug: 'gl2', locales: ['en'] } })).json;
  const crossTerm = await call(`/projects/${other.id}/glossary`, { token: at, method: 'POST', body: { term: 'Checkout' } });
  check('same term allowed in another project', crossTerm.status === 201 || crossTerm.status === 200, String(crossTerm.status));
  await prisma.$disconnect();

  const feed = (await call(`/projects/${proj.id}/activity`, { token: at })).json;
  const acts = feed.items.map((e) => e.action);
  check('activity has glossary.created/updated/deleted',
    acts.includes('glossary.created') && acts.includes('glossary.updated') && acts.includes('glossary.deleted'));
} finally {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('All glossary checks passed');
