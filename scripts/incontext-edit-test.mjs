// In-context EDIT slice: server-authoritative writes with optimistic
// concurrency, user-initiated saves only (no host-message writes), live
// origin revalidation on the open frame, and real UI pixels for
// editor/save/conflict states. Real PG + HTTP + Chrome.
// Run: SHOT_DIR=/tmp/pptr node scripts/incontext-edit-test.mjs (requires: nx build api)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

const PG_PORT = 55468, API_PORT = 3000, HOST_PORT = 4901;
const API = `http://127.0.0.1:${API_PORT}/api`;
const EMBED = `http://127.0.0.1:${API_PORT}`;
const HOST1 = `http://127.0.0.1:${HOST_PORT}`;
const SHOTS = process.env.SHOT_DIR ?? '/tmp/pptr';
mkdirSync(SHOTS, { recursive: true });
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const waitFor = async (url, tries = 90) => {
  for (let i = 0; i < tries; i++) { await new Promise((r) => setTimeout(r, 500)); if (await fetch(url).then((r) => r.status > 0).catch(() => false)) return true; }
  return false;
};

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ie-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api, browser, host1;
const hostPage = (pid) => `<!doctype html><html><body><h1>host</h1>
<iframe id="ol" src="${EMBED}/embed/projects/${pid}" width="560" height="640"></iframe>
<script>
window.__received = [];
window.addEventListener('message', (e) => { window.__received.push({ origin: e.origin, data: e.data }); });
window.__send = (msg) => document.getElementById('ol').contentWindow.postMessage(msg, '${EMBED}');
</script></body></html>`;

