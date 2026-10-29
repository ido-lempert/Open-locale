// Reports: progress counts per locale/branch. Real PostgreSQL + real HTTP API.
// Run: node scripts/reports-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55466, API_PORT = 3028;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (token) headers['X-Api-Key'] = token;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-rp-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_rp');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_rp`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'rp-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const owner = (await call('/auth/signup', { method: 'POST', body: { email: `rp${Date.now()}@t.dev`, password: 'pass1234', displayName: 'rp' } })).json;
  const jwt = owner.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Rp', slug: `rp-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { customStatuses: ['NEEDS_FIX'] } });
  const k = async (name, branch) => (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name, branch } })).json;
  const put = async (id, locale, value, status) => {
    await call(`/projects/${pid}/keys/${id}/translations`, { jwt, method: 'PUT', body: { locale, value } });
    if (status) await call(`/projects/${pid}/keys/${id}/translations/${locale}/status`, { jwt, method: 'PATCH', body: { status } });
  };
  // main: 4 keys. en: 4 non-empty (2 REVIEWED, 1 TRANSLATED, 1 NEEDS_FIX).
  // he: 2 non-empty (1 REVIEWED, 1 UNVERIFIED), 1 empty, 1 missing.
  const [a, b, c, d] = [await k('k.a'), await k('k.b'), await k('k.c'), await k('k.d')];
  await put(a.id, 'en', 'A', 'REVIEWED'); await put(b.id, 'en', 'B', 'REVIEWED');
  await put(c.id, 'en', 'C', 'TRANSLATED'); await put(d.id, 'en', 'D', 'NEEDS_FIX');
  await put(a.id, 'he', 'א', 'REVIEWED'); await put(b.id, 'he', 'ב', 'UNVERIFIED');
  await put(c.id, 'he', ''); // empty: untranslated
  // d.he missing entirely: untranslated

  const r = (await call(`/projects/${pid}/reports/progress`, { jwt })).json;
  const en = r.locales.find((l) => l.locale === 'en');
  const he = r.locales.find((l) => l.locale === 'he');
  check('total keys on branch', r.totalKeys === 4 && r.branch === 'main', JSON.stringify({ total: r.totalKeys, branch: r.branch }));
  check('en: 4/4 translated, 100%, status breakdown',
    en.translated === 4 && en.untranslated === 0 && en.percent === 100 && en.byStatus.REVIEWED === 2 && en.byStatus.TRANSLATED === 1 && en.byStatus.NEEDS_FIX === 1,
    JSON.stringify(en));
  check('he: empty value and missing row both count untranslated',
    he.translated === 2 && he.untranslated === 2 && he.percent === 50 && he.byStatus.REVIEWED === 1 && he.byStatus.UNVERIFIED === 1,
    JSON.stringify(he));
  check('status counts add up per locale', en.translated === Object.values(en.byStatus).reduce((x, y) => x + y, 0) && he.translated === Object.values(he.byStatus).reduce((x, y) => x + y, 0));

  // Branch scoping: feat has its own independent numbers.
  await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat' } });
  const fa = await k('k.a', 'feat');
  await put(fa.id, 'he', 'ברנץ', 'TRANSLATED');
  const rf = (await call(`/projects/${pid}/reports/progress?branch=feat`, { jwt })).json;
  const fhe = rf.locales.find((l) => l.locale === 'he');
  check('feat progress independent: 1 key, he 1/1', rf.totalKeys === 1 && fhe.translated === 1 && fhe.percent === 100, JSON.stringify({ t: rf.totalKeys, he: fhe }));
  check('main progress unaffected by feat', (await call(`/projects/${pid}/reports/progress`, { jwt })).json.totalKeys === 4);
  check('unknown branch 404', (await call(`/projects/${pid}/reports/progress?branch=nope`, { jwt })).status === 404);

  // Access: member and read token can read; non-member and anonymous cannot.
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `rpm${Date.now()}@t.dev`, password: 'pass1234', displayName: 'rpm' } })).json;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email } });
  check('member can read progress', (await call(`/projects/${pid}/reports/progress`, { jwt: member.accessToken })).status === 200);
  const rtok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'sdk', scopes: ['read'] } })).json.token;
  check('read token can read progress', (await call(`/projects/${pid}/reports/progress`, { token: rtok })).status === 200);
  const out = (await call('/auth/signup', { method: 'POST', body: { email: `rpo${Date.now()}@t.dev`, password: 'pass1234', displayName: 'out' } })).json;
  check('non-member rejected', [403, 404].includes((await call(`/projects/${pid}/reports/progress`, { jwt: out.accessToken })).status));
  check('anonymous rejected (401)', (await fetch(`${API}/projects/${pid}/reports/progress`)).status === 401);
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `reports: ${failures} FAILURES` : 'reports pass complete');
process.exit(failures ? 1 : 0);
