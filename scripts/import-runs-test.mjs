// Import run integrity: real PostgreSQL + real HTTP API. Run: node scripts/import-runs-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55439, API_PORT = 3006;
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

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ir-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_ir');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_ir`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'ir-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@ir.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@ir.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'IR', slug: 'ir', locales: ['en', 'he'] } })).json;

  // Mid-batch failure: two good keys, two invalid values (number + array)
  const mixed = await call(`/projects/${proj.id}/import/he`, { token: at, method: 'POST',
    body: { locale: 'he', entries: { good: 'טוב', nested: { ok: 'בסדר' }, bad: 42, alsobad: ['x'] } } });
  check('mixed import reports partial', mixed.json.status === 'PARTIAL', JSON.stringify(mixed.json));
  check('mixed import counts: 2 upserted, 2 failed', mixed.json.translationsUpserted === 2 && mixed.json.failed === 2, JSON.stringify(mixed.json));
  check('failure names the rejected keys', /bad|alsobad/.test(mixed.json.error ?? ''), mixed.json.error);

  const runs = (await call(`/projects/${proj.id}/imports`, { token: at })).json;
  check('import runs endpoint lists the run', runs.length === 1 && runs[0].status === 'PARTIAL');
  check('run row counters match response', runs[0].translationsUpserted === 2 && runs[0].failed === 2 && runs[0].keysCreated === 2);
  check('run row carries actor', runs[0].actor?.displayName === 'Alice A');

  // Counters reconcile with actual data
  const exported = (await call(`/projects/${proj.id}/export/he`, { token: at })).json;
  check('counters reconcile with stored data', Object.keys(exported).length === 2 && exported.good === 'טוב');

  // Run row predates any key data: created before keys existed (durable audit of the attempt)
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const runRow = await prisma.importRun.findUnique({ where: { id: runs[0].id } });
  const firstKey = await prisma.key.findFirst({ where: { projectId: proj.id }, orderBy: { createdAt: 'asc' } });
  check('run row committed before/keys independent of crash', !!runRow && runRow.createdAt <= firstKey.createdAt);
  check('no key left in RUNNING state after completion', runRow.status === 'PARTIAL');

  // All-good import completes
  const clean = await call(`/projects/${proj.id}/import/en`, { token: at, method: 'POST',
    body: { locale: 'en', entries: { hello: 'Hello' } } });
  check('clean import completes', clean.json.status === 'COMPLETED' && clean.json.failed === 0, JSON.stringify(clean.json));

  // Identical re-import: unchanged, still PARTIAL because bad values fail again
  const again = await call(`/projects/${proj.id}/import/he`, { token: at, method: 'POST',
    body: { locale: 'he', entries: { good: 'טוב', nested: { ok: 'בסדר' }, bad: 42, alsobad: ['x'] } } });
  check('re-import skips unchanged', again.json.unchangedSkipped === 2 && again.json.translationsUpserted === 0 && again.json.status === 'PARTIAL', JSON.stringify(again.json));

  // Activity feed carries the summary with failure counts (atomic with completion)
  const feed = (await call(`/projects/${proj.id}/activity?action=project.import`, { token: at })).json;
  check('activity summaries recorded for all 3 runs', feed.items.length === 3);
  const partialEv = feed.items.find((e) => e.detail.importId === runs[0].id);
  check('summary carries failed count + run id', !!partialEv && partialEv.detail.failed === 2, JSON.stringify(partialEv?.detail));

  // Cursor pagination tie-break: identical createdAt must not skip or repeat rows
  const sameTs = new Date('2026-10-28T12:00:00Z');
  for (let i = 0; i < 5; i++) {
    await prisma.activityEvent.create({ data: { projectId: proj.id, actorId: a.user.id, action: 'key.created', keyName: `tie.${i}`, createdAt: sameTs } });
  }
  await prisma.$disconnect();
  const seen = new Set();
  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const res = (await call(`/projects/${proj.id}/activity?action=key.created&limit=2${cursor ? `&cursor=${cursor}` : ''}`, { token: at })).json;
    for (const e of res.items) seen.add(e.id);
    cursor = res.nextCursor;
    if (!cursor) break;
  }
  const tieTotal = (await call(`/projects/${proj.id}/activity?action=key.created&limit=100`, { token: at })).json.items.length;
  check('cursor walk covers every row exactly once', seen.size === tieTotal, `${seen.size}/${tieTotal}`);

  const cross = await call(`/projects/${proj.id}/imports`, { token: bt });
  check('cross-team import runs denied (404)', cross.status === 404, `got ${cross.status}`);
} finally {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('All import-runs checks passed');
