// SDK: real PostgreSQL + real HTTP API, exercising libs/sdk end to end.
// Run: node scripts/sdk-test.mjs   (requires: nx build api)
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { createClient, OpenLocaleError } from '../libs/sdk/src/index.mjs';

const PG_PORT = 55471, API_PORT = 3021;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = new URL('..', import.meta.url).pathname;
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${detail}`); }
};
const call = async (path, { method = 'GET', body, token } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-sdk-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_sdk');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_sdk`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'sdk-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@sdk.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const proj = (await call('/projects', { token: a.accessToken, method: 'POST', body: { name: 'SDK Shop', slug: 'sdk-shop', locales: ['en', 'he'] } })).json;
  const tok = (await call('/auth/tokens', { token: a.accessToken, method: 'POST', body: { name: 'sdk', scopes: ['read', 'write'] } })).json;

  const ol = createClient({ url: `http://127.0.0.1:${API_PORT}`, token: tok.token });

  check('client requires url and token', (() => { try { createClient({ url: '', token: 'x' }); return false; } catch (e) { return e instanceof OpenLocaleError; } })()
    && (() => { try { createClient({ url: 'http://x', token: '' }); return false; } catch (e) { return e instanceof OpenLocaleError; } })());

  const projects = await ol.projects.list();
  check('projects.list returns the project', projects.some((p) => p.slug === 'sdk-shop'), JSON.stringify(projects).slice(0, 120));

  const key = await ol.keys.create(proj.id, 'sdk.greeting', { description: 'from the sdk' });
  check('keys.create lands', key.name === 'sdk.greeting' && !!key.id, JSON.stringify(key).slice(0, 120));
  const keys = await ol.keys.list(proj.id, { search: 'greeting' });
  check('keys.list with search finds it', keys.length === 1 && keys[0].name === 'sdk.greeting', JSON.stringify(keys).slice(0, 120));

  await ol.translations.put(proj.id, key.id, 'en', 'Hello from the SDK');
  await ol.translations.put(proj.id, key.id, 'he', 'שלום מה-SDK');
  const en = await ol.translations.get(proj.id, 'en');
  check('translations.get returns the flat map', en['sdk.greeting'] === 'Hello from the SDK', JSON.stringify(en).slice(0, 120));

  const imp = await ol.io.importEntries(proj.id, 'he', { 'sdk.second': 'שני' });
  check('io.importEntries imports', imp.status === 'COMPLETED' && imp.translationsUpserted === 1, JSON.stringify(imp));
  const dry = await ol.io.importEntries(proj.id, 'he', { 'sdk.third': 'שלישי' }, { dryRun: true });
  const heAfterDry = await ol.translations.get(proj.id, 'he');
  check('io.importEntries dryRun previews without writing', dry.dryRun === true && heAfterDry['sdk.third'] === undefined, JSON.stringify(dry));

  const po = await ol.io.exportText(proj.id, 'he', 'po');
  check('io.exportText returns the format body', po.includes('msgid "sdk.greeting"') && po.includes('msgstr "שלום מה-SDK"'), po.split('\n').find((l) => l.includes('sdk.greeting')) ?? '');

  // Branch scoping through the same client.
  await call(`/projects/${proj.id}/branches`, { token: a.accessToken, method: 'POST', body: { name: 'sdk-branch' } });
  await ol.io.importEntries(proj.id, 'he', { 'sdk.branchonly': 'ענף' }, { branch: 'sdk-branch' });
  const mainHe = await ol.translations.get(proj.id, 'he');
  const brHe = await ol.translations.get(proj.id, 'he', { branch: 'sdk-branch' });
  check('branch option scopes import and export', mainHe['sdk.branchonly'] === undefined && brHe['sdk.branchonly'] === 'ענף', '');

  // Errors carry status and path, not just a message.
  const err = await ol.projects.get('00000000-0000-0000-0000-000000000000').then(() => null).catch((e) => e);
  check('errors are OpenLocaleError with status and path', err instanceof OpenLocaleError && err.status === 404 && err.path.includes('/projects/'), String(err));

  const badAuth = createClient({ url: `http://127.0.0.1:${API_PORT}`, token: 'wrong-token' });
  const authErr = await badAuth.projects.list().then(() => null).catch((e) => e);
  check('bad token surfaces 401', authErr instanceof OpenLocaleError && authErr.status === 401, String(authErr));
} catch (err) {
  console.log('FAIL suite aborted', err);
  fail++;
} finally {
  try { api?.kill('SIGKILL'); } catch { }
  try { await pg.stop(); } catch { }
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(`DONE pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
