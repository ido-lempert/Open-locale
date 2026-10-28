// Statuses + history: real PostgreSQL + real HTTP API.
// Run: node scripts/status-history-test.mjs (requires nx build api)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55435;
const API_PORT = 3002;
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

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-sh-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_sh');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_sh`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe',
  });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'sh-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@sh.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@sh.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const proj = (await call('/projects', { token: a.accessToken, method: 'POST', body: { name: 'SH', slug: 'sh', locales: ['en', 'he'] } })).json;
  const key = (await call(`/projects/${proj.id}/keys`, { token: a.accessToken, method: 'POST', body: { name: 'greet' } })).json;
  const t = () => `/projects/${proj.id}/keys/${key.id}`;

  const up1 = await call(`${t()}/translations`, { token: a.accessToken, method: 'PUT', body: { locale: 'en', value: 'Hello' } });
  check('new translation starts UNVERIFIED', up1.json?.status === 'UNVERIFIED', up1.json?.status);
  let hist = (await call(`${t()}/translations/en/history`, { token: a.accessToken })).json;
  check('first write records history with actor', hist.length === 1 && hist[0].changedBy?.displayName === 'Alice A' && hist[0].status === 'UNVERIFIED');

  await call(`${t()}/translations`, { token: a.accessToken, method: 'PUT', body: { locale: 'en', value: 'Hello' } });
  hist = (await call(`${t()}/translations/en/history`, { token: a.accessToken })).json;
  check('re-saving identical value adds no history', hist.length === 1, `len=${hist.length}`);

  const st = await call(`${t()}/translations/en/status`, { token: a.accessToken, method: 'PATCH', body: { status: 'TRANSLATED' } });
  check('status change applies', st.json?.status === 'TRANSLATED');
  const badStatus = await call(`${t()}/translations/en/status`, { token: a.accessToken, method: 'PATCH', body: { status: 'PUBLISHED' } });
  check('invalid status rejected (400)', badStatus.status === 400, `got ${badStatus.status}`);

  const up2 = await call(`${t()}/translations`, { token: a.accessToken, method: 'PUT', body: { locale: 'en', value: 'Hello!' } });
  check('editing text resets status to UNVERIFIED', up2.json?.status === 'UNVERIFIED', up2.json?.status);
  hist = (await call(`${t()}/translations/en/history`, { token: a.accessToken })).json;
  check('history holds full sequence (3 entries, newest first)',
    hist.length === 3 && hist[0].value === 'Hello!' && hist[1].status === 'TRANSLATED' && hist[2].value === 'Hello',
    JSON.stringify(hist.map((h) => [h.value, h.status])));

  // Import integrity: reviewed -> imported change must reset review and preserve lineage
  const k2 = (await call(`/projects/${proj.id}/keys`, { token: a.accessToken, method: 'POST', body: { name: 'imp.a' } })).json;
  await call(`/projects/${proj.id}/keys/${k2.id}/translations`, { token: a.accessToken, method: 'PUT', body: { locale: 'en', value: 'Old' } });
  await call(`/projects/${proj.id}/keys/${k2.id}/translations/en/status`, { token: a.accessToken, method: 'PATCH', body: { status: 'REVIEWED' } });
  const imp1 = (await call(`/projects/${proj.id}/import/en`, { token: a.accessToken, method: 'POST', body: { locale: 'en', entries: { imp: { a: 'New', b: 'Fresh' } } } })).json;
  check('import reports counts and batch id', imp1.translationsUpserted === 2 && imp1.unchangedSkipped === 0 && Boolean(imp1.importId), JSON.stringify(imp1));
  const afterImp = (await call(`/projects/${proj.id}/keys`, { token: a.accessToken })).json.find((x) => x.name === 'imp.a');
  const impTx = afterImp.translations.find((x) => x.localeCode === 'en');
  check('imported change resets REVIEWED to UNVERIFIED', impTx.status === 'UNVERIFIED', impTx.status);
  const impHist = (await call(`/projects/${proj.id}/keys/${k2.id}/translations/en/history`, { token: a.accessToken })).json;
  const top = impHist[0];
  check('import history keeps old and new values with batch id',
    top.value === 'New' && top.previousValue === 'Old' && top.importId === imp1.importId && top.status === 'UNVERIFIED',
    JSON.stringify(top));
  const newKeyHist = (await call(`/projects/${proj.id}/keys/${afterImp ? (await call(`/projects/${proj.id}/keys`, { token: a.accessToken })).json.find((x) => x.name === 'imp.b').id : ''}/translations/en/history`, { token: a.accessToken })).json;
  check('import-created key has previousValue null', newKeyHist.length === 1 && newKeyHist[0].previousValue === null && newKeyHist[0].importId === imp1.importId);

  const before2 = impHist.length;
  const imp2 = (await call(`/projects/${proj.id}/import/en`, { token: a.accessToken, method: 'POST', body: { locale: 'en', entries: { imp: { a: 'New', b: 'Fresh' } } } })).json;
  const after2 = (await call(`/projects/${proj.id}/keys/${k2.id}/translations/en/history`, { token: a.accessToken })).json;
  check('identical re-import is a no-op (skipped, no new history)',
    imp2.translationsUpserted === 0 && imp2.unchangedSkipped === 2 && after2.length === before2,
    JSON.stringify(imp2));

  const bStatus = await call(`${t()}/translations/en/status`, { token: b.accessToken, method: 'PATCH', body: { status: 'REVIEWED' } });
  const bHist = await call(`${t()}/translations/en/history`, { token: b.accessToken });
  check('cross-team status change denied (404)', bStatus.status === 404, `got ${bStatus.status}`);
  check('cross-team history read denied (404)', bHist.status === 404, `got ${bHist.status}`);
} finally {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('All status/history checks passed');
