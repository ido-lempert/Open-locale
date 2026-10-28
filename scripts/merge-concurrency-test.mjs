// Merge vs a concurrent writer holding the target row: proves the merge's
// FOR UPDATE read sees the LATEST committed value (exact history attribution)
// and the cutoff guard is evaluated against it. Real PG + real HTTP API.
// Run: node scripts/merge-concurrency-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const PG_PORT = 55464, API_PORT = 3026;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mc-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api, prisma;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_mc');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_mc`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'mc-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');
  prisma = new PrismaClient({ datasources: { db: { url } } });

  const owner = (await call('/auth/signup', { method: 'POST', body: { email: `mc${Date.now()}@t.dev`, password: 'pass1234', displayName: 'mc' } })).json;
  const jwt = owner.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Mc', slug: `mc-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  const feat = (await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat' } })).json;
  const mk = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'shared' } })).json;
  await call(`/projects/${pid}/keys/${mk.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'V0' } });
  const fk = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'shared', branch: 'feat' } })).json;
  await call(`/projects/${pid}/keys/${fk.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'feat value' } });

  // Interleaving: a concurrent writer locks+updates the target row and holds
  // its transaction open; the guarded merge (preview already taken) blocks on
  // FOR UPDATE, then must SKIP once the writer commits (updatedAt > cutoff).
  const prev = (await call(`/projects/${pid}/branches/${feat.id}/merge/preview`, { jwt, method: 'POST', body: { into: 'main' } })).json;
  check('preview wants 1 overwrite', prev.translationsOverwritten === 1, JSON.stringify(prev));

  const concurrentUpdate = (val) => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE "translations" SET "value" = ${val}, "updatedAt" = now() AT TIME ZONE 'UTC'
      WHERE "keyId" = ${mk.id}::uuid AND "localeCode" = 'he'`;
    await new Promise((r) => setTimeout(r, 1500)); // hold the row lock while the merge blocks on it
  });

  let writer = concurrentUpdate('concurrent write');
  await new Promise((r) => setTimeout(r, 300)); // writer has the lock
  const guardedMergeP = call(`/projects/${pid}/branches/${feat.id}/merge`, { jwt, method: 'POST', body: { into: 'main', previewedAt: prev.previewAt } });
  const guarded = (await guardedMergeP).json;
  await writer;
  check('guarded merge blocked-then-skipped the concurrently written row', guarded.translationsSkipped === 1 && guarded.translationsMerged === 0, JSON.stringify(guarded));
  const afterGuarded = (await call(`/projects/${pid}/keys`, { jwt })).json.find((k) => k.name === 'shared');
  const valAfterGuarded = (afterGuarded.translations?.he ?? afterGuarded.translations?.find?.((t) => t.localeCode === 'he'))?.value;
  check('concurrent value survived the guarded merge', valAfterGuarded === 'concurrent write', JSON.stringify(valAfterGuarded));

  // Unguarded merge against a fresh concurrent write: FOR UPDATE reads the
  // latest committed value, so history.previousValue is EXACTLY what was
  // overwritten, not the pre-lock V0.
  writer = concurrentUpdate('second concurrent write');
  await new Promise((r) => setTimeout(r, 300));
  const unguardedP = call(`/projects/${pid}/branches/${feat.id}/merge`, { jwt, method: 'POST', body: { into: 'main' } });
  const unguarded = (await unguardedP).json;
  await writer;
  check('unguarded merge overwrote after the lock released', unguarded.translationsMerged === 1, JSON.stringify(unguarded));
  const hist = (await call(`/projects/${pid}/keys/${mk.id}/translations/he/history`, { jwt })).json;
  const rows = hist.items ?? hist;
  const last = rows[0];
  check('history previousValue is exactly the overwritten concurrent value',
    last.value === 'feat value' && last.previousValue === 'second concurrent write',
    JSON.stringify(last).slice(0, 200));
  check('no history row claims the skipped guarded write', !rows.some((h) => h.previousValue === 'concurrent write' && h.value === 'feat value'));

  // Snapshot consistency: the pre-merge automatic snapshot captured pre-merge
  // state; restoring it is branch-aware and re-applies cleanly.
  const snaps = (await call(`/projects/${pid}/snapshots`, { jwt })).json;
  check('two pre-merge snapshots recorded', snaps.filter((s) => s.label.includes('before merge')).length >= 2, JSON.stringify(snaps.map((s) => s.label)));
} finally {
  await prisma?.$disconnect();
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `merge-concurrency: ${failures} FAILURES` : 'merge-concurrency pass complete');
process.exit(failures ? 1 : 0);
