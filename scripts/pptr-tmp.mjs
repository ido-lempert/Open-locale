// Visual check: bulk "Mark all" preview dialog + orphan status option.
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { default: puppeteer } = await import('puppeteer-core');
const PG_PORT = 55461, API_PORT = 3000, WEB_PORT = 4200;
const root = process.cwd();
mkdirSync('/tmp/pptr', { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-pv-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api, web, browser;
const waitFor = async (url, ok = (r) => r.ok || r.status === 401, tries = 120) => {
  for (let i = 0; i < tries; i++) { if (await fetch(url).then((r) => ok(r)).catch(() => false)) return true; await new Promise((r) => setTimeout(r, 1000)); }
  return false;
};
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('ol_pv');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/ol_pv`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], { env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'pv', PORT: String(API_PORT) }, stdio: 'pipe' });
  if (!await waitFor(`http://127.0.0.1:${API_PORT}/api/projects`)) throw new Error('api down');
  web = spawn(join(root, 'node_modules', '.bin', 'nx'), ['serve', 'web', '--port', String(WEB_PORT)], { cwd: root, stdio: 'pipe' });
  if (!await waitFor(`http://127.0.0.1:${WEB_PORT}`, (r) => r.ok, 180)) throw new Error('web down');
  const API = `http://127.0.0.1:${API_PORT}/api`;
  const jwt = (await (await fetch(`${API}/auth/signup`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: 'pv@t.dev', password: 'pass1234', displayName: 'PV' }) })).json()).accessToken;
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };
  const pid = (await (await fetch(`${API}/projects`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Prev', slug: 'prev', baseLocale: 'en', locales: ['en','he'] }) })).json()).id;
  for (const n of ['a.one','a.two','a.three']) {
    const kid = (await (await fetch(`${API}/projects/${pid}/keys`, { method: 'POST', headers: H, body: JSON.stringify({ name: n }) })).json()).id;
    await fetch(`${API}/projects/${pid}/keys/${kid}/translations`, { method: 'PUT', headers: H, body: JSON.stringify({ locale: 'he', value: 'טקסט' }) });
  }
  browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'], defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('PAGEERROR:', String(err).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${WEB_PORT}/login`, { waitUntil: 'networkidle0' });
  await page.evaluate((t) => localStorage.setItem('ol_token', t), jwt);
  await page.goto(`http://127.0.0.1:${WEB_PORT}/projects/${pid}`, { waitUntil: 'networkidle0' });
  await page.select('select[aria-label="Filter by review status"]', 'UNVERIFIED');
  await page.select('select[aria-label="Import/export locale"]', 'he');
  await new Promise((r) => setTimeout(r, 600));
  let dialogText = '';
  page.on('dialog', (d) => { dialogText = d.message(); d.dismiss().catch(() => {}); });
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => b.textContent.trim() === 'Mark all')?.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  console.log('dialog:', JSON.stringify(dialogText));
  await page.screenshot({ path: '/tmp/pptr/review-queue-preview.png' });
  await fetch(`${API}/projects/${pid}`, { method: 'PATCH', headers: H, body: JSON.stringify({ customStatuses: ['LEGAL_HOLD'] }) });
  const keys = await (await fetch(`${API}/projects/${pid}/keys`, { headers: H })).json();
  await fetch(`${API}/projects/${pid}/keys/${keys[0].id}/translations/he/status`, { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'LEGAL_HOLD' }) });
  await fetch(`${API}/projects/${pid}`, { method: 'PATCH', headers: H, body: JSON.stringify({ customStatuses: [] }) });
  await page.select('select[aria-label="Filter by review status"]', '');
  await new Promise((r) => setTimeout(r, 800));
  const orphan = await page.$eval('select[aria-label="Review status for a.one in he"]', (n) => n.options[n.options.length - 1].textContent).catch(() => 'MISSING');
  console.log('orphan option:', JSON.stringify(orphan));
  await page.screenshot({ path: '/tmp/pptr/review-orphan.png' });
  console.log('done');
} finally {
  if (browser) await browser.close();
  if (web) web.kill('SIGTERM');
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
