// End-to-end visual pass: real PostgreSQL + built API + Angular dev server + headless Chrome.
// Drives signup -> project creation -> key/translation editing; saves screenshots to /downloads.
// Run: node scripts/e2e-visual.mjs  (requires: nx build api; npm i puppeteer-core available)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { default: puppeteer } = await import('puppeteer-core');
import { createHmac } from 'node:crypto';
// Independent RFC 6238 for driving the 2FA UI flow.
const B32C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32dec = (s) => { let bits = 0, v = 0; const o = []; for (const ch of s.toUpperCase().replace(/=+$/, '')) { v = (v << 5) | B32C.indexOf(ch); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); };
const totp = (secret, off = 0) => { const c = Math.floor(Date.now() / 1000 / 30) + off; const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(c)); const h = createHmac('sha1', b32dec(secret)).update(m).digest(); const o = h[h.length - 1] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };

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
  const pngPath = join(root, 'scripts', 'fixtures', 'checkout-screen.png');
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

  // Translation memory via UI: new key reuses an existing source string
  const keyInput2 = await page.$('input[name=newKey]');
  await keyInput2.evaluate((el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('input[name=newKey]', 'cart.note');
  await page.click('.inline button');
  check('third key added', await waitText('cart.note'));
  const noteCells = await page.$$('.grid tbody tr:nth-child(2) textarea');
  await noteCells[0].type('Welcome to the shop');
  await noteCells[0].evaluate((el) => el.blur());
  await page.waitForFunction(
    () => [...document.querySelectorAll('.grid tbody tr:nth-child(2) .cell-status')].some((e) => /saved/i.test(e.textContent)),
    { timeout: 10000 },
  );
  const noteHe = (await page.$$('.grid tbody tr:nth-child(2) textarea'))[1];
  await noteHe.click();
  await page.waitForSelector('.grid tbody tr:nth-child(2) .tm-pick', { timeout: 10000 });
  const sugText = await page.$eval('.grid tbody tr:nth-child(2) .tm-pick', (el) => el.textContent);
  check('TM suggestion appears with score', sugText.includes('ברוכים הבאים') && sugText.includes('memory 100%'), sugText.slice(0, 60));
  await shot('editor-17-tm.png');
  await page.click('.grid tbody tr:nth-child(2) .tm-pick');
  await page.waitForFunction(
    () => document.querySelectorAll('.grid tbody tr:nth-child(2) textarea')[1]?.value.includes('ברוכים הבאים'),
    { timeout: 10000 },
  );
  check('applying suggestion fills the cell and saves', true);

  // Tasks page
  await page.click('.tasks-link');
  await page.waitForSelector('.task-form', { timeout: 10000 });
  await page.type('input[name=taskTitle]', 'Translate checkout to Hebrew');
  await page.type('input[name=taskDescription]', 'All cart.* keys, ready for review');
  await page.evaluate(() => {
    const form = document.querySelector('.task-form');
    form.requestSubmit();
  });
  await page.waitForFunction(
    () => document.body.textContent.includes('Translate checkout to Hebrew'),
    { timeout: 10000 },
  );
  await page.waitForSelector('.task-row', { timeout: 5000 });
  check('task created and listed', true);
  await page.select('.task-row select[aria-label^="Status for"]', 'IN_PROGRESS');
  await page.waitForFunction(
    () => document.querySelector('.task-row .task-status')?.textContent.trim() === 'in progress',
    { timeout: 10000 },
  );
  check('task status change reflected in UI', true);
  await shot('editor-16-tasks.png');
  await page.click('.back');
  await page.waitForSelector('.grid tbody tr', { timeout: 10000 });

  const projId = page.url().split('/').pop();
  // --- Glossary: create term via UI, hint appears in editor ---
  await page.click('.glossary-link');
  await page.waitForSelector('.task-form', { timeout: 10000 });
  await page.type('input[name=gTerm]', 'Welcome');
  await page.evaluate(() => { document.querySelector('.panel form').requestSubmit(); });
  const welcomeHe = await page.waitForSelector('input[aria-label="Welcome in he"]', { timeout: 10000 }).catch(() => null);
  check('glossary term created via UI with per-locale translation fields', !!welcomeHe);
  if (welcomeHe) {
    await page.type('input[aria-label="Welcome in he"]', 'ברוכים');
    await page.evaluate(() => { document.querySelector('input[aria-label="Welcome in he"]').blur(); });
    await new Promise((r) => setTimeout(r, 800));
    await page.click('.back');
    await page.waitForSelector('.grid tbody tr', { timeout: 10000 });
    const hintShown = await page.waitForFunction(() => {
      const chips = [...document.querySelectorAll('.glossary-hint')];
      return chips.length >= 2 && chips.every((c) => c.textContent.includes('he:') && c.textContent.includes('Welcome') && c.textContent.includes('ברוכים'));
    }, { timeout: 10000 }).then(() => true).catch(() => false);
    check('editor shows locale-labeled glossary hint under each target cell', hintShown);
    await shot('editor-18-glossary.png');
  }

  // --- QA: placeholder mismatch surfaces on the QA page (already on the editor) ---
  await page.waitForSelector('.grid', { timeout: 10000 });
  const keyInput3 = await page.$('input[name=newKey]');
  await keyInput3.evaluate((el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('input[name=newKey]', 'cart.total');
  await page.click('.inline button');
  check('cart.total key added', await waitText('cart.total'));
  const totalEn = (await page.$$('.grid tbody tr:nth-child(3) textarea'))[0];
  await totalEn.type('Total: {amount}');
  await totalEn.evaluate((el) => el.blur());
  await page.waitForFunction(
    () => [...document.querySelectorAll('.grid tbody tr:nth-child(3) .cell-status')].some((e) => /saved/i.test(e.textContent)),
    { timeout: 10000 },
  );
  const totalHe = (await page.$$('.grid tbody tr:nth-child(3) textarea'))[1];
  await totalHe.type('סה"כ לתשלום');
  await totalHe.evaluate((el) => el.blur());
  await page.waitForFunction(
    () => [...document.querySelectorAll('.grid tbody tr:nth-child(3) .cell-status')].filter((e) => /saved/i.test(e.textContent)).length >= 2,
    { timeout: 10000 },
  );
  await page.click('.qa-link');
  await page.waitForSelector('.qa-table', { timeout: 10000 });
  const qaRow = await page.waitForFunction(() => {
    const t = document.body.textContent || '';
    return t.includes('cart.total') && t.includes('Placeholder mismatch') && t.includes('{amount}');
  }, { timeout: 10000 }).then(() => true).catch(() => false);
  check('QA page lists the placeholder mismatch for cart.total', qaRow);
  await shot('editor-19-qa.png');

  // --- CSV via UI: import a new key, verify notice + grid, export buttons visible ---
  await page.click('.back');
  await page.waitForSelector('.grid', { timeout: 10000 });
  const csvFile = '/tmp/e2e-import.csv';
  writeFileSync(csvFile, 'key,value\napp.subtitle,"Welcome, friend"\n');
  // The IO toolbar has a format picker; select CSV first so the import input and the safe/raw note apply to CSV.
  await page.select('select[aria-label="Import/export format"]', 'csv');
  const csvInput = await page.$('input[type=file]');
  await csvInput.uploadFile(csvFile);
  const csvNotice = await page.waitForFunction(() => (document.body.textContent || '').includes('(CSV,'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('CSV import via UI shows summary notice', csvNotice);
  check('CSV-imported key appears in grid', await waitText('app.subtitle'));
  const csvControls = await page.evaluate(() => (document.body.textContent || '').includes('spreadsheet-safe') && (document.body.textContent || '').includes('mode=raw'));
  check('UI visibly distinguishes spreadsheet-safe CSV from lossless raw', csvControls);
  await shot('editor-20-csv.png');

  // Settings screen: rename, add locale, verify grid column appears (on the editor)
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
  await page.waitForFunction(() => [...document.querySelectorAll('.locale-list li')].some((el) => el.textContent.includes('ci') && [...el.querySelectorAll('button')].some((b) => b.textContent === 'Revoke')), { timeout: 10000 });
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


  const loginAs = async (email, password) => {
    await page.evaluate(() => localStorage.removeItem('ol_token'));
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[name=email]');
    await page.type('input[name=email]', email);
    await page.type('input[name=password]', password);
    await page.click('button.primary');
    await page.waitForFunction(() => location.pathname.includes('/projects') && !location.pathname.includes('/login'), { timeout: 15000 });
  };

  // --- Webhooks via UI: create (one-time secret reveal), failed-create
  // feedback, disable/enable, 480 layout, member read-only view, delete ---
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[aria-label="Webhook URL"]', { timeout: 10000 });
  await page.type('input[aria-label="Webhook URL"]', 'https://hooks.example.com/open-locale');
  // translation.updated is pre-checked; also check project.restored.
  await page.evaluate(() => {
    const cb = document.querySelector('input[name=hookEvRestore]');
    if (!cb.checked) cb.click();
  });
  await page.evaluate(() => { document.querySelector('input[aria-label="Webhook URL"]').closest('form').requestSubmit(); });
  await page.waitForSelector('.token-reveal code', { timeout: 10000 });
  check('webhook created via UI with one-time secret reveal',
    (await page.$eval('.token-reveal code', (el) => el.textContent)).length >= 32);
  await page.waitForFunction(() => [...document.querySelectorAll('.locale-list li')].some((el) => el.textContent.includes('hooks.example.com') && el.textContent.includes('translation.updated + project.restored')), { timeout: 10000 });
  check('webhook listed with URL and both events', true);

  // Failed create: a denied address is refused with visible feedback, the
  // typed URL is retained for correction, and no row appears. This verifies
  // the UI surfacing of the existing create-time string validation; the
  // delivery-time egress rules are covered by the API-level suites.
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Webhook URL"]');
    input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.type('input[aria-label="Webhook URL"]', 'http://192.168.1.1/hook');
  await page.evaluate(() => { document.querySelector('input[aria-label="Webhook URL"]').closest('form').requestSubmit(); });
  await page.waitForFunction(() => (document.querySelector('[role=alert]')?.textContent || '').includes('denied address range'), { timeout: 10000 });
  check('failed webhook create shows the refusal reason', true);
  check('failed webhook create retains the typed URL', (await page.$eval('input[aria-label="Webhook URL"]', (el) => el.value)) === 'http://192.168.1.1/hook');
  check('refused webhook does not appear in the list', await page.evaluate(() => ![...document.querySelectorAll('.locale-list li')].some((el) => el.textContent.includes('192.168.1.1'))));
  // Clear the retained failure text so later shots show a clean form.
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Webhook URL"]');
    input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Fresh page load: the reveal is component state, so it is gone; the list
  // only ever carries the public view (no secret) - safe to screenshot.
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => [...document.querySelectorAll('.locale-list li')].some((el) => el.textContent.includes('hooks.example.com')), { timeout: 10000 });
  check('secret reveal does not persist across reloads', await page.evaluate(() => !document.querySelector('.token-reveal')));
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('.locale-list li')].find((el) => el.textContent.includes('hooks.example.com'));
    [...li.querySelectorAll('button')].find((b) => b.textContent === 'Disable').click();
  });
  await page.waitForFunction(() => [...document.querySelectorAll('.locale-list li')].some((el) => el.textContent.includes('hooks.example.com') && el.textContent.includes('disabled')), { timeout: 10000 });
  check('webhook disabled via UI shows the disabled badge', true);
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('.locale-list li')].find((el) => el.textContent.includes('hooks.example.com'));
    [...li.querySelectorAll('button')].find((b) => b.textContent === 'Enable').click();
  });
  await page.waitForFunction(() => {
    const li = [...document.querySelectorAll('.locale-list li')].find((el) => el.textContent.includes('hooks.example.com'));
    return !!li && !li.textContent.includes('disabled');
  }, { timeout: 10000 });
  check('webhook re-enabled via UI clears the badge', true);

  // Long-URL row for wrap verification (API fixture; UI creation proved above).
  const ownerJwtWh = await page.evaluate(() => localStorage.getItem('ol_token'));
  const longHook = await (await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/webhooks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJwtWh}` }, body: JSON.stringify({ url: 'https://hooks.example.com/open-locale/a/very/long/path/that/keeps/going/and/going/for/wrapping/verification', events: ['translation.updated'] }) })).json();
  check('long-URL webhook fixture created', !!longHook.id);
  await page.setViewport({ width: 480, height: 800 });
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => [...document.querySelectorAll('.locale-list li')].some((el) => el.textContent.includes('wrapping/verification')), { timeout: 10000 });
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => x.textContent === 'Webhooks');
    h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70);
  });
  check('480 webhook layout has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= 480));
  await shot('editor-34b-webhooks-narrow.png');
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => [...document.querySelectorAll('.locale-list li')].some((el) => el.textContent.includes('wrapping/verification')), { timeout: 10000 });
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => x.textContent === 'Webhooks');
    h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70);
  });
  await shot('editor-34-webhooks.png');

  // Member read-only view: rows visible, no controls, no create form.
  const whMember = await (await fetch(`http://127.0.0.1:${API_PORT}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `whmember${Date.now()}@t.dev`, password: 'whmember-pass-1', displayName: 'Webhook Viewer' }) })).json();
  await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJwtWh}` }, body: JSON.stringify({ email: whMember.user.email, role: 'MEMBER', allowedLocales: [] }) });
  await loginAs(whMember.user.email, 'whmember-pass-1');
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => [...document.querySelectorAll('.locale-list li')].some((el) => el.textContent.includes('hooks.example.com')), { timeout: 10000 });
  check('member sees the webhook list', true);
  check('member sees no webhook row controls', await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.locale-list li')].filter((el) => el.textContent.includes('hooks.example.com'));
    return rows.length > 0 && rows.every((el) => el.querySelectorAll('button').length === 0);
  }));
  check('member sees no webhook create form', await page.evaluate(() => !document.querySelector('input[aria-label="Webhook URL"]')));
  await loginAs('demo@open-locale.dev', 'demo-password-1');

  // Owner deletes the original hook through the UI; the long fixture is
  // cleaned up through the API.
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => [...document.querySelectorAll('.locale-list li')].some((el) => el.textContent.includes('hooks.example.com')), { timeout: 10000 });
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('.locale-list li')].find((el) => el.textContent.includes('hooks.example.com/open-locale') && !el.textContent.includes('wrapping'));
    [...li.querySelectorAll('button')].find((b) => b.textContent === 'Delete').click();
  });
  await page.waitForFunction(() => document.body.textContent.includes('Yes, delete'), { timeout: 5000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Yes, delete').click());
  await page.waitForFunction(() => ![...document.querySelectorAll('.locale-list li')].some((el) => el.textContent.includes('hooks.example.com/open-locale') && !el.textContent.includes('wrapping')), { timeout: 10000 });
  check('webhook deleted via UI after inline confirm', true);
  await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/webhooks/${longHook.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${ownerJwtWh}` } });
  const hooksAfter = await page.evaluate(async () => {
    const token = localStorage.getItem('ol_token');
    const pid = location.pathname.split('/')[2];
    return (await fetch(`/api/projects/${pid}/webhooks`, { headers: { Authorization: `Bearer ${token}` } })).json();
  });
  check('API agrees every test webhook is gone', Array.isArray(hooksAfter) && !hooksAfter.some((h) => h.url.includes('hooks.example.com')));


  // --- Groups: create via UI, union copy visible, desktop + narrow shots ---
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[aria-label="Group name"]', { timeout: 10000 });
  const unionCopy = await page.evaluate(() => document.body.textContent);
  check('groups panel explains union never reduces a direct grant', unionCopy.includes('restrictive group never reduces an unrestricted direct grant'));
  check('groups panel explains team-wide visibility (no per-project hiding)', unionCopy.includes('no per-project hiding'));
  check('groups panel explains immediate effect of role changes', unionCopy.includes('Changes apply immediately'));
  await page.type('input[aria-label="Group name"]', 'reviewers');
  await page.select('select[aria-label="New group role"]', 'MEMBER');
  await page.type('input[aria-label="Group locales"]', 'he');
  await page.evaluate(() => { document.querySelector('input[aria-label="Group name"]').closest('form').requestSubmit(); });
  const groupShown = await page.waitForFunction(() => (document.body.textContent || '').includes('reviewers'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('group created via UI and listed', groupShown);
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => x.textContent === 'Groups');
    h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70);
  });
  await shot('editor-24-groups.png');
  await page.setViewport({ width: 480, height: 800 });
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => x.textContent === 'Groups');
    h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70);
  });
  await shot('editor-25-groups-narrow.png');
  const narrowOk = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => x.textContent === 'Groups');
    const r = h.getBoundingClientRect();
    const headingVisible = r.top >= 0 && r.left >= 0 && r.right <= window.innerWidth;
    const noHorizontalOverflow = document.documentElement.scrollWidth <= window.innerWidth;
    return headingVisible && noHorizontalOverflow;
  });
  check('groups panel fits narrow viewport without horizontal overflow', narrowOk === true);
  await page.setViewport({ width: 1280, height: 800 });

  // --- Groups click-through: member add/remove, promote/demote with
  // inherited display, cancel+confirm delete, failed mutation, low-role ---
  const user2 = await (await fetch(`http://127.0.0.1:${API_PORT}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `member${Date.now()}@t.dev`, password: 'member-pass-1', displayName: 'Second Member' }) })).json();
  const ownerJwt = await page.evaluate(() => localStorage.getItem('ol_token'));
  const added2 = await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJwt}` }, body: JSON.stringify({ email: user2.user.email, role: 'MEMBER', allowedLocales: ['ar'] }) });
  check('second member added to team (setup)', added2.status === 201, String(added2.status));
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('select[aria-label="Add member to group"]', { timeout: 10000 });

  // Add member via the UI dropdown.
  await page.select('select[aria-label="Add member to group"]', user2.user.id);
  // Wait for the actual chip (its remove button), not the dropdown option,
  // which already contains the member's name before the add completes.
  const chipShown = await page.waitForFunction(() => !!document.querySelector('button[aria-label="Remove from group"]'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('member added to group via UI, chip visible', chipShown);
  const unionShown = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.locale-list li')].map((li) => li.textContent);
    return rows.some((t) => t.includes('Second Member') && t.includes('effective locales: ar, he'));
  });
  check('Members panel shows inherited union (ar, he)', unionShown);

  // Promote group to ADMIN via UI: inherited role becomes visible.
  await page.select('select[aria-label="Group role"]', 'ADMIN');
  const promoted = await page.waitForFunction(() => (document.body.textContent || '').includes('effective: admin via group'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('promotion via UI shows inherited admin on member', promoted);
  await page.select('select[aria-label="Group role"]', 'MEMBER');
  const demoted = await page.waitForFunction(() => (document.body.textContent || '').includes('effective locales: ar, he'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('demotion via UI restores locale-scoped effective grant', demoted);

  // Remove member via the UI chip button; inherited note disappears.
  await page.evaluate(() => { [...document.querySelectorAll('button[aria-label="Remove from group"]')][0].click(); });
  const chipGone = await page.waitForFunction(() => !(document.body.textContent || '').includes('Second Member') || !document.body.textContent.includes('effective locales'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('member removed from group via UI', chipGone);

  // Delete: cancel keeps the group, confirm removes it.
  let dialogAction = 'dismiss';
  page.on('dialog', (d) => (dialogAction === 'accept' ? d.accept() : d.dismiss()));
  await page.evaluate(() => { [...document.querySelectorAll('button.danger')].find((b) => b.textContent === 'Delete').click(); });
  await new Promise((r) => setTimeout(r, 600));
  check('cancel delete keeps the group', await page.evaluate(() => (document.body.textContent || '').includes('reviewers')));
  dialogAction = 'accept';
  await page.evaluate(() => { [...document.querySelectorAll('button.danger')].find((b) => b.textContent === 'Delete').click(); });
  const groupGone = await page.waitForFunction(() => !(document.body.textContent || '').includes('reviewers'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('confirm delete removes the group', groupGone);

  // Failed mutation surfaces a visible error and changes nothing.
  await page.type('input[aria-label="Group name"]', 'dup');
  await page.evaluate(() => { document.querySelector('input[aria-label="Group name"]').closest('form').requestSubmit(); });
  await page.waitForFunction(() => (document.body.textContent || '').includes('dup'), { timeout: 10000 });
  await page.type('input[aria-label="Group name"]', 'dup');
  await page.evaluate(() => { document.querySelector('input[aria-label="Group name"]').closest('form').requestSubmit(); });
  const dupErr = await page.waitForFunction(() => {
    const el = document.querySelector('.error[role="alert"], .error');
    return !!el && el.textContent.trim().length > 0;
  }, { timeout: 10000 }).then(() => true).catch(() => false);
  check('duplicate group shows visible error', dupErr);
  const dupCount = await page.evaluate(() => [...document.querySelectorAll('.locale-list li strong')].filter((el) => el.textContent === 'dup').length);
  check('failed mutation changed nothing (one dup group)', dupCount === 1, `count=${dupCount}`);

  // Low-role / effective-role sessions: a group-PROMOTED admin sees exactly
  // the controls their effective role permits; a plain member sees none.
  // Owner grants user2 an ADMIN group (setup via API).
  const leads = await (await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJwt}` }, body: JSON.stringify({ name: 'leads', role: 'ADMIN' }) })).json();
  await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/groups/${leads.id}/members/${user2.user.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${ownerJwt}` } });

  await loginAs(user2.user.email, 'member-pass-1');
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => (document.body.textContent || '').includes('Groups'), { timeout: 10000 });
  const promotedView = await page.evaluate(() => {
    const rowOf = (name) => [...document.querySelectorAll('.locale-list li')].find((li) => li.querySelector('strong')?.textContent === name);
    return {
      createForm: !!document.querySelector('input[aria-label="Group name"]'),
      dupSelect: !!rowOf('dup')?.querySelector('select[aria-label="Group role"]'),
      dupDelete: !!rowOf('dup')?.querySelector('button.danger'),
      leadsSelect: !!rowOf('leads')?.querySelector('select[aria-label="Group role"]'),
      leadsDelete: !!rowOf('leads')?.querySelector('button.danger'),
      publishBtn: [...document.querySelectorAll('button')].some((b) => b.textContent === 'Publish bundle'),
      dangerZone: (document.body.textContent || '').includes('Danger zone'),
    };
  });
  check('group-promoted admin sees the create form', promotedView.createForm);
  check('group-promoted admin can manage a MEMBER group (controls shown)', promotedView.dupSelect && promotedView.dupDelete, JSON.stringify(promotedView));
  check('group-promoted admin gets NO controls on an ADMIN group at own rank', !promotedView.leadsSelect && !promotedView.leadsDelete);
  check('admin-level controls consistent: publish + danger zone visible to effective admin', promotedView.publishBtn && promotedView.dangerZone);

  // Plain member (no groups): view-only, admin controls absent everywhere.
  const user3 = await (await fetch(`http://127.0.0.1:${API_PORT}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `plain${Date.now()}@t.dev`, password: 'plain-pass-1', displayName: 'Plain Member' }) })).json();
  await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJwt}` }, body: JSON.stringify({ email: user3.user.email, role: 'MEMBER', allowedLocales: [] }) });
  const u3 = await fetch(`http://127.0.0.1:${API_PORT}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user3.user.email, password: 'plain-pass-1' }) });
  const u3jwt = (await u3.json()).accessToken;
  const pubAsMember = await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/ota/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u3jwt}` }, body: JSON.stringify({}) });
  check('server still rejects OTA publish by a plain member (403)', pubAsMember.status === 403, String(pubAsMember.status));
  const delAsMember = await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${u3jwt}` } });
  check('server still rejects project delete by a plain member (403)', delAsMember.status === 403, String(delAsMember.status));
  await loginAs(user3.user.email, 'plain-pass-1');
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => (document.body.textContent || '').includes('Groups'), { timeout: 10000 });
  const plainView = await page.evaluate(() => ({
    seesList: (document.body.textContent || '').includes('dup'),
    create: !!document.querySelector('input[aria-label="Group name"]'),
    del: [...document.querySelectorAll('.locale-list button')].some((b) => b.textContent === 'Delete'),
    add: !!document.querySelector('select[aria-label="Add member to group"]'),
    roleSelect: !!document.querySelector('select[aria-label="Group role"]'),
    publishBtn: [...document.querySelectorAll('button')].some((b) => b.textContent === 'Publish bundle'),
    dangerZone: (document.body.textContent || '').includes('Danger zone'),
  }));
  check('plain member can view the groups list', plainView.seesList);
  check('plain member has NO group mutation controls', !plainView.create && !plainView.del && !plainView.add && !plainView.roleSelect, JSON.stringify(plainView));
  check('plain member has no publish button or danger zone', !plainView.publishBtn && !plainView.dangerZone);
  const plainMemberControls = await page.evaluate(() => ({
    addForm: !!document.querySelector('input[aria-label="Member email"]'),
    roleSelect: !!document.querySelector('select[aria-label="Role"]'),
    removeBtn: [...document.querySelectorAll('.locale-list button.danger')].some((b) => b.textContent === 'Remove'),
  }));
  check('plain member has NO member-management controls either', !plainMemberControls.addForm && !plainMemberControls.roleSelect && !plainMemberControls.removeBtn, JSON.stringify(plainMemberControls));
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => x.textContent === 'Groups');
    h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70);
  });
  await shot('editor-24c-groups-member-view.png');
  await loginAs('demo@open-locale.dev', 'demo-password-1');

  // --- Task key locks: owner locks home.title through the tasks UI; a
  // plain member's editor save is rejected; DONE releases the lock ---
  await page.goto(`${WEB}/projects/${projId}`, { waitUntil: 'networkidle0' });
  await page.click('.tasks-link');
  await page.waitForSelector('.task-form', { timeout: 10000 });
  await page.type('input[name=taskTitle]', 'Lock home.title');
  // The key options load asynchronously; wait for the one we need.
  // (ngModel prefixes option values with their index, so match by text
  // and toggle selected directly - the same pattern as taskDependsOn.)
  await page.waitForFunction(
    () => [...document.querySelectorAll('select[name=taskLockKeys] option')].some((o) => o.textContent === 'home.title'),
    { timeout: 10000 });
  await page.evaluate(() => {
    const sel = document.querySelector('select[name=taskLockKeys]');
    const opt = [...sel.options].find((o) => o.textContent === 'home.title');
    opt.selected = true;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.click('input[name=taskLockToggle]');
  await page.evaluate(() => { document.querySelector('.task-form').requestSubmit(); });
  const chipOk = await page.waitForFunction(
    () => [...document.querySelectorAll('.lock-chip')].some((e) => e.textContent.includes('locks 1 key(s)') && e.textContent.includes('home.title')),
    { timeout: 10000 }).then(() => true).catch(() => false);
  check('lock chip lists the locked key on the task row', chipOk);
  const caveatOk = await page.evaluate(() => (document.body.textContent || '').includes('branch merges, snapshot restores and key deletion'));
  check('lock toggle shows the full enforcement scope note', caveatOk);
  const caveatImportOk = await page.evaluate(() => (document.body.textContent || '').includes('Imports skip locked keys and report them'));
  check('lock scope note spells out partial-import behavior', caveatImportOk);
  await page.evaluate(() => {
    const chip = document.querySelector('.lock-chip');
    if (chip) { chip.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }
  });
  await shot('editor-31-tasks-lock.png');
  await page.setViewport({ width: 480, height: 800 });
  const lockNarrowOk = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check('tasks lock UI fits narrow viewport without horizontal overflow', lockNarrowOk === true);
  const depHeight = await page.evaluate(() => document.querySelector('select[name=taskDependsOn]').getBoundingClientRect().height);
  check('predecessor select keeps single-line height at 480px', depHeight > 0 && depHeight < 60, `height=${depHeight}`);
  await shot('editor-31b-tasks-lock-narrow.png');
  await page.setViewport({ width: 1280, height: 800 });

  await loginAs(user3.user.email, 'plain-pass-1');
  await page.goto(`${WEB}/projects/${projId}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.grid tbody tr', { timeout: 10000 });
  // Real typing: (blur)="save(...)" only fires after an actual focus.
  const lockRowIdx = await page.evaluate(() => [...document.querySelectorAll('.grid tbody tr')].findIndex((r) => r.textContent.includes('home.title')));
  const lockCells = await page.$$(`.grid tbody tr:nth-child(${lockRowIdx + 1}) textarea`);
  await lockCells[1].click();
  await lockCells[1].type('member attempt');
  await lockCells[1].evaluate((el) => el.blur());
  const saveFailed = await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('.grid tbody tr')].find((r) => r.textContent.includes('home.title'));
    return [...row.querySelectorAll('.cell-status')].some((e) => /save failed/i.test(e.textContent));
  }, { timeout: 10000 }).then(() => true).catch(() => false);
  check('locked key: plain member editor save rejected (save failed)', saveFailed);
  const reasonShown = await page.waitForFunction(() =>
    [...document.querySelectorAll('.cell-error-reason')].some((e) => e.textContent.includes('locked by task')),
    { timeout: 5000 }).then(() => true).catch(() => false);
  check('cell shows the server lock reason (not a blind retry)', reasonShown);
  await page.evaluate(() => {
    // The locked row is the grid's last: align the reason's bottom edge so
    // the full message is inside the viewport (top-align clamps short).
    const el = document.querySelector('.cell-error-reason') ?? document.querySelector('.cell-status.retry');
    if (el) el.scrollIntoView({ block: 'end' });
  });
  await shot('editor-32-lock-save-failed.png');

  const lockTasks = await (await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/tasks`, { headers: { Authorization: `Bearer ${ownerJwt}` } })).json();
  const lockTaskId = lockTasks.find((t) => t.title === 'Lock home.title').id;
  await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/tasks/${lockTaskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJwt}` }, body: JSON.stringify({ status: 'DONE' }) });
  const lockCells2 = await page.$$(`.grid tbody tr:nth-child(${lockRowIdx + 1}) textarea`);
  await lockCells2[1].click();
  await lockCells2[1].type('member retry');
  await lockCells2[1].evaluate((el) => el.blur());
  const saveOkAfterDone = await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('.grid tbody tr')].find((r) => r.textContent.includes('home.title'));
    return [...row.querySelectorAll('.cell-status')].some((e) => /saved/i.test(e.textContent));
  }, { timeout: 10000 }).then(() => true).catch(() => false);
  check('DONE releases the lock: member save succeeds', saveOkAfterDone);
  await loginAs('demo@open-locale.dev', 'demo-password-1');

  // Grant events render with proper labels in the activity feed.
  await page.goto(`${WEB}/projects/${projId}/activity`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.activity-list', { timeout: 10000 });
  const feedText = await page.evaluate(() => document.body.textContent || '');
  check('activity feed labels group creation', feedText.includes('created group'));
  check('activity feed labels member add', feedText.includes('added member'));
  check('activity feed shows group from/to detail', feedText.includes('member → admin'));
  check('activity feed names the target group', feedText.includes('"reviewers"') && feedText.includes('"leads"'));
  await page.evaluate(() => { document.querySelector('h1').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await shot('editor-30-activity-grants.png');

  // Tasks page: groups appear as assignee options and assignment sticks.
  await page.goto(`${WEB}/projects/${projId}/tasks`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.task-form', { timeout: 10000 });
  check('assignee dropdown offers groups', await page.evaluate(() =>
    [...document.querySelectorAll('select[name=taskAssignee] option')].some((o) => o.textContent === 'Group: leads')));
  await page.evaluate(() => {
    const sel = document.querySelector('.task-row select[aria-label^="Assignee for"]');
    const opt = [...sel.options].find((o) => o.textContent === 'Group: leads');
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.task-row', { timeout: 10000 });
  check('group assignment persists and renders selected', await page.evaluate(() => {
    const sel = document.querySelector('.task-row select[aria-label^="Assignee for"]');
    return sel.options[sel.selectedIndex]?.textContent === 'Group: leads';
  }));

  // "assigned to me" filter: demo user is not in the leads group, so the
  // group-assigned task hides; switching back to everyone shows it again.
  await page.select('select[aria-label="Filter by assignee"]', 'me');
  await page.waitForFunction(() => !document.querySelector('.task-row'), { timeout: 10000 });
  check('mine filter hides group task for non-member', true);
  await page.select('select[aria-label="Filter by assignee"]', '');
  await page.waitForSelector('.task-row', { timeout: 10000 });
  check('everyone filter shows the task again', true);

  // Filter persistence: assignee/status choices survive a full reload
  // (stored per project). A probe task guarantees the OPEN filter has a
  // match regardless of the other tasks' statuses; the probe is deleted
  // afterwards so later legs and shots see the original list.
  await page.select('select[aria-label="Filter by assignee"]', 'me');
  await page.waitForFunction(() => !document.querySelector('.task-row'), { timeout: 10000 });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('select[aria-label="Filter by assignee"]', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));
  check('assignee filter persists across reload', await page.evaluate(() =>
    document.querySelector('select[aria-label="Filter by assignee"]')?.value === 'me'
    && !document.querySelector('.task-row')));

  await page.select('select[aria-label="Filter by assignee"]', '');
  await page.waitForSelector('.task-row', { timeout: 10000 });
  await page.type('input[name=taskTitle]', 'Persistence probe');
  await page.evaluate(() => { document.querySelector('.task-form').requestSubmit(); });
  await page.waitForFunction(() => [...document.querySelectorAll('.task-row')].some(
    (r) => (r.querySelector('.task-body strong')?.textContent || '').includes('Persistence probe')), { timeout: 10000 });
  await page.select('select[aria-label="Filter by status"]', 'OPEN');
  // Wait for the OPEN-filtered fetch specifically (a stale all-status
  // fetch can win the race and show other rows): probe present, all open.
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.task-row')];
    return rows.length > 0
      && rows.some((r) => (r.querySelector('.task-body strong')?.textContent || '').includes('Persistence probe'))
      && rows.every((r) => (r.querySelector('.task-status')?.textContent || '').trim() === 'open');
  }, { timeout: 10000 });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => {
    const sel = document.querySelector('select[aria-label="Filter by status"]');
    const rows = [...document.querySelectorAll('.task-row')];
    return sel?.value === 'OPEN' && rows.length > 0
      && rows.some((r) => (r.querySelector('.task-body strong')?.textContent || '').includes('Persistence probe'))
      && rows.every((r) => (r.querySelector('.task-status')?.textContent || '').trim() === 'open');
  }, { timeout: 10000 });
  check('status filter persists across reload', true);

  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.task-row')].find((r) => (r.querySelector('.task-body strong')?.textContent || '').includes('Persistence probe'));
    row.querySelector('button[aria-label^="Delete task"]').click();
  });
  await page.waitForFunction(() => ![...document.querySelectorAll('.task-row')].some(
    (r) => (r.querySelector('.task-body strong')?.textContent || '').includes('Persistence probe')), { timeout: 10000 });
  check('probe task deleted after the persistence check', true);
  await page.select('select[aria-label="Filter by status"]', '');
  await page.waitForSelector('.task-row', { timeout: 10000 });

  // Latest-request-wins in a real browser: delay the DONE-filter request
  // 2s at the network layer, immediately change back to all statuses, and
  // confirm the slow stale (empty) response does not render over the
  // newer full list. Without sequencing, the late DONE response wins.
  await page.setRequestInterception(true);
  let doneDelayed = false;
  page.on('request', (req) => {
    if (!doneDelayed && req.url().includes('/tasks?') && req.url().includes('status=DONE')) {
      doneDelayed = true;
      setTimeout(() => req.continue(), 2000);
    } else req.continue();
  });
  const staleLanded = page.waitForResponse(
    (r) => r.url().includes('/tasks?') && r.url().includes('status=DONE'), { timeout: 20000 },
  );
  await page.select('select[aria-label="Filter by status"]', 'DONE');
  await page.select('select[aria-label="Filter by status"]', '');
  await page.waitForFunction(() => document.querySelectorAll('.task-row').length > 0, { timeout: 10000 });
  await staleLanded; // the slow stale response has now arrived
  await new Promise((r) => setTimeout(r, 300)); // allow any (wrong) re-render
  check('slow stale filter response does not clobber the newest list', await page.evaluate(() =>
    document.querySelectorAll('.task-row').length > 0
    && document.querySelector('select[aria-label="Filter by status"]')?.value === ''));
  page.removeAllListeners('request');
  await page.setRequestInterception(false);

  // Task chaining: create a successor through the form, see the chip, and
  // confirm starting it while the predecessor is open shows the API error.
  await page.type('input[name=taskTitle]', 'Proofread after translation');
  await page.evaluate(() => {
    const sel = document.querySelector('select[name=taskDependsOn]');
    const opt = [...sel.options].find((o) => o.textContent === 'Translate checkout to Hebrew');
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.evaluate(() => { document.querySelector('.task-form').requestSubmit(); });
  // Row lookups must key on the row's own title (<strong>), never full
  // textContent: every row's depends-on select lists the other task titles
  // as options, so a textContent match can return the wrong row.
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('.task-row')].find((r) => (r.querySelector('.task-body strong')?.textContent || '').includes('Proofread after translation'));
    const sel = row?.querySelector('select[aria-label^="Depends on for"]');
    return !!sel && (sel.options[sel.selectedIndex]?.textContent || '').startsWith('Translate checkout to Hebrew');
  }, { timeout: 10000 });
  check('chained task row shows its predecessor in the depends-on select', true);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.task-row')].find((r) => r.textContent.includes('Proofread after translation'));
    const sel = row.querySelector('select[aria-label^="Status for"]');
    sel.value = 'IN_PROGRESS';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(
    () => (document.querySelector('[role=alert]')?.textContent || '').includes('blocked until its predecessor is done'),
    { timeout: 10000 },
  );
  check('starting a blocked chain task surfaces the error', true);

  // Row-level dependency editing: re-point, clear, and a rejected cycle
  // (server 400, and the select reverts to the last server-known value).
  // Each mutation first waits for the target option to exist in the
  // title-scoped row's select, so it never fires mid-refetch.
  const setDepends = async (rowTitle, optionPrefix) => {
    await page.waitForFunction((rt, op) => {
      const row = [...document.querySelectorAll('.task-row')].find((r) => (r.querySelector('.task-body strong')?.textContent || '').includes(rt));
      const sel = row?.querySelector('select[aria-label^="Depends on for"]');
      return !!sel && [...sel.options].some((o) => o.textContent.startsWith(op));
    }, { timeout: 10000 }, rowTitle, optionPrefix);
    await page.evaluate((rt, op) => {
      const row = [...document.querySelectorAll('.task-row')].find((r) => (r.querySelector('.task-body strong')?.textContent || '').includes(rt));
      const sel = row.querySelector('select[aria-label^="Depends on for"]');
      const opt = [...sel.options].find((o) => o.textContent.startsWith(op));
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }, rowTitle, optionPrefix);
  };
  const selectedDepends = (rowTitle) => page.evaluate((rt) => {
    const row = [...document.querySelectorAll('.task-row')].find((r) => (r.querySelector('.task-body strong')?.textContent || '').includes(rt));
    const sel = row?.querySelector('select[aria-label^="Depends on for"]');
    return sel ? (sel.options[sel.selectedIndex]?.textContent || '') : null;
  }, rowTitle);

  await setDepends('Proofread after translation', 'Lock home.title');
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('.task-row')].find((r) => (r.querySelector('.task-body strong')?.textContent || '').includes('Proofread after translation'));
    const sel = row?.querySelector('select[aria-label^="Depends on for"]');
    return !!sel && (sel.options[sel.selectedIndex]?.textContent || '').startsWith('Lock home.title');
  }, { timeout: 10000 });
  check('row depends-on select re-points the dependency', true);

  await setDepends('Proofread after translation', 'no predecessor');
  await new Promise((r) => setTimeout(r, 1500));
  check('row depends-on select clears the dependency', (await selectedDepends('Proofread after translation')) === 'no predecessor');

  await setDepends('Proofread after translation', 'Lock home.title');
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('.task-row')].find((r) => (r.querySelector('.task-body strong')?.textContent || '').includes('Proofread after translation'));
    const sel = row?.querySelector('select[aria-label^="Depends on for"]');
    return !!sel && (sel.options[sel.selectedIndex]?.textContent || '').startsWith('Lock home.title');
  }, { timeout: 10000 });
  check('dependency re-pointed again before the cycle attempt', true);

  await setDepends('Lock home.title', 'Proofread after translation');
  await page.waitForFunction(
    () => (document.querySelector('[role=alert]')?.textContent || '').includes('would create a cycle'),
    { timeout: 10000 },
  );
  check('cycle attempt through the row select shows the server error', true);
  await new Promise((r) => setTimeout(r, 1500));
  check('rejected cycle change reverts the select', (await selectedDepends('Lock home.title')) === 'no predecessor');

  // Group-delete audit fixture: a group with one assigned task is deleted
  // through the API, producing a group.deleted row (name + unassigned count)
  // and a per-task task.updated row naming the task and the cleared group.
  const auditGrp = await (await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJwt}` }, body: JSON.stringify({ name: 'audit-demo', role: 'MEMBER' }) })).json();
  await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJwt}` }, body: JSON.stringify({ title: 'Audit demo task', assigneeGroupId: auditGrp.id }) });
  const auditDel = await fetch(`http://127.0.0.1:${API_PORT}/api/projects/${projId}/groups/${auditGrp.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${ownerJwt}` } });
  check('audit fixture: group with an assigned task deleted', auditDel.ok, `status=${auditDel.status}`);

  // The activity feed now renders task.updated change detail generically
  // (was a blank detail); the dependency edits above give it real data.
  await page.goto(`${WEB}/projects/${projId}/activity`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.activity-list', { timeout: 10000 });
  check('activity feed renders task dependency change detail', await page.evaluate(() =>
    (document.body.textContent || '').includes('dependsOn:')));
  check('activity feed shows group.deleted with group name and unassigned count', await page.evaluate(() => {
    const t = document.body.textContent || '';
    return t.includes('"audit-demo"') && t.includes('1 task(s) unassigned');
  }));
  check('activity feed task.updated row names the unassigned task and group', await page.evaluate(() => {
    const t = document.body.textContent || '';
    return t.includes('Audit demo task') && t.includes('assigneeGroup: audit-demo → none');
  }));
  await shot('editor-33-activity-task-audit.png');


  // --- Branches: create via UI, isolation, merge into main ---
  await page.goto(`${WEB}/projects/${projId}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('select[aria-label="Branch"]', { timeout: 10000 });
  const mainBranchRows = await page.$$eval('.grid tbody tr:not(.history-row)', (els) => els.length);
  check('main branch shows existing keys', mainBranchRows >= 5, `${mainBranchRows} rows`);
  await page.type('input[aria-label="New branch name"]', 'feature-x');
  await page.evaluate(() => {
    const form = document.querySelector('input[aria-label="New branch name"]').closest('form');
    form.requestSubmit();
  });
  const branchNotice = await page.waitForFunction(() => (document.body.textContent || '').includes('Empty branch feature-x created'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('branch created via UI with accurate empty-branch notice', branchNotice);
  await page.select('select[aria-label="Branch"]', 'feature-x');
  await page.waitForFunction(
    () => document.querySelectorAll('.grid tbody tr:not(.history-row)').length === 0,
    { timeout: 10000 },
  );
  check('new branch starts empty (isolation from main)', true);
  const mergeBtn = await page.waitForFunction(() => (document.body.textContent || '').includes('Merge feature-x into main'), { timeout: 5000 }).then(() => true).catch(() => false);
  check('merge button visible on non-main branch', mergeBtn);
  await shot('editor-21-branch-empty.png');
  // Add a branch-only key AND a conflicting same-named key, then merge into main
  await page.type('input[name=newKey]', 'branch.only');
  await page.click('.inline button');
  check('branch-only key added on feature-x', await waitText('branch.only'));
  const bCells = await page.$$('.grid tbody tr:first-child textarea');
  await bCells[0].type('Only on the branch');
  await bCells[0].evaluate((el) => el.blur());
  await page.waitForFunction(
    () => [...document.querySelectorAll('.grid tbody tr:first-child .cell-status')].some((e) => /saved/i.test(e.textContent)),
    { timeout: 10000 },
  );
  const keyInputB = await page.$('input[name=newKey]');
  await keyInputB.evaluate((el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('input[name=newKey]', 'cart.checkout');
  await page.click('.inline button');
  check('conflicting same-named key added on feature-x', await waitText('cart.checkout'));
  const hCells = await page.$$('.grid tbody tr:nth-child(2) textarea');
  await hCells[0].type('Checkout from the branch');
  await hCells[0].evaluate((el) => el.blur());
  await page.waitForFunction(
    () => [...document.querySelectorAll('.grid tbody tr:nth-child(2) .cell-status')].some((e) => /saved/i.test(e.textContent)),
    { timeout: 10000 },
  );
  // Merge: preview modal shows the diff with an explicit overwrite warning.
  const mergeHandle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Merge feature-x into main')));
  await mergeHandle.asElement().click();
  let modalUp = await page.waitForSelector('.modal .merge-diff', { timeout: 10000 }).then(() => true).catch(() => false);
  if (!modalUp) {
    const diag = await page.evaluate(() => ({
      error: document.querySelector('.error')?.textContent ?? null,
      notice: document.querySelector('.notice')?.textContent ?? null,
      buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).slice(0, 14),
      modal: !!document.querySelector('.modal'),
    }));
    diag.previewProbe = await page.evaluate(async () => {
      const token = localStorage.getItem('ol_token');
      const pid = location.pathname.split('/').pop();
      const brs = await fetch(`/api/projects/${pid}/branches`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
      const fx = brs.find((b) => b.name === 'feature-x');
      const res = await fetch(`/api/projects/${pid}/branches/${fx.id}/merge/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ into: 'main' }),
      });
      return { status: res.status, body: JSON.stringify(await res.json().catch(() => null)).slice(0, 200) };
    });
    console.log('DIAG modal:', JSON.stringify(diag));
  }
  check('merge preview modal opens', modalUp);
  const modalText = await page.$eval('.modal', (el) => el.textContent);
  check('modal shows overwrite warning, kept-count and snapshot note',
    modalText.includes('WARNING') && modalText.includes('OVERWRITTEN') && modalText.includes('kept untouched') && modalText.includes('automatic snapshot'),
    modalText.slice(0, 200));
  await shot('editor-23-merge-preview.png');
  const confirmHandle = await page.evaluateHandle(() => [...document.querySelectorAll('.modal button')].find((b) => b.textContent === 'Merge now'));
  await confirmHandle.asElement().click();
  const mergeNotice = await page.waitForFunction(() => (document.body.textContent || '').includes('Merged feature-x'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('merge completes with summary notice', mergeNotice);
  await page.select('select[aria-label="Branch"]', 'main');
  await page.waitForFunction(
    // app.subtitle exists on main only, so this cannot match the stale feature-x grid
    () => (document.body.textContent || '').includes('app.subtitle') && (document.body.textContent || '').includes('branch.only'),
    { timeout: 10000 },
  );
  const mainRowsAfter = await page.$$eval('.grid tbody tr:not(.history-row)', (els) => els.length);
  check('merged key visible on main, existing keys kept', mainRowsAfter === mainBranchRows + 1, `${mainRowsAfter} rows (was ${mainBranchRows})`);
  const homeTitleVal = await page.$$eval('.grid tbody tr:not(.history-row) textarea', (els) => els.map((e) => e.value));
  check('conflicting key overwritten on main by merge', homeTitleVal.includes('Checkout from the branch'));
  await shot('editor-22-branch-merged.png');
  

  // --- OTA: publish a bundle from settings, pull it via API ---
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('select[name=otaBranch]', { timeout: 10000 });
  await page.evaluate(() => {
    const form = document.querySelector('select[name=otaBranch]').closest('form');
    form.requestSubmit();
  });
  const otaNotice = await page.waitForFunction(() => (document.body.textContent || '').includes('Published main v1'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('OTA publish via UI shows summary notice', otaNotice);
  const otaPull = await page.evaluate(async () => {
    const token = localStorage.getItem('ol_token');
    const pid = location.pathname.split('/')[2];
    const res = await fetch(`/api/projects/${pid}/ota/latest?locale=he`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, etag: res.headers.get('etag'), body: await res.json() };
  });
  check('published bundle pulls with ETag and branch values',
    otaPull.status === 200 && !!otaPull.etag && otaPull.body.branch === 'main' && otaPull.body.version === 1 && typeof otaPull.body.translations === 'object',
    JSON.stringify({ status: otaPull.status, v: otaPull.body.version }));
  const ota304 = await page.evaluate(async (et) => {
    const token = localStorage.getItem('ol_token');
    const pid = location.pathname.split('/')[2];
    const res = await fetch(`/api/projects/${pid}/ota/latest?locale=he`, { headers: { Authorization: `Bearer ${token}`, 'If-None-Match': et } });
    return res.status;
  }, otaPull.etag);
  check('If-None-Match yields 304 via UI session', ota304 === 304, `got ${ota304}`);
  await page.evaluate(() => [...document.querySelectorAll('h2')].find((h) => h.textContent === 'OTA publications')?.scrollIntoView({ block: 'start' }));
  await new Promise((r) => setTimeout(r, 300));
  await shot('editor-24-ota.png');

  // --- In-context embedding settings ---
  await page.evaluate(() => {
    const input = document.querySelector('input[name=newOrigin]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'https://app.example.com');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.closest('form').requestSubmit();
  });
  const originListed = await page.waitForFunction(() => (document.body.textContent || '').includes('https://app.example.com'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('embed origin added via settings UI and listed', originListed);
  await page.evaluate(() => [...document.querySelectorAll('h2')].find((h) => h.textContent === 'In-context embedding')?.scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 300));
  await shot('editor-27-embed-origins.png');

  // --- Machine translation: add the pseudo provider and pre-translate ---
  await page.evaluate(() => {
    const input = document.querySelector('input[name=newMtName]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Pseudo');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.closest('form').requestSubmit();
  });
  const mtListed = await page.waitForFunction(() => (document.body.textContent || '').includes('pseudo (built-in, offline)') && [...document.querySelectorAll('li')].some((li) => li.textContent.includes('Pseudo')), { timeout: 10000 }).then(() => true).catch(() => false);
  check('MT provider added via settings UI and listed', mtListed);
  await page.evaluate(() => {
    const sel = document.querySelector('select[name=mtLocale]');
    if (sel && [...sel.options].some((o) => o.value === 'he')) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, 'he');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sel.closest('form').requestSubmit();
  });
  const mtDone = await page.waitForFunction(() => (document.body.textContent || '').includes('Pseudo test data (he on main):'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('pre-translate run reports fill/skip counts', mtDone);
  check('panel labels the output as TEST DATA, not translation', await page.evaluate(() => (document.body.textContent || '').includes('TEST DATA') && (document.body.textContent || '').includes('NOT available in this slice')));
  const mtLine = await page.evaluate(() => document.querySelector('p[role=status]')?.textContent || '');
  check('pre-translate filled at least one empty cell', /: ([1-9]\d*) filled/.test(mtLine), mtLine);
  await page.evaluate(() => { [...document.querySelectorAll('h2')].find((h) => h.textContent.startsWith('Machine translation'))?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await new Promise((r) => setTimeout(r, 300));
  await shot('editor-28-mt.png');

  // --- Automations: add a task.create rule via settings UI, then fire it ---
  await page.goto(`${WEB}/projects/${projId}/settings`, { waitUntil: 'networkidle0' });
  const autoPanel = await page.waitForSelector('input[name=newRuleName]', { timeout: 15000 }).then(() => true).catch(() => false);
  if (!autoPanel) {
    const h2s = await page.$$eval('section.panel h2', (els) => els.map((e) => e.textContent));
    console.log('DEBUG settings panels:', JSON.stringify(h2s));
  }
  check('automations panel renders in settings', autoPanel);
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    };
    setVal(document.querySelector('input[name=newRuleName]'), 'Task on new key');
    setVal(document.querySelector('select[name=newRuleTrigger]'), 'key.created');
    setVal(document.querySelector('select[name=newRuleAction]'), 'task.create');
  });
  await page.waitForSelector('input[name=newRuleTitle]', { timeout: 10000 });
  await page.evaluate(() => {
    const el = document.querySelector('input[name=newRuleTitle]');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, 'Translate new key {key}');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('input[name=newRuleName]').closest('form').requestSubmit());
  const ruleListed = await page.waitForFunction(() => [...document.querySelectorAll('li')].some((li) => li.textContent.includes('Task on new key')), { timeout: 10000 }).then(() => true).catch(() => false);
  check('automation rule added via settings UI and listed', ruleListed);
  await page.evaluate(async (pid) => {
    const token = localStorage.getItem('ol_token');
    await fetch(`/api/projects/${pid}/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'auto.fired' }) });
  }, projId);
  const taskFired = await page.waitForFunction(async () => {
    const pid = location.pathname.split('/')[2];
    const token = localStorage.getItem('ol_token');
    const res = await fetch(`/api/projects/${pid}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
    const tasks = await res.json();
    return (Array.isArray(tasks) ? tasks : tasks.items || []).some((t) => t.title === 'Translate new key auto.fired');
  }, { timeout: 10000, polling: 500 }).then(() => true).catch(() => false);
  check('creating a key fired the rule and created the task', taskFired);
  await page.evaluate(() => { [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Automations')?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await new Promise((r) => setTimeout(r, 300));
  await shot('editor-29-automations.png');
  // Narrow viewport: panel must stay usable (no clipped controls).
  await page.setViewport({ width: 480, height: 800 });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => { [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Automations')?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await new Promise((r) => setTimeout(r, 300));
  await shot('editor-29b-automations-narrow.png');
  const clippedEls = await page.evaluate(() => [...document.querySelectorAll('.panel select, .panel input')]
    .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth)
    .map((el) => `${el.tagName}[${el.getAttribute('aria-label') || el.name || '?'}] right=${Math.round(el.getBoundingClientRect().right)}`));
  check('automations panel usable at 480px (no control overflows viewport)', clippedEls.length === 0, clippedEls.join(';'));
  await page.setViewport({ width: 1280, height: 800 });

  // --- 2FA: enable via projects-page security panel, log out, log in with code ---
  await page.goto(`${WEB}/projects`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.panel.tfa input[name=tfaSetupPassword]', { timeout: 10000 });
  await page.type('.panel.tfa input[name=tfaSetupPassword]', 'demo-password-1');
  await page.evaluate(() => { [...document.querySelectorAll('.panel.tfa button')].find((b) => b.textContent.includes('Set up two-factor')).closest('form').requestSubmit(); });
  await page.waitForSelector('.tfa-secret', { timeout: 10000 });
  const tfaSecret = await page.$eval('.tfa-secret', (el) => el.textContent.trim());
  check('2FA setup shows secret + otpauth URL', /^[A-Z2-7]{32}$/.test(tfaSecret));
  await page.evaluate((code) => {
    const pw = document.querySelector('.panel.tfa input[name=tfaPassword]');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(pw, 'demo-password-1');
    pw.dispatchEvent(new Event('input', { bubbles: true }));
    const input = document.querySelector('.panel.tfa input[name=tfaCode]');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, code);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.closest('form').requestSubmit();
  }, totp(tfaSecret, 1));
  const tfaOn = await page.waitForFunction(() => (document.body.textContent || '').includes('recovery codes remain') && document.querySelectorAll('.tfa-codes li').length === 8, { timeout: 10000 }).then(() => true).catch(() => false);
  check('2FA enabled via UI, 8 recovery codes shown once', tfaOn);
  const codesShown = await page.$$eval('.tfa-codes code', (els) => els.map((e) => e.textContent));
  check('recovery codes shaped XXXXXXXX-XXXXXXXX in UI', codesShown.length === 8 && codesShown.every((c) => /^[0-9A-Z]{8}-[0-9A-Z]{8}$/.test(c)));
  // Confirming the stored codes ends the revoked session: the app routes to
  // the login page with a re-auth notice instead of staying signed in on a
  // dead token.
  await page.evaluate(() => { [...document.querySelectorAll('.panel.tfa button')].find((b) => b.textContent.includes("I've stored these - sign in again")).click(); });
  await page.waitForSelector('.auth-card', { timeout: 10000 });
  const noticeShown = await page.evaluate(() => (document.body.textContent || '').includes('sign in again with your code'));
  check('after enable, session signed out and login shows re-auth notice', noticeShown);
  await page.type('input[name=email]', 'demo@open-locale.dev');
  await page.type('input[name=password]', 'demo-password-1');
  await page.type('input[name=totpCode]', totp(tfaSecret, 1));
  await page.click('button.primary');
  const relogged = await page.waitForSelector('.create', { timeout: 10000 }).then(() => true).catch(() => false);
  check('login with TOTP code via UI succeeds', relogged);
  // Clean enabled state after re-auth: no codes rendered, panel shows the
  // enabled status and the disable form. Status loads async - wait for it.
  const cleanState = await page.waitForFunction(() => document.querySelectorAll('.tfa-codes li').length === 0 && (document.body.textContent || '').includes('recovery codes remain'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('re-authenticated session shows clean enabled state (no codes)', cleanState);
  await page.evaluate(() => { document.querySelector('.panel.tfa')?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await new Promise((r) => setTimeout(r, 300));
  await shot('editor-30-2fa.png');

  // --- Progress report ---
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${WEB}/projects/${projId}/reports`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.progress-table tbody tr', { timeout: 10000 });
  const report = await page.evaluate(() => {
    const note = ([...document.querySelectorAll('p.muted')].find((el) => el.textContent.includes('keys on'))?.textContent) || '';
    const rows = [...document.querySelectorAll('.progress-table tbody tr')].map((tr) => {
      const tds = [...tr.querySelectorAll('td')].map((td) => td.textContent.trim());
      const nums = tds.slice(2).map((x) => parseInt(x, 10));
      return { locale: tds[0], translated: nums[0], untranslated: nums[1], statusSum: nums.slice(2).reduce((a, b) => a + b, 0) };
    });
    const totalKeys = parseInt((note.match(/(\d+) keys on/) || [])[1], 10);
    return { note, rows, totalKeys, branch: document.querySelector('select[name=reportBranch]')?.value };
  });
  check('progress table lists a row per locale', report.rows.length >= 2, JSON.stringify(report.rows.map((r) => r.locale)));
  check('progress rows consistent: translated + untranslated = total keys, status sum = translated',
    Number.isInteger(report.totalKeys) && report.rows.every((r) => r.translated + r.untranslated === report.totalKeys && r.statusSum === r.translated),
    JSON.stringify({ total: report.totalKeys, rows: report.rows }));
  check('definition note visible next to the table', report.note.includes('not empty'), JSON.stringify(report.note.slice(0, 80)));
  check('branch selector defaults to main', report.branch === 'main', `got ${report.branch}`);
  await shot('editor-25-reports.png');

  // Progress report, narrow viewport (480px): table must stay readable via horizontal scroll, groups intact.
  await page.setViewport({ width: 480, height: 800 });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.progress-table tbody tr', { timeout: 10000 });
  const narrow = await page.evaluate(() => {
    const scroller = document.querySelector('.table-scroll');
    const groups = [...document.querySelectorAll('.group-row .group-label')].map((th) => th.textContent.trim());
    const rows = document.querySelectorAll('.progress-table tbody tr').length;
    return { scrolls: scroller ? scroller.scrollWidth > scroller.clientWidth : false, groups, rows, sw: scroller?.scrollWidth, cw: scroller?.clientWidth };
  });
  check('narrow viewport: table scrolls horizontally instead of crushing columns', narrow.scrolls, JSON.stringify({ sw: narrow.sw, cw: narrow.cw }));
  check('narrow viewport: group labels and all rows still rendered', narrow.groups.join('|') === 'Filled values|Workflow status' && narrow.rows >= 2, JSON.stringify(narrow.groups));
  await shot('editor-26-reports-narrow.png');
  await page.setViewport({ width: 1280, height: 900 });

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
