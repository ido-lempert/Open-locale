// End-to-end visual pass: real PostgreSQL + built API + Angular dev server + headless Chrome.
// Drives signup -> project creation -> key/translation editing; saves screenshots to /downloads.
// Run: node scripts/e2e-visual.mjs  (requires: nx build api; npm i puppeteer-core available)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { default: puppeteer } = await import('puppeteer-core');

const PG_PORT = 55434, API_PORT = 3000, WEB_PORT = 4200;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const root = process.cwd();
const shots = process.env.SHOT_DIR ?? '/downloads';
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-e2e-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api, web, browser;
const waitFor = async (url, ok = (r) => r.ok || r.status === 401, tries = 120) => {
  for (let i = 0; i < tries; i++) {
    const hit = await fetch(url).then((r) => ok(r)).catch(() => false);
    if (hit) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_e2e');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_e2e`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'e2e-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  check('API up', await waitFor(`http://127.0.0.1:${API_PORT}/api/projects`));
  web = spawn(join(root, 'node_modules', '.bin', 'nx'), ['serve', 'web', '--port', String(WEB_PORT)], { cwd: root, stdio: 'pipe' });
  check('web dev server up', await waitFor(WEB, (r) => r.ok, 180));

  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('PAGEERROR:', String(err).slice(0, 300)));
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE:', msg.text().slice(0, 200)); });
  const shot = (n) => page.screenshot({ path: join(shots, n) });

  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  check('login page renders', (await page.$('.auth-card')) !== null);
  await shot('editor-01-login.png');

  // Sign up
  await page.click('.tabs button:nth-child(2)');
  await page.waitForSelector('input[name=displayName]');
  await page.type('input[name=displayName]', 'Demo User');
  await page.type('input[name=email]', 'demo@open-locale.dev');
  await page.type('input[name=password]', 'demo-password-1');
  await page.click('button.primary');
  await page.waitForSelector('.create', { timeout: 15000 });
  check('signup lands on projects page', page.url().includes('/projects'));
  await shot('editor-02-projects-empty.png');

  // Create a project
  await page.type('input[name=name]', 'Demo Shop');
  await page.type('input[name=slug]', 'demo-shop');
  await page.type('input[name=locales]', 'en, he');
  await page.click('.create button');
  await page.waitForFunction(() => document.body.textContent.includes('Demo Shop'), { timeout: 10000 });
  check('project appears in list', true);
  await shot('editor-03-projects.png');

  const waitText = async (text, ms = 10000) => {
    try {
      await page.waitForFunction((t) => document.body.textContent.includes(t), { timeout: ms }, text);
      return true;
    } catch {
      const body = await page.evaluate(() => document.body.innerText.slice(0, 400));
      console.log(`DIAG waiting for "${text}"; page shows:`, JSON.stringify(body));
      return false;
    }
  };
  // Open editor, add keys, translate
  await page.click('.cards a');
  await page.waitForSelector('.toolbar', { timeout: 10000 });
  await page.type('input[name=newKey]', 'home.title');
  await page.click('.inline button');
  check('first key added', await waitText('home.title'));
  const keyInput = await page.$('input[name=newKey]');
  await keyInput.evaluate((el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('input[name=newKey]', 'cart.checkout');
  await page.click('.inline button');
  check('second key added', await waitText('cart.checkout'));
  const cells = await page.$$('.grid tbody tr:first-child textarea');
  await cells[0].type('Welcome to the shop');
  await cells[0].evaluate((el) => el.blur());
  await cells[1].type('ברוכים הבאים לחנות');
  await cells[1].evaluate((el) => el.blur());
  try {
    await page.waitForFunction(
      () => [...document.querySelectorAll('.cell-status')].filter((e) => e.textContent.trim() === 'saved').length >= 2,
      { timeout: 15000 },
    );
    check('autosave confirms both locales', true);
  } catch {
    const statuses = await page.$$eval('.cell-status', (els) => els.map((e) => e.textContent));
    const keysDump = await page.evaluate(async () => {
      const token = localStorage.getItem('ol_token');
      const projId = location.pathname.split('/').pop();
      const res = await fetch(`/api/projects/${projId}/keys`, { headers: { Authorization: `Bearer ${token}` } });
      return JSON.stringify(await res.json());
    });
    console.log('DIAG statuses:', JSON.stringify(statuses));
    console.log('DIAG keys:', keysDump.slice(0, 500));
    check('autosave confirms both locales', false, '(see DIAG lines)');
  }
  await shot('editor-04-editor.png');

  // Persistence across reload
  await page.reload({ waitUntil: 'networkidle0' });
  const values = await page.$$eval('.grid tbody tr:first-child textarea', (els) => els.map((el) => el.value));
  check('translations persist after reload (en + he)',
    values.includes('Welcome to the shop') && values.includes('ברוכים הבאים לחנות'), JSON.stringify(values));
  await shot('editor-05-editor-reloaded.png');

  // Review statuses + history via UI
  const reviewSelect = (await page.$$('.grid tbody tr:first-child select.review'))[0];
  await reviewSelect.select('TRANSLATED');
  await page.waitForFunction(
    () => document.querySelector('.grid tbody tr:first-child select.review')?.className.includes('review-translated'),
    { timeout: 5000 },
  );
  check('status change reflected in UI', true);
  await page.click('.grid tbody tr:first-child .history-toggle');
  await page.waitForSelector('.history-list li', { timeout: 10000 });
  const histText = await page.$eval('.history-list', (el) => el.textContent);
  check('history lists the change with actor and value',
    histText.includes('translated') && histText.includes('Welcome to the shop') && histText.includes('Demo User'));
  await shot('editor-11-history.png');
  await page.click('.grid tbody tr:first-child .history-toggle');

  // Tags + filters via UI
  await page.click('.grid tbody tr:first-child .tags-toggle');
  await page.waitForSelector('.tag-edit', { timeout: 5000 });
  await page.type('.tag-edit', 'web, shop');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.textContent.includes('shop'), { timeout: 10000 });
  const chips = await page.$$eval('.grid tbody tr:first-child .tag-chip', (els) => els.map((e) => e.textContent.trim()));
  check('tags saved and shown as chips', chips.join(',') === 'web,shop', JSON.stringify(chips));
  await page.type('.tag-filter', 'web');
  await page.waitForFunction(
    () => document.querySelectorAll('.grid tbody tr:not(.history-row)').length === 1,
    { timeout: 10000 },
  );
  check('tag filter narrows the grid', true);
  await page.evaluate(() => { const el = document.querySelector('.tag-filter'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.select('select[aria-label="Filter by review status"]', 'TRANSLATED');
  await page.waitForFunction(
    () => document.querySelectorAll('.grid tbody tr:not(.history-row)').length === 1,
    { timeout: 10000 },
  );
  check('status filter narrows to reviewed keys', true);
  await page.select('select[aria-label="Filter by review status"]', '');
  await page.waitForFunction(
    () => document.querySelectorAll('.grid tbody tr:not(.history-row)').length === 2,
    { timeout: 10000 },
  );
  await shot('editor-12-tags-filters.png');

  // Comments via UI
  await page.click('.grid tbody tr:first-child .comments-toggle');
  await page.waitForSelector('.comment-form', { timeout: 5000 });
  await page.type('input[name=commentDraft]', 'Please double-check the checkout wording');
  await page.evaluate(() => {
    const form = document.querySelector('.comment-form');
    form.requestSubmit();
  });
  await page.waitForFunction(
    () => document.body.textContent.includes('Please double-check the checkout wording'),
    { timeout: 10000 },
  );
  const commentLine = await page.$eval('.history-row .history-list', (el) => el.textContent);
  check('comment listed with author', commentLine.includes('Demo User'), commentLine.slice(0, 80));
  let countOk = true;
  try {
    await page.waitForFunction(
      () => document.querySelector('.grid tbody tr:first-child .comments-toggle')?.textContent.includes('(1)'),
      { timeout: 10000 },
    );
  } catch {
    countOk = false;
    const dump = await page.$$eval('.comments-toggle', (els) => els.map((e) => e.textContent.trim()));
    const err = await page.$eval('.error', (e) => e.textContent).catch(() => null);
    console.log('DIAG toggles:', JSON.stringify(dump), 'error-banner:', JSON.stringify(err));
  }
  check('comment count updates on the toggle', countOk);
  await shot('editor-13-comments.png');
  await page.click('.grid tbody tr:first-child .comments-toggle');

  // Activity page
  await page.click('.activity-link');
  await page.waitForSelector('.activity-row', { timeout: 10000 });
  const actRows = await page.$$eval('.activity-row', (els) => els.map((e) => e.textContent));
  check('activity feed lists recent actions with actor',
    actRows.some((r) => r.includes('edited translation')) && actRows.some((r) => r.includes('commented on')) && actRows.every((r) => r.includes('Demo User')),
    `${actRows.length} rows`);
  await shot('editor-14-activity.png');
  await page.select('select[aria-label="Filter by action"]', 'comment.added');
  await page.waitForFunction(
    () => document.querySelectorAll('.activity-row').length === 1,
    { timeout: 10000 },
  );
  check('activity filter narrows to comments', true);

  // Screenshots via UI
  await page.click('.back');
  await page.waitForSelector('.grid tbody tr', { timeout: 10000 });
  const pngPath = join(tmpdir(), 'ol-e2e-shot.png');
  writeFileSync(pngPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  await page.click('.grid tbody tr:first-child .shots-toggle');
  await page.waitForSelector('.shot-upload input[type=file]', { timeout: 5000 });
  const fileInput = await page.$('.shot-upload input[type=file]');
  await fileInput.uploadFile(pngPath);
  await page.waitForSelector('.shots-list img', { timeout: 10000 });
  check('screenshot uploaded and rendered', true);
  await page.waitForFunction(
    () => document.querySelector('.grid tbody tr:first-child .shots-toggle')?.textContent.includes('(1)'),
    { timeout: 10000 },
  );
  check('screenshot count updates on the toggle', true);
  await shot('editor-15-screenshots.png');
  await page.click('.grid tbody tr:first-child .shots-toggle');
  await page.waitForSelector('.grid tbody tr', { timeout: 10000 });

  const projId = page.url().split('/').pop();
  // Settings screen: rename, add locale, verify grid column appears
  await page.click('.settings-link');
  await page.waitForSelector('.panel', { timeout: 10000 });
  await shot('editor-06-settings.png');
  const nameInput = await page.$('input[name=name]');
  await nameInput.evaluate((el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await nameInput.type('Demo Shop IL');
  await page.click('.panel button.primary');
  try {
    await page.waitForFunction(() => document.querySelector('input[name=name]')?.value === 'Demo Shop IL', { timeout: 10000 });
    check('project renamed via settings', true);
  } catch {
    const val = await page.$eval('input[name=name]', (el) => el.value);
    const err = await page.evaluate(() => document.querySelector('.error')?.textContent ?? '');
    console.log('DIAG name input:', JSON.stringify(val), 'error el:', JSON.stringify(err));
    check('project renamed via settings', false);
  }
  const localeResponses = [];
  const onRes = (r) => { if (r.url().includes('/locales')) localeResponses.push(`${r.request().method()} ${r.status()}`); };
  page.on('response', onRes);
  await page.type('input[name=newLocale]', 'ar');
  await page.evaluate(() => {
    const form = document.querySelector('input[name=newLocale]').closest('form');
    form.requestSubmit();
  });

  try {
    await page.waitForFunction(
      () => [...document.querySelectorAll('.locale-list code')].some((e) => e.textContent.trim() === 'ar'),
      { timeout: 10000 },
    );
    check('locale ar added via settings', true);
  } catch {
    const diag = await page.evaluate(() => ({
      codes: [...document.querySelectorAll('.locale-list code')].map((e) => e.textContent.trim()),
      error: document.querySelector('.error')?.textContent ?? '',
      localeInput: document.querySelector('input[name=newLocale]')?.value ?? null,
    }));
    diag.form = await page.evaluate(() => {
      const input = document.querySelector('input[name=newLocale]');
      const form = input?.closest('form');
      const btn = form?.querySelector('button');
      return { formHtml: form?.outerHTML.slice(0, 300), btnDisabled: btn?.disabled, btnText: btn?.textContent };
    });
    console.log('DIAG locale add:', JSON.stringify(diag), 'network:', JSON.stringify(localeResponses));
    page.off('response', onRes);
    check('locale ar added via settings', false);
  }
  // Base locale guard: base locale has no Remove button
  const baseHasRemove = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.locale-list li')].find((el) => el.textContent.includes('base'));
    return li ? !!li.querySelector('button') : true;
  });
  check('base locale cannot be removed from UI', !baseHasRemove);
  await page.click('.back');
  await page.waitForSelector('.grid', { timeout: 10000 });
  const headers = await page.$$eval('.grid th', (els) => els.map((e) => e.textContent.trim()));
  check('editor grid shows new locale column', headers.includes('ar') || headers.includes('AR'), JSON.stringify(headers));

  // API tokens via UI: create read-only, exercise it, revoke it
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[name=tokenName]', { timeout: 10000 });
  await page.type('input[name=tokenName]', 'ci');
  await page.select('select[name=tokenScope]', 'read');
  await page.click('select[name=tokenScope] ~ button');
  await page.waitForSelector('.token-reveal code', { timeout: 10000 });
  const rawToken = await page.$eval('.token-reveal code', (el) => el.textContent);
  check('token revealed once after creation', rawToken.startsWith('ol_'));
  // Security: never screenshot the raw token value.
  const tokenExercise = await page.evaluate(async (tok) => {
    const headers = { 'Content-Type': 'application/json', 'X-Api-Key': tok };
    const pid = location.pathname.split('/')[2];
    const get = await fetch(`/api/projects/${pid}`, { headers });
    const write = await fetch(`/api/projects/${pid}/keys`, {
      method: 'POST', headers, body: JSON.stringify({ name: 'should.fail' }),
    });
    return { get: get.status, write: write.status };
  }, rawToken);
  check('read-only token: GET 200, write 403', tokenExercise.get === 200 && tokenExercise.write === 403, JSON.stringify(tokenExercise));
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('.locale-list li')].find((el) => el.textContent.includes('ci'));
    [...li.querySelectorAll('button')].find((b) => b.textContent === 'Revoke').click();
  });
  await page.waitForFunction(() => document.body.textContent.includes('Yes, revoke'), { timeout: 5000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Yes, revoke').click());
  await page.waitForFunction(() => !document.body.textContent.includes('Yes, revoke'), { timeout: 5000 });
  const afterRevoke = await page.evaluate(async (tok) => {
    const pid = location.pathname.split('/')[2];
    const res = await fetch(`/api/projects/${pid}`, { headers: { 'X-Api-Key': tok } });
    return res.status;
  }, rawToken);
  check('revoked token rejected (401)', afterRevoke === 401, `got ${afterRevoke}`);
  // Safe to capture now: the panel shows only names/scopes/dates, no raw token.
  await shot('editor-10-tokens.png');

  // Mobile viewport evidence (390px)
  await page.goto(`${WEB}/projects/${projId}`, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.toolbar', { timeout: 10000 });
  await shot('editor-07-mobile-editor.png');
  await page.goto(`${WEB}/projects`, { waitUntil: 'networkidle0' });
  await shot('editor-08-mobile-projects.png');
  await page.goto(`${WEB}/projects/${projId}`, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 320, height: 700 });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.toolbar', { timeout: 10000 });
  await shot('editor-09-mobile-320.png');
  check('mobile screenshots captured', true);
} finally {
  await browser?.close().catch(() => {});
  web?.kill('SIGTERM'); api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('E2E visual pass complete');
