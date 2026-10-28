// In-context embed boundary tests: origin allowlist, strict message schema,
// and token hygiene, verified in a real browser across two real origins.
// Run: node scripts/incontext-test.mjs   (requires: nx build api)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

const PG_PORT = 55467, API_PORT = 3000, WEB_PORT = 4200, HOST_PORT = 4901, HOST2_PORT = 4902;
const API = `http://127.0.0.1:${API_PORT}/api`;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (token) headers['X-Api-Key'] = token;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const waitFor = async (url, tries = 90) => {
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await fetch(url).then((r) => r.status > 0).catch(() => false)) return true;
  }
  return false;
};

const hostPage = (pid, label) => `<!doctype html><html><body><h1>host ${label}</h1>
<iframe id="ol" src="${WEB}/embed/projects/${pid}" width="520" height="600"></iframe>
<script>
window.__received = [];
window.addEventListener('message', (e) => { window.__received.push({ origin: e.origin, data: e.data }); });
window.__send = (msg) => document.getElementById('ol').contentWindow.postMessage(msg, '${WEB}');
</script></body></html>`;

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ic-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api, web, browser, host1, host2;
try {
  // ---- Part A: API-level origin management rules (PG + HTTP only) ----
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_ic');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_ic`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'ic-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  if (!(await waitFor(`${API}/projects`))) throw new Error('API did not start');

  const owner = (await call('/auth/signup', { method: 'POST', body: { email: `ic${Date.now()}@t.dev`, password: 'pass1234', displayName: 'ic' } })).json;
  const jwt = owner.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Ic', slug: `ic-${Date.now()}`, baseLocale: 'en', locales: ['en'] } })).json.id;
  await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'hero.title' } });
  await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'hero.subtitle' } });

  const okPatch = await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [`http://127.0.0.1:${HOST_PORT}`] } });
  check('admin session can set a bare http origin', okPatch.status === 200 && okPatch.json.embedOrigins.includes(`http://127.0.0.1:${HOST_PORT}`), `got ${okPatch.status}`);
  for (const [bad, why] of [
    ['https://app.example.com/path', 'path'],
    ['https://app.example.com/', 'trailing slash'],
    ['javascript:alert(1)', 'non-http scheme'],
    ['ftp://app.example.com', 'non-http scheme'],
    ['not-a-url', 'unparseable'],
  ]) {
    const r = await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [bad] } });
    check(`rejects origin with ${why}`, r.status === 400, `got ${r.status}`);
  }
  const wtok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'ci', scopes: ['read', 'write'] } })).json.token;
  const tokPatch = await call(`/projects/${pid}`, { token: wtok, method: 'PATCH', body: { embedOrigins: ['https://evil.example.com'] } });
  check('write-scope API token cannot change embed origins (403)', tokPatch.status === 403, `got ${tokPatch.status}`);
  const tokRename = await call(`/projects/${pid}`, { token: wtok, method: 'PATCH', body: { description: 'token ok' } });
  check('same token can still do ordinary updates (origin rule is specific)', tokRename.status === 200, `got ${tokRename.status}`);
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `icm${Date.now()}@t.dev`, password: 'pass1234', displayName: 'm' } })).json;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email } });
  check('non-admin member cannot change origins', (await call(`/projects/${pid}`, { jwt: member.accessToken, method: 'PATCH', body: { embedOrigins: ['https://x.example.com'] } })).status === 403);
  const acts = (await call(`/projects/${pid}/activity`, { jwt })).json;
  check('origin change recorded in activity', JSON.stringify(acts).includes('project.embedOrigins.updated'));

  // ---- Part B: real-browser boundary across two real origins ----
  web = spawn(join(root, 'node_modules', '.bin', 'nx'), ['serve', 'web', '--port', String(WEB_PORT)], { cwd: root, stdio: 'pipe' });
  if (!(await waitFor(`${WEB}/login`))) throw new Error('web dev server did not start');
  host1 = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(hostPage(pid, 'one')); });
  host2 = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(hostPage(pid, 'two')); });
  await Promise.all([new Promise((r) => host1.listen(HOST_PORT, r)), new Promise((r) => host2.listen(HOST2_PORT, r))]);

  const { default: puppeteer } = await import('puppeteer-core');
  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1100, height: 800 },
  });
  const page = await browser.newPage();
  // Seed the session on the web origin, then visit the allowlisted host page.
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  await page.evaluate((t) => localStorage.setItem('ol_token', t), jwt);
  await page.goto(`http://127.0.0.1:${HOST_PORT}/`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('iframe')?.contentWindow, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 2500)); // let the iframe load keys

  const sendAndWait = async (msg, wantType, ms = 3000) => {
    const before = await page.evaluate(() => window.__received.length);
    await page.evaluate((m) => window.__send(m), msg);
    const found = await page.waitForFunction(
      (b, t) => window.__received.slice(b).some((r) => r.data && r.data.type === t),
      { timeout: ms }, before, wantType).then(() => true).catch(() => false);
    return { found, received: await page.evaluate(() => window.__received) };
  };

  const pong = await sendAndWait({ source: 'open-locale-host', type: 'ol:ping' }, 'ol:pong');
  check('allowlisted host origin gets a pong', pong.found);
  const pongMsg = pong.received.flatMap((r) => [r.data]).find((d) => d && d.type === 'ol:pong');
  check('pong carries counts, not credentials', pongMsg && pongMsg.keys === 2 && pongMsg.branch === 'main' && !JSON.stringify(pongMsg).includes(jwt));
  check('no message to the host ever contains the session token', !pong.received.some((r) => JSON.stringify(r).includes(jwt)));

  const hit = await sendAndWait({ source: 'open-locale-host', type: 'ol:highlight', key: 'hero.title' }, 'ol:highlighted');
  check('highlight of existing key answers found=true', hit.found && hit.received.some((r) => r.data.type === 'ol:highlighted' && r.data.found === true));
  const miss = await sendAndWait({ source: 'open-locale-host', type: 'ol:highlight', key: 'nope' }, 'ol:highlighted');
  check('highlight of unknown key answers found=false', miss.found && miss.received.some((r) => r.data.type === 'ol:highlighted' && r.data.found === false));

  for (const [bad, why] of [
    ['ol:ping', 'string payload'],
    [{ source: 'open-locale-host', type: 'ol:ping', extra: 1 }, 'extra field'],
    [{ source: 'open-locale-host', type: 'ol:wipe' }, 'unknown type'],
    [{ source: 'not-the-host', type: 'ol:ping' }, 'wrong source tag'],
    [{ source: 'open-locale-host', type: 'ol:highlight', key: 42 }, 'non-string key'],
  ]) {
    const r = await sendAndWait(bad, 'ol:pong', 1500);
    check(`malformed message ignored (${why})`, !r.found);
  }

  // Non-allowlisted origin: same page on port 4902, no allowlist entry.
  await page.goto(`http://127.0.0.1:${HOST2_PORT}/`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2500));
  const denied = await sendAndWait({ source: 'open-locale-host', type: 'ol:ping' }, 'ol:pong', 2000);
  check('non-allowlisted origin gets silence, not a reply', !denied.found);
  check('non-allowlisted origin receives no messages at all', denied.received.length === 0, JSON.stringify(denied.received.length));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (host1) host1.close();
  if (host2) host2.close();
  if (web) web.kill('SIGTERM');
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `incontext: ${failures} FAILURES` : 'incontext pass complete');
process.exit(failures ? 1 : 0);
