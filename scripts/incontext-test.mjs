// In-context embed boundary tests, second slice: the embed shell is served by
// the API with a per-project CSP frame-ancestors policy, and the frame
// enforces source/origin/schema checks on every message. Real PostgreSQL,
// real HTTP, real Chrome across three real origins.
// Run: node scripts/incontext-test.mjs   (requires: nx build api)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

const PG_PORT = 55467, API_PORT = 3000, HOST_PORT = 4901, HOST2_PORT = 4902;
const API = `http://127.0.0.1:${API_PORT}/api`;
const EMBED_ORIGIN = `http://127.0.0.1:${API_PORT}`;
const HOST1 = `http://127.0.0.1:${HOST_PORT}`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
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

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ic-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api, browser, host1, host2;
const host1Hits = [];
const flatPage = (pid) => `<!doctype html><html><body><h1>host</h1>
<iframe id="ol" src="${EMBED_ORIGIN}/embed/projects/${pid}" width="520" height="600"></iframe>
<script>
window.__received = [];
window.addEventListener('message', (e) => { window.__received.push({ origin: e.origin, data: e.data }); });
window.__send = (msg) => document.getElementById('ol').contentWindow.postMessage(msg, '${EMBED_ORIGIN}');
</script></body></html>`;
const twoFramePage = (pid) => `<!doctype html><html><body>
<iframe id="ol" src="${EMBED_ORIGIN}/embed/projects/${pid}" width="520" height="600"></iframe>
<iframe id="helper" src="/helper" width="100" height="60"></iframe>
<script>
window.__received = [];
window.addEventListener('message', (e) => { window.__received.push({ origin: e.origin, data: e.data }); });
window.__send = (msg) => document.getElementById('ol').contentWindow.postMessage(msg, '${EMBED_ORIGIN}');
window.__triggerHelper = () => document.getElementById('helper').contentWindow.postMessage({ type: 'go' }, '${HOST1}');
</script></body></html>`;
const helperPage = `<!doctype html><html><body><script>
// Same-origin sibling frame trying to message the embed directly: event.origin
// will be the allowlisted host origin, but event.source is NOT the embed's
// parent window.
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'go') {
    parent.document.getElementById('ol').contentWindow.postMessage({ source: 'open-locale-host', type: 'ol:ping' }, '${EMBED_ORIGIN}');
  }
});
</script></body></html>`;
// Host page that uses the served /embed/host.js snippet instead of
// hand-rolled postMessage: init runs the handshake, annotated elements
// click-to-locate, replies arrive as CustomEvent('ol:embed').
const sdkPage = (pid) => `<!doctype html><html><body>
<span data-ol-key="hero.title">Hero title on the page</span>
<iframe id="ol" src="${EMBED_ORIGIN}/embed/projects/${pid}" width="520" height="600"></iframe>
<script src="${EMBED_ORIGIN}/embed/host.js"></script>
<script>
window.__embedEvents = [];
window.addEventListener('ol:embed', (e) => window.__embedEvents.push(e.detail));
window.addEventListener('load', () => { window.__handle = OpenLocaleEmbed.init({ iframe: document.getElementById('ol') }); });
</script></body></html>`;
const nestedPage = (pid) => `<!doctype html><html><body>
<iframe id="ol" src="${EMBED_ORIGIN}/embed/projects/${pid}" width="520" height="600"></iframe>
<script>
const f = document.getElementById('ol');
f.addEventListener('load', () => setTimeout(() => f.contentWindow.postMessage({ source: 'open-locale-host', type: 'ol:ping' }, '${EMBED_ORIGIN}'), 800));
window.addEventListener('message', (e) => { if (e.data && e.data.type === 'ol:pong') fetch('/beacon?ok=1'); });
</script></body></html>`;
const outerPage = `<!doctype html><html><body><iframe src="${HOST1}/nested" width="640" height="700"></iframe></body></html>`;

