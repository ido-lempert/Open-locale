// Translation memory: real PostgreSQL + real HTTP API. Run: node scripts/tm-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55442, API_PORT = 3009;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { token, apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tm-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_tm');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_tm`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'tm-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@tm.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@tm.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'TM', slug: 'tm', locales: ['en', 'he', 'de'] } })).json;
  const k1 = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'home.welcome' } })).json;
  const k2 = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'home.farewell' } })).json;
  const put = (keyId, locale, value) => call(`/projects/${proj.id}/keys/${keyId}/translations`, { token: at, method: 'PUT', body: { locale, value } });
  const suggest = (locale, source, token = at) => call(`/projects/${proj.id}/tm/suggest?locale=${locale}&source=${encodeURIComponent(source)}`, { token });

  await put(k1.id, 'en', 'Welcome to the shop');
  const baseOnly = await suggest('he', 'Welcome to the shop');
  check('saving base locale alone remembers nothing', baseOnly.json.suggestions.length === 0);

  await put(k1.id, 'he', 'ברוכים הבאים לחנות');
  const exact = await suggest('he', 'Welcome to the shop');
  check('exact match returns target at score 1', exact.json.suggestions[0]?.score === 1 && exact.json.suggestions[0]?.targetText === 'ברוכים הבאים לחנות', JSON.stringify(exact.json.suggestions[0]));

  await put(k1.id, 'he', 'ברוכים הבאים לחנות!');
  const updated = await suggest('he', 'Welcome to the shop');
  check('target update refreshes memory', updated.json.suggestions[0]?.targetText === 'ברוכים הבאים לחנות!');

  await put(k2.id, 'en', 'Welcome back');
  await put(k2.id, 'he', 'ברוכים השבים');
  const fuzzy = await suggest('he', 'Welcome back!');
  check('fuzzy match finds similar source', fuzzy.json.suggestions.some((s) => s.targetText === 'ברוכים השבים' && s.score >= 0.5 && s.score < 1), JSON.stringify(fuzzy.json.suggestions));

  const otherLocale = await suggest('de', 'Welcome to the shop');
  check('locales stay separate', otherLocale.json.suggestions.length === 0);

  await put(k1.id, 'he', '');
  const afterEmpty = await suggest('he', 'Welcome to the shop');
  check('empty target never overwrites memory', afterEmpty.json.suggestions[0]?.targetText === 'ברוכים הבאים לחנות!');

  const baseSuggest = await call(`/projects/${proj.id}/tm/suggest?locale=en&source=x`, { token: at });
  check('suggesting into the base locale rejected (400)', baseSuggest.status === 400, `got ${baseSuggest.status}`);

  const imp = await call(`/projects/${proj.id}/import/de`, { token: at, method: 'POST', body: { locale: 'de', entries: { 'home.welcome': 'Willkommen im Shop' } } });
  check('import accepted', imp.status === 201, `got ${imp.status}`);
  const fromImport = await suggest('de', 'Welcome to the shop');
  check('imported translations feed memory', fromImport.json.suggestions[0]?.targetText === 'Willkommen im Shop', JSON.stringify(fromImport.json.suggestions));

  const proj2 = (await call('/projects', { token: at, method: 'POST', body: { name: 'TM2', slug: 'tm2', locales: ['en', 'he'] } })).json;
  const isolated = await call(`/projects/${proj2.id}/tm/suggest?locale=he&source=${encodeURIComponent('Welcome to the shop')}`, { token: at });
  check('memory is project-scoped (tenant isolation)', isolated.json.suggestions.length === 0);

  const cross = await call(`/projects/${proj.id}/tm/suggest?locale=he&source=x`, { token: bt });
  check('cross-team suggest denied (404)', cross.status === 404, `got ${cross.status}`);

  const ro = (await call('/auth/tokens', { token: at, method: 'POST', body: { name: 'ro', scopes: ['read'] } })).json;
  const roSug = await call(`/projects/${proj.id}/tm/suggest?locale=he&source=Welcome`, { apiKey: ro.token });
  check('read-only token may suggest (200)', roSug.status === 200, `got ${roSug.status}`);

  // --- TMX export ---
  const k3 = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'special.chars' } })).json;
  await put(k3.id, 'en', 'A & B <C>');
  await put(k3.id, 'he', 'say "hi" & <b>');
  const tmxRes = await fetch(`${API}/projects/${proj.id}/tm/he/tmx`, { headers: { Authorization: `Bearer ${at}` } });
  const tmx = await tmxRes.text();
  check('TMX export: 1.4 header, srclang and a known he pair', tmxRes.status === 200 && tmx.includes('<tmx version="1.4">') && tmx.includes('srclang="en"') && tmx.includes('<tuv xml:lang="en"><seg>Welcome to the shop</seg></tuv>') && tmx.includes('<tuv xml:lang="he"><seg>ברוכים הבאים לחנות!</seg></tuv>'), tmx.split('\n').find((l) => l.includes('ברוכים')) ?? '');
  check('TMX export escapes markup and quotes in segments', tmx.includes('<seg>A &amp; B &lt;C&gt;</seg>') && tmx.includes('<seg>say "hi" &amp; &lt;b&gt;</seg>'), tmx.split('\n').find((l) => l.includes('amp')) ?? '');
  const tmxDe = await (await fetch(`${API}/projects/${proj.id}/tm/de/tmx`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('TMX export is per-locale (de pair only)', tmxDe.includes('Willkommen im Shop') && !tmxDe.includes('ברוכים הבאים'), '');
  const tmxBase = await call(`/projects/${proj.id}/tm/en/tmx`, { token: at });
  check('TMX export into the base locale rejected (400)', tmxBase.status === 400, `got ${tmxBase.status}`);
  const tmxCross = await call(`/projects/${proj.id}/tm/he/tmx`, { token: bt });
  check('cross-team TMX export denied (404)', tmxCross.status === 404, `got ${tmxCross.status}`);
  const k4 = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'untranslated.key' } })).json;
  await put(k4.id, 'en', 'No target yet');
  const tmxAfterK4 = await (await fetch(`${API}/projects/${proj.id}/tm/he/tmx`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('TMX export excludes keys with no target-locale memory', !tmxAfterK4.includes('No target yet'), '');
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
console.log('All TM checks passed');
process.exitCode = 0;
