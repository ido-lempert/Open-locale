// Screenshots on keys: real PostgreSQL + real HTTP API. Run: node scripts/screenshots-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55440, API_PORT = 3007;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
// 1x1 transparent PNG and 1x1 GIF89a
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const GIF = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

function auth(token, apiKey) {
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (apiKey) h['X-Api-Key'] = apiKey;
  return h;
}
async function json(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function upload(path, { token, apiKey, bytes, filename, mime, noFile } = {}) {
  const form = new FormData();
  if (!noFile) form.append('file', new Blob([bytes], { type: mime }), filename);
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: auth(token, apiKey), body: form });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function raw(path, token) {
  const res = await fetch(`${API}${path}`, { headers: auth(token) });
  return { status: res.status, headers: res.headers, body: Buffer.from(await res.arrayBuffer()) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ss-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_ss');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_ss`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'ss-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await json('/auth/signup', { method: 'POST', body: { email: 'a@ss.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await json('/auth/signup', { method: 'POST', body: { email: 'b@ss.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await json('/projects', { token: at, method: 'POST', body: { name: 'SS', slug: 'ss', locales: ['en'] } })).json;
  const key = (await json(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'hero.title' } })).json;
  const base = `/projects/${proj.id}/keys/${key.id}/screenshots`;

  const ok = await upload(base, { token: at, bytes: PNG, filename: 'hero.png', mime: 'image/png' });
  check('png upload accepted', ok.status === 201 && ok.json.filename === 'hero.png', `got ${ok.status}`);
  const gif = await upload(base, { token: at, bytes: GIF, filename: 'anim.gif', mime: 'image/gif' });
  check('gif upload accepted', gif.status === 201, `got ${gif.status}`);

  const list = (await json(base, { token: at })).json;
  check('list returns metadata only', list.length === 2 && list[0].uploader?.displayName === 'Alice A' && list[0].data === undefined, JSON.stringify(list[0]));

  const got = await raw(`${base}/${ok.json.id}`, at);
  check('binary download matches upload', got.status === 200 && got.body.equals(PNG));
  check('download headers safe', got.headers.get('content-type') === 'image/png' && got.headers.get('x-content-type-options') === 'nosniff');

  const svg = await upload(base, { token: at, bytes: SVG, filename: 'evil.svg', mime: 'image/svg+xml' });
  check('svg rejected (400)', svg.status === 400, `got ${svg.status}`);
  const fake = await upload(base, { token: at, bytes: Buffer.from('<script>alert(1)</script>'), filename: 'fake.png', mime: 'image/png' });
  check('declared-png with non-image bytes rejected (400)', fake.status === 400, `got ${fake.status}`);
  const truncPng = await upload(base, { token: at, bytes: PNG.subarray(0, 30), filename: 'trunc.png', mime: 'image/png' });
  check('truncated png (header only) rejected (400)', truncPng.status === 400, `got ${truncPng.status}`);
  const noIend = await upload(base, { token: at, bytes: Buffer.concat([PNG.subarray(0, PNG.length - 12), Buffer.alloc(12, 0)]), filename: 'noiend.png', mime: 'image/png' });
  check('png without IEND trailer rejected (400)', noIend.status === 400, `got ${noIend.status}`);
  const truncGif = await upload(base, { token: at, bytes: GIF.subarray(0, GIF.length - 5), filename: 'trunc.gif', mime: 'image/gif' });
  check('truncated gif rejected (400)', truncGif.status === 400, `got ${truncGif.status}`);
  const big = await upload(base, { token: at, bytes: Buffer.alloc(2 * 1024 * 1024 + 1, 1), filename: 'big.png', mime: 'image/png' });
  check('over 2MB rejected', big.status === 400 || big.status === 413, `got ${big.status}`);
  const none = await upload(base, { token: at, noFile: true });
  check('missing file rejected (400)', none.status === 400, `got ${none.status}`);

  const ro = (await json('/auth/tokens', { token: at, method: 'POST', body: { name: 'ro', scopes: ['read'] } })).json;
  const roUp = await upload(base, { apiKey: ro.token, bytes: PNG, filename: 'ro.png', mime: 'image/png' });
  check('read-only token upload denied (403)', roUp.status === 403, `got ${roUp.status}`);

  const crossList = await json(base, { token: bt });
  const crossDown = await raw(`${base}/${ok.json.id}`, bt);
  const crossUp = await upload(base, { token: bt, bytes: PNG, filename: 'x.png', mime: 'image/png' });
  check('cross-team list/download/upload denied (404)', crossList.status === 404 && crossDown.status === 404 && crossUp.status === 404,
    `${crossList.status}/${crossDown.status}/${crossUp.status}`);

  const del = await json(`${base}/${gif.json.id}`, { token: at, method: 'DELETE' });
  check('delete works', del.status === 200);
  const after = (await json(base, { token: at })).json;
  check('deleted screenshot gone', after.length === 1);
  const gone = await raw(`${base}/${gif.json.id}`, at);
  check('deleted binary 404', gone.status === 404, `got ${gone.status}`);

  const feed = (await json(`/projects/${proj.id}/activity`, { token: at })).json;
  const acts = feed.items.map((e) => e.action);
  check('activity has screenshot.added + screenshot.deleted', acts.includes('screenshot.added') && acts.includes('screenshot.deleted'));
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
console.log('All screenshots checks passed');
process.exitCode = 0;