try {
  // ---- Part A: origin management + shell/CSP delivery over HTTP ----
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_ic');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_ic`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'ic-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  if (!(await waitFor(`${API}/projects`))) throw new Error('API did not start');

  const email = `ic${Date.now()}@t.dev`, password = 'pass1234';
  const owner = (await call('/auth/signup', { method: 'POST', body: { email, password, displayName: 'ic' } })).json;
  const jwt = owner.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Ic', slug: `ic-${Date.now()}`, baseLocale: 'en', locales: ['en'] } })).json.id;
  await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'hero.title' } });
  const k2 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'hero.subtitle' } })).json;
  await call(`/projects/${pid}/keys/${k2.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Secret subtitle value' } });

  const okPatch = await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [HOST1] } });
  check('admin session can set a bare http origin', okPatch.status === 200 && okPatch.json.embedOrigins.includes(HOST1), `got ${okPatch.status}`);
  for (const [bad, why] of [
    ['https://app.example.com/path', 'path'],
    ['https://app.example.com/', 'trailing slash'],
    ['javascript:alert(1)', 'non-http scheme'],
    ['ftp://app.example.com', 'non-http scheme'],
    ['not-a-url', 'unparseable'],
  ]) {
    check(`rejects origin with ${why}`, (await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [bad] } })).status === 400);
  }
  const wtok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'ci', scopes: ['read', 'write'] } })).json.token;
  check('write-scope API token cannot change embed origins (403)', (await call(`/projects/${pid}`, { token: wtok, method: 'PATCH', body: { embedOrigins: ['https://evil.example.com'] } })).status === 403);
  check('same token can still do ordinary updates (origin rule is specific)', (await call(`/projects/${pid}`, { token: wtok, method: 'PATCH', body: { description: 'token ok' } })).status === 200);
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `icm${Date.now()}@t.dev`, password: 'pass1234', displayName: 'm' } })).json;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email } });
  check('non-admin member cannot change origins', (await call(`/projects/${pid}`, { jwt: member.accessToken, method: 'PATCH', body: { embedOrigins: ['https://x.example.com'] } })).status === 403);
  check('origin change recorded in activity', JSON.stringify((await call(`/projects/${pid}/activity`, { jwt })).json).includes('project.embedOrigins.updated'));

  // Shell delivery: CSP on the served HTML, per project, no data in the shell.
  const shell = await fetch(`${EMBED_ORIGIN}/embed/projects/${pid}`);
  const csp = shell.headers.get('content-security-policy') || '';
  const html = await shell.text();
  check('shell served at /embed (not under /api)', shell.status === 200);
  check('frame-ancestors names self + allowlisted origin', csp.includes(`frame-ancestors 'self' ${HOST1}`), csp.slice(0, 140));
  check('shell CSP denies inline script', csp.includes("script-src 'self'") && !html.includes('ol_embed_token'));
  check('shell HTML carries no project data', !html.includes('hero.title') && !html.includes('Secret subtitle value'));
  check('unknown project shell is 404', (await fetch(`${EMBED_ORIGIN}/embed/projects/00000000-0000-0000-0000-000000000000`)).status === 404);
  check('shell not double-mounted under /api', (await fetch(`${API}/embed/projects/${pid}`)).status === 404);
  const js = await fetch(`${EMBED_ORIGIN}/embed/frame.js`);
  check('frame.js served as javascript', js.status === 200 && (js.headers.get('content-type') || '').includes('javascript'));
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [] } });
  const cspEmpty = (await fetch(`${EMBED_ORIGIN}/embed/projects/${pid}`)).headers.get('content-security-policy') || '';
  check('empty allowlist yields frame-ancestors self only', cspEmpty.includes("frame-ancestors 'self'") && !cspEmpty.includes(HOST1), cspEmpty.slice(0, 140));
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [HOST1] } });

  // ---- Part B: real Chrome, real cross-origin framing ----
  host1 = createServer((req, res) => {
    host1Hits.push(req.url);
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/') res.end(flatPage(pid));
    else if (req.url === '/two') res.end(twoFramePage(pid));
    else if (req.url === '/helper') res.end(helperPage);
    else if (req.url === '/nested') res.end(nestedPage(pid));
    else if (req.url === '/sdk') res.end(sdkPage(pid));
    else if (req.url.startsWith('/beacon')) res.end('ok');
    else res.end('x');
  });
  host2 = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(outerPage); });
  await Promise.all([new Promise((r) => host1.listen(HOST_PORT, r)), new Promise((r) => host2.listen(HOST2_PORT, r))]);

  const { default: puppeteer } = await import('puppeteer-core');
  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1100, height: 800 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('PAGEERROR:', String(err).slice(0, 200)));

  const embedFrame = async () => {
    for (let i = 0; i < 40; i++) {
      const f = page.frames().find((f) => f.url().includes('/embed/projects/'));
      if (f) return f;
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  };
  const sendAndWait = async (msg, wantType, ms = 3000) => {
    const before = await page.evaluate(() => window.__received.length);
    await page.evaluate((m) => window.__send(m), msg);
    const found = await page.waitForFunction(
      (b, t) => window.__received.slice(b).some((r) => r.data && r.data.type === t),
      { timeout: ms }, before, wantType).then(() => true).catch(() => false);
    return { found, received: await page.evaluate(() => window.__received) };
  };

  // Failed-auth frame: no session yet -> sign-in form, zero project data, silence.
  await page.goto(`${HOST1}/`, { waitUntil: 'networkidle0' });
  const f0 = await embedFrame();
  check('embed frame loaded inside allowlisted host', !!f0);
  await new Promise((r) => setTimeout(r, 1500));
  const unauthDom = await f0.evaluate(() => document.body.textContent + '|' + (document.querySelector('input[type=password]') ? 'has-login' : 'no-login'));
  check('unauthenticated frame shows sign-in and no key data', unauthDom.includes('has-login') && !unauthDom.includes('hero.title'), unauthDom.slice(0, 90));
  const unauthPing = await sendAndWait({ source: 'open-locale-host', type: 'ol:ping' }, 'ol:pong', 1500);
  check('unauthenticated frame does not answer host messages', !unauthPing.found);

  // Sign in through the frame's own form (host page never sees credentials).
  await f0.type('input[type=email]', email);
  await f0.type('input[type=password]', password);
  await f0.evaluate(() => document.querySelector('form').requestSubmit());
  const authed = await page.waitForFunction(
    () => window.__received || true, { timeout: 5000 }).catch(() => null);
  void authed;
  await f0.waitForFunction(() => document.body.textContent.includes('hero.title'), { timeout: 10000 });
  const authDom = await f0.evaluate(() => document.body.textContent);
  check('after in-frame sign-in the keys render', authDom.includes('hero.title'));

  const pong = await sendAndWait({ source: 'open-locale-host', type: 'ol:ping' }, 'ol:pong');
  check('allowlisted host origin gets a pong', pong.found);
  const pongMsg = pong.received.map((r) => r.data).find((d) => d && d.type === 'ol:pong');
  check('pong carries counts, not credentials', pongMsg && pongMsg.keys === 2 && pongMsg.branch === 'main');
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
    const r = await sendAndWait(bad, 'ol:pong', 1200);
    check(`malformed message ignored (${why})`, !r.found);
  }

  // Sibling same-origin frame messaging the embed directly: origin allowlisted
  // but source is not the parent window -> must be ignored.
  await page.goto(`${HOST1}/two`, { waitUntil: 'networkidle0' });
  await embedFrame();
  await new Promise((r) => setTimeout(r, 1500));
  const direct = await sendAndWait({ source: 'open-locale-host', type: 'ol:ping' }, 'ol:pong');
  check('two-frame page: parent ping still answered', direct.found);
  const beforeHelper = await page.evaluate(() => window.__received.length);
  await page.evaluate(() => window.__triggerHelper());
  await new Promise((r) => setTimeout(r, 1500));
  const afterHelper = await page.evaluate(() => window.__received.length);
  check('sibling-frame message (allowlisted origin, wrong source) ignored', afterHelper === beforeHelper, `${beforeHelper} -> ${afterHelper}`);

  // Nested ancestor chain: outer origin (4902) is not allowlisted, so the
  // browser must block the embed even though the direct parent (4901) is.
  host1Hits.length = 0;
  await page.goto(`http://127.0.0.1:${HOST2_PORT}/`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 3500));
  check('nested chain with non-allowlisted outer origin: frame blocked (no pong beacon)', !host1Hits.some((h) => h.startsWith('/beacon')), JSON.stringify(host1Hits));
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [HOST1, `http://127.0.0.1:${HOST2_PORT}`] } });
  await page.goto(`http://127.0.0.1:${HOST2_PORT}/`, { waitUntil: 'networkidle0' });
  const beaconed = await (async () => {
    for (let i = 0; i < 20; i++) {
      if (host1Hits.some((h) => h.startsWith('/beacon'))) return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  })();
  check('nested chain works when every ancestor is allowlisted', beaconed);

  // ---- host.js snippet (slice 21): served asset + real handshake/click ----
  const hostJs = await fetch(`${EMBED_ORIGIN}/embed/host.js`);
  check('host.js served as javascript with no-cache', hostJs.status === 200 && (hostJs.headers.get('content-type') || '').includes('javascript') && (hostJs.headers.get('cache-control') || '').includes('no-cache'));
  await page.goto(`${HOST1}/sdk`, { waitUntil: 'networkidle0' });
  const sdkPong = await page.waitForFunction(
    () => (window.__embedEvents || []).some((d) => d && d.type === 'ol:pong'),
    { timeout: 20000 }, ).then(() => true).catch(() => false);
  check('host.js runs the handshake: pong arrived as an ol:embed event', sdkPong);
  await page.click('span[data-ol-key]');
  const sdkHl = await page.waitForFunction(
    () => (window.__embedEvents || []).some((d) => d && d.type === 'ol:highlighted' && d.key === 'hero.title' && d.found === true),
    { timeout: 10000 }, ).then(() => true).catch(() => false);
  check('click on a data-ol-key element highlights in the frame (found=true)', sdkHl);
  const beforeForged = await page.evaluate(() => window.__embedEvents.length);
  await page.evaluate(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { source: 'open-locale-embed', type: 'ol:pong', keys: 99 },
      origin: 'https://evil.example.com', source: null,
    }));
  });
  await new Promise((r) => setTimeout(r, 800));
  check('host.js ignores forged messages (wrong origin/source)', (await page.evaluate(() => window.__embedEvents.length)) === beforeForged);

  // Revocation: remove all origins; a fresh load must be blocked by CSP.
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { embedOrigins: [] } });
  await page.goto(`${HOST1}/`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2000));
  const revokedPing = await sendAndWait({ source: 'open-locale-host', type: 'ol:ping' }, 'ol:pong', 1500);
  check('after origin removal a fresh embed is blocked (no pong)', !revokedPing.found);
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (host1) host1.close();
  if (host2) host2.close();
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `incontext: ${failures} FAILURES` : 'incontext pass complete');
process.exit(failures ? 1 : 0);