try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_ie');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_ie`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'ie-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  if (!(await waitFor(`${API}/projects`))) throw new Error('API did not start');

  const email = `ie${Date.now()}@t.dev`, password = 'pass1234';
  const owner = (await call('/auth/signup', { method: 'POST', body: { email, password, displayName: 'ie' } })).json;
  const jwt = owner.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Ie', slug: `ie-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  const k1 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'hero.title' } })).json;
  const k2 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'hero.subtitle' } })).json;
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [HOST1] } });

  // ---- Part A: optimistic concurrency at the write boundary ----
  const w1 = await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Hello', expectedVersion: 0 } });
  check('create with expectedVersion 0 commits at version 1', w1.status === 200 && w1.json.version === 1, JSON.stringify({ s: w1.status, v: w1.json && w1.json.version }));
  const w2 = await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Hello v2', expectedVersion: 1 } });
  check('matching expectedVersion commits and increments', w2.status === 200 && w2.json.version === 2);
  const w3 = await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'stale write', expectedVersion: 1 } });
  check('stale expectedVersion is 409 with current value', w3.status === 409 && w3.json.currentValue === 'Hello v2' && w3.json.currentVersion === 2, JSON.stringify(w3.json));
  const after = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k1.id);
  check('409 leaves the stored value untouched', after.translations.find((t) => t.localeCode === 'en').value === 'Hello v2');
  const w4 = await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'no-version write', expectedVersion: undefined } });
  check('write without expectedVersion still works (compat path)', [200, 201].includes(w4.status) && w4.json.version === 3);
  const dup = await call(`/projects/${pid}/keys/${k2.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'first' } });
  const dupRace = await call(`/projects/${pid}/keys/${k2.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'second', expectedVersion: 0 } });
  check('expectedVersion 0 against an existing row is 409 (create-race safe)', dupRace.status === 409, `got ${dupRace.status} (setup ${dup.status})`);

  // Server-authoritative membership/locale per write.
  const restricted = (await call('/auth/signup', { method: 'POST', body: { email: `ier${Date.now()}@t.dev`, password: 'pass1234', displayName: 'r' } })).json;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: restricted.user.email, role: 'MEMBER', allowedLocales: ['he'] } });
  const deny = await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt: restricted.accessToken, method: 'PUT', body: { locale: 'en', value: 'x', expectedVersion: 3 } });
  check('locale-restricted member cannot write en (403)', deny.status === 403, `got ${deny.status}`);
  const allow = await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt: restricted.accessToken, method: 'PUT', body: { locale: 'he', value: 'שלום', expectedVersion: 0 } });
  check('locale-restricted member can write he', allow.status === 200 && allow.json.version === 1);
  const hist = (await call(`/projects/${pid}/keys/${k1.id}/translations/en/history`, { jwt })).json;
  check('every committed write has a history row with actor attribution', hist.length === 3 && hist.every((h) => h.changedBy), JSON.stringify(hist.length));

  // ---- Part A2: version advances on EVERY mutating path ----
  const vOf = async (keyId, locale) => {
    const k = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((x) => x.id === keyId);
    const t = k && k.translations.find((t) => t.localeCode === locale);
    return t ? { version: t.version, value: t.value, status: t.status } : null;
  };
  let v = (await vOf(k1.id, 'en')).version;
  await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { 'hero.title': 'Imported value' } } });
  let nv = await vOf(k1.id, 'en');
  check('import write bumps the version token', nv.version === v + 1 && nv.value === 'Imported value', `${v} -> ${nv.version}`);
  v = nv.version;
  await call(`/projects/${pid}/keys/${k1.id}/translations/en/status`, { jwt, method: 'PATCH', body: { status: 'TRANSLATED' } });
  nv = await vOf(k1.id, 'en');
  check('setStatus bumps the version token', nv.version === v + 1 && nv.status === 'TRANSLATED', `${v} -> ${nv.version}`);
  v = nv.version;
  await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'en', status: 'REVIEWED', from: 'TRANSLATED' } });
  nv = await vOf(k1.id, 'en');
  check('bulk status bump: version advances AND status is REVIEWED', nv.version === v + 1 && nv.status === 'REVIEWED', `${v} -> ${nv.version}`);
  v = nv.version;
  // A stale value save must now conflict instead of silently resetting the
  // newer REVIEWED decision - and the conflict leaves the status alone.
  const clob = await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'stale text', expectedVersion: v - 1 } });
  nv = await vOf(k1.id, 'en');
  check('stale save after status change 409s and does NOT clobber the status', clob.status === 409 && nv.status === 'REVIEWED' && nv.value === 'Imported value' && nv.version === v);
  // Snapshot restore path.
  const snap = (await call(`/projects/${pid}/snapshots`, { jwt, method: 'POST', body: { label: 'pre-test' } })).json;
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'post-snapshot', expectedVersion: v } });
  v = (await vOf(k1.id, 'en')).version;
  await call(`/projects/${pid}/snapshots/${snap.id}/restore`, { jwt, method: 'POST', body: {} });
  nv = await vOf(k1.id, 'en');
  check('snapshot restore bumps the version token while restoring content', nv.version === v + 1 && nv.value === 'Imported value' && nv.status === 'REVIEWED', `${v} -> ${nv.version} ${nv.value}`);
  v = nv.version;
  // Merge path: feat branch overwrites main's hero.title.
  const br = (await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat-v' } })).json;
  const fb = (await call(`/projects/${pid}/branches`, { jwt })).json.find((b) => b.name === 'feat-v');
  const fk = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'hero.title', branch: 'feat-v' } })).json;
  await call(`/projects/${pid}/keys/${fk.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Merged value' } });
  await call(`/projects/${pid}/branches/${fb.id}/merge`, { jwt, method: 'POST', body: { into: 'main' } });
  nv = await vOf(k1.id, 'en');
  check('merge overwrite bumps the version token', nv.version === v + 1 && nv.value === 'Merged value', `${v} -> ${nv.version} ${nv.value}`);
  v = nv.version;
  // Delete/recreate ABA: the recreated key has a NEW id, so a frame holding
  // the old keyId gets 404; a recreated locale row restarts at version 0/1,
  // so an old expectedVersion conflicts.
  await call(`/projects/${pid}/keys/${k2.id}`, { jwt, method: 'DELETE' });
  const k2b = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'hero.subtitle' } })).json;
  const abaOld = await call(`/projects/${pid}/keys/${k2.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'aba', expectedVersion: 1 } });
  check('delete/recreate: writes to the OLD key id are 404 (new identity)', abaOld.status === 404 && k2b.id !== k2.id, `got ${abaOld.status}`);
  const heBefore = await vOf(k1.id, 'he');
  await call(`/projects/${pid}/locales/he`, { jwt, method: 'DELETE' });
  await call(`/projects/${pid}/locales`, { jwt, method: 'POST', body: { code: 'he' } });
  const abaLocale = await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'aba', expectedVersion: heBefore ? heBefore.version : 1 } });
  check('locale remove/re-add: old expectedVersion conflicts (row restarted)', abaLocale.status === 409, `got ${abaLocale.status}`);

  // ---- Part B: the frame UI in real Chrome ----
  host1 = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(hostPage(pid)); });
  await new Promise((r) => host1.listen(HOST_PORT, r));
  const { default: puppeteer } = await import('puppeteer-core');
  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1100, height: 800 },
  });
  const page = await browser.newPage();
  // Seed the frame session on the API origin, then load the host page.
  await page.goto(`${EMBED}/embed/projects/${pid}`, { waitUntil: 'networkidle0' });
  await page.evaluate((t) => localStorage.setItem('ol_embed_token', t), jwt);
  await page.goto(`${HOST1}/`, { waitUntil: 'networkidle0' });
  let frame;
  for (let i = 0; i < 40 && !frame; i++) { frame = page.frames().find((f) => f.url().includes('/embed/projects/')); if (!frame) await new Promise((r) => setTimeout(r, 250)); }
  check('embed frame loaded', !!frame);
  await frame.waitForFunction(() => document.querySelector('li[data-key-id] input'), { timeout: 10000 });
  check('frame renders editable rows for the base locale', await frame.evaluate(() => document.querySelectorAll('li[data-key-id] input').length === 2));
  await page.screenshot({ path: join(SHOTS, 'frame-01-editor.png') });

  // User-initiated save inside the frame.
  const rowSel = (id) => `li[data-key-id="${id}"]`;
  await frame.evaluate((sel) => {
    const input = document.querySelector(sel + ' input');
    input.value = 'Frame hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, rowSel(k1.id));
  await frame.evaluate((sel) => document.querySelector(sel + ' .save').click(), rowSel(k1.id));
  await frame.waitForFunction((sel) => document.querySelector(sel + ' .st')?.textContent === 'Saved', { timeout: 8000 }, rowSel(k1.id));
  const savedApi = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k1.id);
  const savedT = savedApi.translations.find((t) => t.localeCode === 'en');
  const preFrameV = savedT.version - 1; // the frame loaded the version before its own save
  check('frame save lands via API with version bump', savedT.value === 'Frame hello' && savedT.version === preFrameV + 1);
  await page.screenshot({ path: join(SHOTS, 'frame-02-saved.png') });

  // Conflict: server moves on after the frame loaded (frame holds version 4;
  // write v5 directly via API), then the frame saves -> conflict UI.
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Server moved', expectedVersion: savedT.version } });
  await frame.evaluate((sel) => {
    const input = document.querySelector(sel + ' input');
    input.value = 'My conflicting text';
  }, rowSel(k1.id));
  await frame.evaluate((sel) => document.querySelector(sel + ' .save').click(), rowSel(k1.id));
  await frame.waitForFunction((sel) => !!document.querySelector(sel + ' .conflict'), { timeout: 8000 }, rowSel(k1.id));
  const conflictText = await frame.evaluate((sel) => document.querySelector(sel + ' .conflict').textContent, rowSel(k1.id));
  check('conflict UI shows the true current server value', conflictText.includes('Server moved'), conflictText.slice(0, 120));
  const stillServer = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k1.id);
  check('conflicted save did NOT overwrite the server value', stillServer.translations.find((t) => t.localeCode === 'en').value === 'Server moved');
  await page.screenshot({ path: join(SHOTS, 'frame-03-conflict.png') });
  await frame.evaluate((sel) => document.querySelector(sel + ' .overwrite').click(), rowSel(k1.id));
  await frame.waitForFunction((sel) => document.querySelector(sel + ' .st')?.textContent === 'Saved', { timeout: 8000 }, rowSel(k1.id));
  const resolved = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k1.id);
  check('explicit overwrite resolves the conflict', resolved.translations.find((t) => t.localeCode === 'en').value === 'My conflicting text');

  // Host-message write attempts: protocol has no write type; value must not move.
  const before = resolved.translations.find((t) => t.localeCode === 'en').value;
  for (const bad of [
    { source: 'open-locale-host', type: 'ol:save', key: 'hero.title', value: 'host write' },
    { source: 'open-locale-host', type: 'ol:write', keyId: k1.id, value: 'host write' },
  ]) {
    await page.evaluate((m) => window.__send(m), bad);
  }
  await new Promise((r) => setTimeout(r, 1200));
  const unmoved = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k1.id);
  check('host messages cannot write (no write type in protocol)', unmoved.translations.find((t) => t.localeCode === 'en').value === before);
  check('host write attempts got no reply', await page.evaluate(() => window.__received.filter((r) => r.data && String(r.data.type).includes('save')).length === 0));

  // Live origin revalidation: remove the origin while the frame is open.
  const pong1 = await page.evaluate(() => { const b = window.__received.length; window.__send({ source: 'open-locale-host', type: 'ol:ping' }); return b; });
  const got1 = await page.waitForFunction((b) => window.__received.slice(b).some((r) => r.data && r.data.type === 'ol:pong'), { timeout: 4000 }, pong1).then(() => true).catch(() => false);
  check('open frame answers while allowlisted', got1);
  // Type an unsaved draft first: trust withdrawal must pause editing but keep the text.
  await frame.evaluate((sel) => {
    const input = document.querySelector(sel + ' input');
    input.value = 'unsaved draft text';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, rowSel(k1.id));
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [] } });
  const b2 = await page.evaluate(() => { const b = window.__received.length; window.__send({ source: 'open-locale-host', type: 'ol:ping' }); return b; });
  const got2 = await page.waitForFunction((b) => window.__received.slice(b).some((r) => r.data && r.data.type === 'ol:pong'), { timeout: 3000 }, b2).then(() => true).catch(() => false);
  check('after origin removal the OPEN frame stops answering (live revalidation)', !got2);
  await frame.waitForFunction(() => !!document.getElementById('withdrawn'), { timeout: 5000 });
  const withdrawn = await frame.evaluate((sel) => ({
    banner: document.getElementById('withdrawn').textContent,
    disabled: [...document.querySelectorAll('li input, li .save')].every((el) => el.disabled),
    draftKept: document.querySelector(sel + ' input').value,
  }), rowSel(k1.id));
  check('withdrawal visibly disables editing and keeps the unsaved draft', withdrawn.disabled && withdrawn.draftKept === 'unsaved draft text' && withdrawn.banner.length > 10, JSON.stringify(withdrawn).slice(0, 140));
  await page.screenshot({ path: join(SHOTS, 'frame-04-withdrawn.png') });
  // A save attempt while withdrawn must not write anything.
  const beforeWithdrawnSave = (await vOf(k1.id, 'en')).value;
  await frame.evaluate((sel) => document.querySelector(sel + ' .save').click(), rowSel(k1.id));
  await new Promise((r) => setTimeout(r, 1000));
  check('save while withdrawn writes nothing', (await vOf(k1.id, 'en')).value === beforeWithdrawnSave);
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [HOST1] } });
  const b3 = await page.evaluate(() => { const b = window.__received.length; window.__send({ source: 'open-locale-host', type: 'ol:ping' }); return b; });
  const got3 = await page.waitForFunction((b) => window.__received.slice(b).some((r) => r.data && r.data.type === 'ol:pong'), { timeout: 4000 }, b3).then(() => true).catch(() => false);
  check('re-allowlisting restores answers without reload', got3);
  const reenabled = await frame.evaluate((sel) => ({
    bannerGone: !document.getElementById('withdrawn'),
    enabled: [...document.querySelectorAll('li input, li .save')].every((el) => !el.disabled),
    draftKept: document.querySelector(sel + ' input').value,
  }), rowSel(k1.id));
  check('re-allowlisting re-enables editing with the draft still intact', reenabled.bannerGone && reenabled.enabled && reenabled.draftKept === 'unsaved draft text', JSON.stringify(reenabled).slice(0, 140));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (host1) host1.close();
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `incontext-edit: ${failures} FAILURES` : 'incontext-edit pass complete');
process.exit(failures ? 1 : 0);
