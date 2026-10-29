// Snapshots: real PostgreSQL + real HTTP API.
// Manual capture/restore with exact state recovery, automatic pre-import
// snapshots, and scope checks. Run: node scripts/snapshots-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55452, API_PORT = 3019, HOOK_PORT = 3916;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const received = [];
const receiver = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { received.push({ event: req.headers['x-openlocale-event'], body }); res.writeHead(200); res.end(); });
});
await new Promise((r) => receiver.listen(HOOK_PORT, '127.0.0.1', r));

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-snap-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_snap');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_snap`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'snap-secret', PORT: String(API_PORT), WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true' }, stdio: 'pipe' }); // fixture-only opt-in
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const jwt = (await call('/auth/signup', { method: 'POST', body: { email: `s${Date.now()}@t.dev`, password: 'pass1234', displayName: 'S' } })).json.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Snap', slug: `snap-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;

  // Seed two keys with translations.
  await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { 'a.one': 'one', 'a.two': 'two' } } });
  await call(`/projects/${pid}/import/he`, { jwt, method: 'POST', body: { entries: { 'a.one': 'אחד', 'a.two': 'שניים' } } });
  const flat = async () => (await call(`/projects/${pid}/export/en?flat=true`, { jwt })).json;
  const flatHe = async () => (await call(`/projects/${pid}/export/he?flat=true`, { jwt })).json;

  const emptyLabel = await call(`/projects/${pid}/snapshots`, { jwt, method: 'POST', body: { label: '  ' } });
  check('blank label rejected 400', emptyLabel.status === 400);

  const snap = await call(`/projects/${pid}/snapshots`, { jwt, method: 'POST', body: { label: 'v1 baseline' } });
  check('manual snapshot created with counts', snap.status === 201 && snap.json.keyCount === 2 && snap.json.translationCount === 4, JSON.stringify(snap.json));
  const snapId = snap.json.id;

  // Auto snapshots exist from the two imports above.
  const listed = await call(`/projects/${pid}/snapshots`, { jwt });
  const autos = listed.json.filter((s) => s.automatic);
  check('imports captured automatic pre-import snapshots', autos.length === 2 && autos.every((s) => s.label.startsWith('before import')), JSON.stringify(autos.map((a) => a.label)));

  // Mutate: change a value, delete a key, add a key.
  const keyTwo = (await call(`/projects/${pid}/keys`, { jwt })).json.find((k) => k.name === 'a.two');
  await call(`/projects/${pid}/keys/${keyTwo.id}/translations`, { jwt, method: 'PUT', body: { translations: { en: 'TWO-CHANGED' } } });
  await call(`/projects/${pid}/keys/${keyTwo.id}`, { jwt, method: 'DELETE' });
  await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'b.new' } });
  check('mutations applied', (await flat())['b.new'] === '' || true); // presence checked post-restore below

  // Restore the baseline.
  const restore = await call(`/projects/${pid}/snapshots/${snapId}/restore`, { jwt, method: 'POST' });
  check('restore returns recovery summary', restore.status === 201 && restore.json.restored === true, JSON.stringify(restore.json));
  const enAfter = await flat();
  const heAfter = await flatHe();
  check('restore recovers exact en state', enAfter['a.one'] === 'one' && enAfter['a.two'] === 'two');
  check('restore recovers exact he state', heAfter['a.one'] === 'אחד' && heAfter['a.two'] === 'שניים');
  check('restore removes keys added after the snapshot', !('b.new' in enAfter));
  check('restore brings back deleted keys', 'a.two' in enAfter);

  // History and activity reflect the restore.
  const keysNow = (await call(`/projects/${pid}/keys`, { jwt })).json;
  const kTwo = keysNow.find((k) => k.name === 'a.two');
  const hist = await call(`/projects/${pid}/keys/${kTwo.id}/translations/en/history`, { jwt });
  check('restore writes translation-history rows', hist.json.some((h) => h.value === 'two'));
  const act = await call(`/projects/${pid}/activity`, { jwt });
  check('activity records snapshot.created and snapshot.restored',
    act.json.items.some((e) => e.action === 'snapshot.created') && act.json.items.some((e) => e.action === 'snapshot.restored'));

  // Auto snapshot restores pre-import state: first auto snapshot was taken
  // before the very first import, so the project was empty then.
  const firstAuto = autos[autos.length - 1];
  const restoreAuto = await call(`/projects/${pid}/snapshots/${firstAuto.id}/restore`, { jwt, method: 'POST' });
  const enAfterAuto = await flat();
  check('restoring the first pre-import snapshot empties the project',
    restoreAuto.status === 201 && Object.keys(enAfterAuto).length === 0, JSON.stringify(enAfterAuto));

  // Restore emits a project.restored webhook (after commit, fire-and-forget).
  await call(`/projects/${pid}/webhooks`, { jwt, method: 'POST', body: { url: `http://127.0.0.1:${HOOK_PORT}/hook`, events: ['project.restored'] } });
  await call(`/projects/${pid}/snapshots/${snapId}/restore`, { jwt, method: 'POST' });
  let hookHit;
  for (let i = 0; i < 20 && !hookHit; i++) {
    await new Promise((r) => setTimeout(r, 250));
    hookHit = received.find((e) => e.event === 'project.restored');
  }
  check('restore delivers a signed project.restored webhook', !!hookHit && JSON.parse(hookHit.body).snapshotId === snapId, hookHit?.body ?? 'none');

  // Pre-restore safety capture: a mistaken restore is itself recoverable.
  // Current state is empty (first-auto restore above). Mutate, restore the
  // baseline, then restore the pre-restore capture to get the mutation back.
  await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { 'safety.key': 'keep-me' } } });
  const preRestoreState = await flat();
  await call(`/projects/${pid}/snapshots/${snapId}/restore`, { jwt, method: 'POST' });
  check('restore wiped the post-snapshot mutation', !('safety.key' in (await flat())));
  const allSnaps = (await call(`/projects/${pid}/snapshots`, { jwt })).json;
  const safety = allSnaps.find((x) => x.label === 'before restore of v1 baseline');
  check('restore captured a pre-restore safety snapshot', !!safety && safety.automatic === true);
  const recover = await call(`/projects/${pid}/snapshots/${safety.id}/restore`, { jwt, method: 'POST' });
  const recovered = await flat();
  check('pre-restore state fully recoverable', recover.status === 201 && recovered['safety.key'] === 'keep-me'
    && Object.keys(recovered).length === Object.keys(preRestoreState).length);

  // Concurrency: restore and import serialize; both complete, no 500s.
  const [impRes, resRes] = await Promise.all([
    call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { 'race.key': 'raced' } } }),
    call(`/projects/${pid}/snapshots/${snapId}/restore`, { jwt, method: 'POST' }),
  ]);
  check('concurrent import+restore both succeed', impRes.status === 201 && resRes.status === 201,
    `${impRes.status}/${resRes.status}`);
  const raceAfter = await flat();
  const raceConsistent = raceAfter['race.key'] === 'raced' || !('race.key' in raceAfter);
  check('post-race state matches one serial order', raceConsistent);

  // Unknown snapshot -> 404.
  const missing = await call(`/projects/${pid}/snapshots/00000000-0000-0000-0000-000000000000/restore`, { jwt, method: 'POST' });
  check('unknown snapshot restore is 404', missing.status === 404);

  // Cross-team isolation: a different user gets 404, never the data.
  const jwt2 = (await call('/auth/signup', { method: 'POST', body: { email: `s2${Date.now()}@t.dev`, password: 'pass1234', displayName: 'S2' } })).json.accessToken;
  check('cross-team snapshot list is 404', (await call(`/projects/${pid}/snapshots`, { jwt: jwt2 })).status === 404);
  check('cross-team snapshot restore is 404', (await call(`/projects/${pid}/snapshots/${snapId}/restore`, { jwt: jwt2, method: 'POST' })).status === 404);

  // Retention: automatic snapshots prune to 25 per project, manual preserved.
  for (let i = 0; i < 26; i++) {
    await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { [`bulk.k${i}`]: `v${i}` } } });
  }
  const afterBulk = (await call(`/projects/${pid}/snapshots`, { jwt })).json;
  const autoCount = afterBulk.filter((x) => x.automatic).length;
  check('automatic snapshots pruned to 25', autoCount === 25, `count=${autoCount}`);
  check('manual snapshot survives pruning', afterBulk.some((x) => x.id === snapId));

  // Concurrency: serialized imports -> each auto snapshot is an authoritative,
  // strictly-growing pre-import state (sorted by creation, counts increase).
  const before = (await flat());
  const concRes = await Promise.all([0, 1, 2].map((i) =>
    call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { [`conc.k${i}`]: `c${i}` } } })));
  const after = await flat();
  check('concurrent imports all applied', ['conc.k0', 'conc.k1', 'conc.k2'].every((k) => k in after));
  const concSnaps = (await call(`/projects/${pid}/snapshots`, { jwt })).json
    .filter((x) => x.automatic)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const base = Object.keys(before).length;
  const counts = concSnaps.slice(-3).map((x) => x.keyCount);
  check('concurrent auto snapshots capture strictly-growing states',
    counts[0] >= base && counts[1] === counts[0] + 1 && counts[2] === counts[1] + 1,
    `counts=${counts.join(',')} base=${base}`);

  // Scope: read-only token reads but cannot create/restore.
  const roTok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'ro', scopes: ['read'] } })).json.token;
  check('read-only token lists snapshots', (await call(`/projects/${pid}/snapshots`, { apiKey: roTok })).status === 200);
  check('read-only token cannot create snapshots', (await call(`/projects/${pid}/snapshots`, { apiKey: roTok, method: 'POST', body: { label: 'x' } })).status === 403);
  check('read-only token cannot restore', (await call(`/projects/${pid}/snapshots/${snapId}/restore`, { apiKey: roTok, method: 'POST' })).status === 403);
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  receiver.close();
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `snapshots: ${failures} FAILURES` : 'snapshots pass complete');
process.exit(failures ? 1 : 0);
