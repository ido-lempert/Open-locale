// CSV import/export: real PostgreSQL + real HTTP API. Run: node scripts/formats-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55446, API_PORT = 3013;
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

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-fmt-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_fmt');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_fmt`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'fmt-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@fmt.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@fmt.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'FMT', slug: 'fmt', locales: ['en', 'he'] } })).json;
  const P = `/projects/${proj.id}`;

  // Seed via CSV import (with header row and quoted specials)
  const csvIn = 'key,value\napp.title,"My App"\nmsg.quote,"He said ""hi"", loudly"\nmsg.multi,"line1\nline2"\n';
  const imp = await call(`${P}/import/en`, { token: at, method: 'POST', body: { csv: csvIn } });
  check('CSV import accepted', imp.status === 201 && imp.json.translationsUpserted === 3, JSON.stringify(imp.json));

  const exp = await fetch(`${API}${P}/export/en/csv`, { headers: { Authorization: `Bearer ${at}` } });
  const text = await exp.text();
  check('CSV export content-type', (exp.headers.get('content-type') || '').includes('text/csv'));
  check('CSV export round-trips specials', text.startsWith('key,value\r\n') && text.includes('"He said ""hi"", loudly"') && text.includes('"line1\nline2"'), JSON.stringify(text.slice(0, 80)));

  // Import into he without header
  const impHe = await call(`${P}/import/he`, { token: at, method: 'POST', body: { csv: 'app.title,האפליקציה\nmsg.quote,ציטוט\n' } });
  check('headerless CSV import works', impHe.status === 201 && impHe.json.translationsUpserted === 2, JSON.stringify(impHe.json));

  const heText = await (await fetch(`${API}${P}/export/he/csv`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('CSV export he has unicode values', heText.includes('app.title,האפליקציה'), heText.slice(0, 60));

  const threeCol = await call(`${P}/import/en`, { token: at, method: 'POST', body: { csv: 'a,b,c\n' } });
  check('3-column row rejected (400)', threeCol.status === 400, String(threeCol.status));

  const cross = await fetch(`${API}${P}/export/en/csv`, { headers: { Authorization: `Bearer ${bt}` } });
  const crossImp = await call(`${P}/import/en`, { token: bt, method: 'POST', body: { csv: 'x,y\n' } });
  check('cross-team CSV export/import denied', cross.status === 404 && crossImp.status === 404, `${cross.status}/${crossImp.status}`);

  // Formula-injection: default export shields, raw mode preserves, import is verbatim
  await call(`${P}/import/en`, { token: at, method: 'POST', body: { entries: { 'evil.formula': '=HYPERLINK("http://x")' } } });
  const safeText = await (await fetch(`${API}${P}/export/en/csv`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('default CSV export shields formula values', safeText.includes("'=HYPERLINK"), safeText.split('\n').find((l) => l.includes('evil')) ?? '');
  const rawText = await (await fetch(`${API}${P}/export/en/csv?mode=raw`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('raw mode preserves formula values losslessly', rawText.includes('evil.formula,"=HYPERLINK') && !rawText.includes("'=HYPERLINK"), rawText.split('\n').find((l) => l.includes('evil')) ?? '');
  await call(`${P}/import/en`, { token: at, method: 'POST', body: { csv: rawText } });
  const roundtrip = await (await fetch(`${API}${P}/export/en/csv?mode=raw`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('raw export-import roundtrip is lossless', roundtrip === rawText);

  const runs = (await call(`${P}/imports`, { token: at })).json;
  check('CSV imports recorded as import runs', Array.isArray(runs) ? runs.length >= 2 : (runs.items?.length ?? 0) >= 2, JSON.stringify(runs).slice(0, 120));

} finally {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('All CSV format checks passed');
