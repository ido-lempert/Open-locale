// Webhooks: real PostgreSQL + real HTTP API + a real local receiver.
// Run: node scripts/webhooks-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55447, API_PORT = 3014, HOOK_PORT = 3915;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const received = [];
let failNext = 0; // when >0 the receiver answers 500 (retry testing)
const receiver = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    received.push({ event: req.headers['x-openlocale-event'], sig: req.headers['x-openlocale-signature'], body });
    if (failNext > 0) { failNext--; res.writeHead(500); res.end('boom'); return; }
    res.writeHead(200); res.end('ok');
  });
});
await new Promise((r) => receiver.listen(HOOK_PORT, '127.0.0.1', r));

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-wh-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_wh');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_wh`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'wh-secret', PORT: String(API_PORT), WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true' }, stdio: 'pipe' }); // fixture-only opt-in for the loopback receiver
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@wh.io', password: 'password-a', displayName: 'A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@wh.io', password: 'password-b', displayName: 'B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'WH', slug: 'wh', locales: ['en', 'he'] } })).json;
  const P = `/projects/${proj.id}`;

  // CRUD + one-time secret reveal
  const created = await call(`${P}/webhooks`, { token: at, method: 'POST', body: { url: `http://127.0.0.1:${HOOK_PORT}/hook`, events: ['translation.updated'] } });
  check('webhook created with one-time secret', created.status === 201 && typeof created.json.secret === 'string' && created.json.secret.length >= 24, JSON.stringify(created.json));
  const hook = created.json;
  const listed = await call(`${P}/webhooks`, { token: at });
  check('list omits the secret', listed.status === 200 && listed.json.length === 1 && !('secret' in listed.json[0]), JSON.stringify(listed.json));
  const badEvent = await call(`${P}/webhooks`, { token: at, method: 'POST', body: { url: 'http://127.0.0.1:9/x', events: ['project.deleted'] } });
  check('unknown event name rejected (400)', badEvent.status === 400, String(badEvent.status));
  const cross = await call(`${P}/webhooks`, { token: bt });
  check('cross-team webhook list is 404', cross.status === 404, String(cross.status));
  const crossDel = await call(`${P}/webhooks/${hook.id}`, { token: bt, method: 'DELETE' });
  check('cross-team webhook delete is 404', crossDel.status === 404, String(crossDel.status));

  // Delivery on translation upsert
  const key = (await call(`${P}/keys`, { token: at, method: 'POST', body: { name: 'app.title' } })).json;
  await call(`${P}/keys/${key.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Hello' } });
  let hit;
  for (let i = 0; i < 20 && !hit; i++) { await new Promise((r) => setTimeout(r, 250)); hit = received[0]; }
  check('translation upsert delivered to receiver', !!hit, JSON.stringify(received.length));
  if (hit) {
    const expected = 'sha256=' + createHmac('sha256', hook.secret).update(hit.body).digest('hex');
    check('event header is translation.updated', hit.event === 'translation.updated', String(hit.event));
    check('HMAC signature verifies against one-time secret', hit.sig === expected, String(hit.sig));
    const parsed = JSON.parse(hit.body);
    check('payload carries key/locale/value', parsed.key === 'app.title' && parsed.locale === 'en' && parsed.value === 'Hello', hit.body);
  }

  // Inactive webhook receives nothing
  await call(`${P}/webhooks/${hook.id}`, { token: at, method: 'PATCH', body: { active: false } });
  await call(`${P}/keys/${key.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Hello v2' } });
  const before = received.length;
  await new Promise((r) => setTimeout(r, 1500));
  check('inactive webhook receives no delivery', received.length === before, `${before} -> ${received.length}`);

  // --- Delivery journal (slice 17) ---
  // Reactivate, then read the journal: the two earlier deliveries (one active
  // hit, none while inactive) must appear with exact shape.
  await call(`${P}/webhooks/${hook.id}`, { token: at, method: 'PATCH', body: { active: true } });
  let journal = [];
  for (let i = 0; i < 20 && journal.length < 1; i++) {
    await new Promise((r) => setTimeout(r, 250));
    journal = (await call(`${P}/webhooks/${hook.id}/deliveries`, { token: at })).json ?? [];
  }
  check('delivery journal records the successful delivery', journal.length === 1, JSON.stringify(journal.length));
  if (journal[0]) {
    const d = journal[0];
    check('journal row: success, status 200, one attempt, timed', d.success === true && d.httpStatus === 200 && d.attempts === 1 && d.durationMs >= 0 && d.event === 'translation.updated' && d.error === null, JSON.stringify(d));
    check('journal row carries no secret or payload', !('secret' in d) && !('payload' in d) && !('body' in d), Object.keys(d).join(','));
  }
  const memberJournal = await call(`${P}/webhooks/${hook.id}/deliveries`, { token: bt });
  check('cross-team journal read is 404', memberJournal.status === 404, String(memberJournal.status));

  // Retry: receiver 500s the first attempt, succeeds on the retry.
  failNext = 1;
  await call(`${P}/keys/${key.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Hello v3' } });
  let retried = null;
  for (let i = 0; i < 30 && !retried; i++) {
    await new Promise((r) => setTimeout(r, 300));
    journal = (await call(`${P}/webhooks/${hook.id}/deliveries`, { token: at })).json ?? [];
    retried = journal.find((d) => d.attempts === 2);
  }
  check('failed first attempt is retried and succeeds', !!retried && retried.success === true && retried.httpStatus === 200, JSON.stringify(retried));

  // Persistent failure: closed port (fixture mode allows private targets).
  const deadHook = (await call(`${P}/webhooks`, { token: at, method: 'POST', body: { url: 'http://127.0.0.1:9/dead', events: ['translation.updated'] } })).json;
  await call(`${P}/keys/${key.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Hello v4' } });
  let deadRow = null;
  for (let i = 0; i < 30 && !deadRow; i++) {
    await new Promise((r) => setTimeout(r, 300));
    deadRow = ((await call(`${P}/webhooks/${deadHook.id}/deliveries`, { token: at })).json ?? [])[0];
  }
  check('unreachable target journaled as failure after both attempts', !!deadRow && deadRow.success === false && deadRow.attempts === 2 && deadRow.httpStatus === null && typeof deadRow.error === 'string' && deadRow.error.length > 0, JSON.stringify(deadRow));

  // The emitted-but-unsubscribable event class is fixed: mt.pretranslated passes validation.
  const mtHook = await call(`${P}/webhooks`, { token: at, method: 'POST', body: { url: `http://127.0.0.1:${HOOK_PORT}/mt`, events: ['mt.pretranslated'] } });
  check('mt.pretranslated subscription accepted (event list matches emissions)', mtHook.status === 201, `got ${mtHook.status}`);

  const del = await call(`${P}/webhooks/${hook.id}`, { token: at, method: 'DELETE' });
  check('webhook deleted', del.status === 200 && (await call(`${P}/webhooks`, { token: at })).json.length === 2);
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  api?.kill('SIGTERM');
  receiver.close();
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `${failures} FAIL` : 'All webhook checks passed');
process.exit(failures ? 1 : 0);
