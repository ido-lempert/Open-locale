// Review workflow: custom statuses + bulk review queue transitions.
// Real PostgreSQL + real HTTP API. Run: node scripts/review-workflow-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55456, API_PORT = 3022;
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

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-rev-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_rev');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_rev`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'rev-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const owner = (await call('/auth/signup', { method: 'POST', body: { email: `rev${Date.now()}@t.dev`, password: 'pass1234', displayName: 'rev' } })).json;
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `revm${Date.now()}@t.dev`, password: 'pass1234', displayName: 'revm' } })).json;
  const jwt = owner.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Rev', slug: `rev-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he', 'fr'] } })).json.id;
  const k1 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'rev.one' } })).json.id;
  const k2 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'rev.two' } })).json.id;
  for (const [k, l, v] of [[k1, 'he', 'א'], [k1, 'fr', 'a'], [k2, 'he', 'ב'], [k2, 'fr', 'b']]) {
    await call(`/projects/${pid}/keys/${k}/translations`, { jwt, method: 'PUT', body: { locale: l, value: v } });
  }

  // Custom statuses are admin-managed project settings.
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email, allowedLocales: ['he'] } });
  check('member cannot edit custom statuses (403)',
    (await call(`/projects/${pid}`, { jwt: member.accessToken, method: 'PATCH', body: { customStatuses: ['NEEDS_WORK'] } })).status === 403);
  const bad = await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { customStatuses: ['needs work'] } });
  check('invalid custom status name rejected (400)', bad.status === 400);
  const dup = await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { customStatuses: ['REVIEWED'] } });
  check('base status as custom rejected (400)', dup.status === 400);
  const set = await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { customStatuses: ['NEEDS_WORK', 'LEGAL_HOLD'] } });
  check('admin sets custom statuses', set.status === 200 && JSON.stringify(set.json.customStatuses) === '["NEEDS_WORK","LEGAL_HOLD"]', JSON.stringify(set.json.customStatuses));

  // Single status transition honors the project's list.
  check('custom status accepted on a translation',
    (await call(`/projects/${pid}/keys/${k1}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'NEEDS_WORK' } })).status === 200);
  check('unknown status rejected (400)',
    (await call(`/projects/${pid}/keys/${k1}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'MADE_UP' } })).status === 400);

  // Bulk queue transition: only the target locale, skips rows already there.
  const bulk = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED' } });
  check('bulk sets all he translations', bulk.status === 201 && bulk.json.updated === 2, JSON.stringify(bulk.json));
  const he1 = await call(`/projects/${pid}/keys/${k1}/translations/he/history`, { jwt });
  check('history recorded for bulk change', he1.status === 200 && he1.json.some((h) => h.status === 'REVIEWED'));
  const bulkAgain = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED' } });
  check('bulk skips rows already at the status', bulkAgain.status === 201 && bulkAgain.json.updated === 0);
  const frStatus = (await call(`/projects/${pid}/keys/${k2}/translations/fr/history`, { jwt })).json;
  check('other locales untouched by bulk', !frStatus.some((h) => h.status === 'REVIEWED'));
  check('bulk to unknown status rejected (400)',
    (await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'NOPE' } })).status === 400);
  check('bulk to non-project locale rejected (400)',
    (await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'de', status: 'REVIEWED' } })).status === 400);

  // Locale-restricted member: bulk only inside granted locales.
  check('restricted member bulk on granted locale',
    (await call(`/projects/${pid}/review/bulk-status`, { jwt: member.accessToken, method: 'POST', body: { locale: 'he', status: 'NEEDS_WORK' } })).status === 201);
  check('restricted member bulk on denied locale (403)',
    (await call(`/projects/${pid}/review/bulk-status`, { jwt: member.accessToken, method: 'POST', body: { locale: 'fr', status: 'REVIEWED' } })).status === 403);
  check('restricted member custom status on granted locale',
    (await call(`/projects/${pid}/keys/${k2}/translations/he/status`, { jwt: member.accessToken, method: 'PATCH', body: { status: 'LEGAL_HOLD' } })).status === 200);

  // Removing a custom status from settings does not break existing rows.
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { customStatuses: ['LEGAL_HOLD'] } });
  const still = await call(`/projects/${pid}/keys?status=NEEDS_WORK&locale=he`, { jwt });
  check('keys keep a removed custom status value', still.status === 200 && still.json.length >= 1, `status=${still.status} body=${JSON.stringify(still.json)?.slice(0, 200)}`);
  check('removed custom status no longer accepted (400)',
    (await call(`/projects/${pid}/keys/${k1}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'NEEDS_WORK' } })).status === 400);
  check('key list filters by custom status',
    (await call(`/projects/${pid}/keys?status=LEGAL_HOLD&locale=he`, { jwt })).json.length === 1);

  // --- Bulk queue scope: preview, filter match, empty values, concurrency ---
  // Reset he rows to a known mix: k1 REVIEWED, k2 UNVERIFIED, k3 UNVERIFIED+tag.
  const k3 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'rev.three' } })).json.id;
  await call(`/projects/${pid}/keys/${k3}/tags`, { jwt, method: 'PATCH', body: { tags: ['billing'] } });
  await call(`/projects/${pid}/keys/${k3}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'ג' } });
  await call(`/projects/${pid}/keys/${k1}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'REVIEWED' } });
  await call(`/projects/${pid}/keys/${k2}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  // An empty translation must never be marked.
  const k4 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'rev.empty' } })).json.id;
  await call(`/projects/${pid}/keys/${k4}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: '' } });

  const dry = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED', dryRun: true } });
  check('dry run previews exact affected count', dry.status === 201 && dry.json.matched === 2 && dry.json.updated === 0, JSON.stringify(dry.json));
  const histBefore = (await call(`/projects/${pid}/keys/${k2}/translations/he/history`, { jwt })).json.length;
  const dryRow = (await call(`/projects/${pid}/keys/${k2}/translations/he/history`, { jwt })).json;
  check('dry run writes nothing', dryRow.length === histBefore);

  const k1heBefore = (await call(`/projects/${pid}/keys/${k1}/translations/he/history`, { jwt })).json.length;
  const scoped = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED' } });
  check('from filter marks only matching rows', scoped.status === 201 && scoped.json.updated === 2, JSON.stringify(scoped.json));
  const k1he = (await call(`/projects/${pid}/keys/${k1}/translations/he/history`, { jwt })).json;
  check('row already at another status untouched', k1he.length === k1heBefore);
  const emptyHist = (await call(`/projects/${pid}/keys/${k4}/translations/he/history`, { jwt })).json;
  check('empty translation never marked', !emptyHist.some((h) => h.status === 'REVIEWED'));

  // Search/tag narrowing: only keys matching the visible filter are touched.
  await call(`/projects/${pid}/keys/${k2}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  await call(`/projects/${pid}/keys/${k3}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  const tagOnly = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED', tag: 'billing' } });
  check('tag filter narrows bulk to tagged keys', tagOnly.status === 201 && tagOnly.json.updated === 1, JSON.stringify(tagOnly.json));
  const searchOnly = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED', search: 'rev.two' } });
  check('search filter narrows bulk to matching keys', searchOnly.status === 201 && searchOnly.json.updated === 1, JSON.stringify(searchOnly.json));

  // Concurrent-edit preservation: preview N, change one row, commit touches N-1.
  await call(`/projects/${pid}/keys/${k2}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  await call(`/projects/${pid}/keys/${k3}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  const pre = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED', dryRun: true } });
  check('preview sees both unverified rows', pre.json.matched === 2);
  await call(`/projects/${pid}/keys/${k2}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'TRANSLATED' } });
  const post = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED' } });
  check('rows changed after preview are excluded at write time', post.json.updated === 1, JSON.stringify(post.json));

  // Restricted member: dry run on a denied locale is still 403.
  check('restricted member dry run on denied locale (403)',
    (await call(`/projects/${pid}/review/bulk-status`, { jwt: member.accessToken, method: 'POST', body: { locale: 'fr', status: 'REVIEWED', dryRun: true } })).status === 403);

  // Snapshot restore preserves custom statuses verbatim, even after the status
  // is removed from project settings (restore must not validate or drop it).
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { customStatuses: ['NEEDS_WORK'] } });
  await call(`/projects/${pid}/keys/${k1}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'NEEDS_WORK' } });
  const snap2 = (await call(`/projects/${pid}/snapshots`, { jwt, method: 'POST', body: { label: 'custom-status-snap' } })).json;
  await call(`/projects/${pid}/keys/${k1}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { customStatuses: [] } });
  const rest = await call(`/projects/${pid}/snapshots/${snap2.id}/restore`, { jwt, method: 'POST' });
  check('restore succeeds after status removed from settings', rest.status === 201);
  const restored = await call(`/projects/${pid}/keys?status=NEEDS_WORK&locale=he`, { jwt });
  check('restored translations keep the orphan custom status', restored.status === 200 && restored.json.some((k) => k.name === 'rev.one'));


  // Optimistic preview: rows written after the preview are excluded, even when
  // they still match the filter (same-status value edit, newly matching row,
  // or an ABA status round-trip back to the filter status).
  await call(`/projects/${pid}/keys/${k2}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  await call(`/projects/${pid}/keys/${k3}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  const pv = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED', dryRun: true } });
  check('preview returns a server timestamp', pv.status === 201 && typeof pv.json.previewAt === 'string');
  // Same-status value edit after preview.
  await call(`/projects/${pid}/keys/${k2}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'edited after preview' } });
  await call(`/projects/${pid}/keys/${k2}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  // ABA round-trip on k3 after preview.
  await call(`/projects/${pid}/keys/${k3}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'TRANSLATED' } });
  await call(`/projects/${pid}/keys/${k3}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  const commitStale = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED', notChangedSince: pv.json.previewAt } });
  check('rows written after preview are excluded', commitStale.status === 201 && commitStale.json.updated === 0, JSON.stringify(commitStale.json));
  // Without the preview token both rows are still marked (no regression).
  const commitFresh = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED' } });
  check('commit without preview token still works', commitFresh.status === 201 && commitFresh.json.updated === 2, JSON.stringify(commitFresh.json));
  // Garbage preview token rejected.
  check('invalid notChangedSince rejected (400)',
    (await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', notChangedSince: 'not-a-date' } })).status === 400);

} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `review-workflow: ${failures} FAILURES` : 'review-workflow pass complete');
process.exit(failures ? 1 : 0);
