// Plural forms: real PostgreSQL + real HTTP API.
// Write-path validation (CLDR categories per locale), preservation across
// value-only writes, explicit clear on isPlural=false, snapshot round-trip,
// branch merge carry. Run: node scripts/plural-test.mjs  (requires: nx build api)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55473, API_PORT = 3025;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent mid-await exit leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-plural-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('ol_plural');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/ol_plural`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'plural-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const jwt = (await call('/auth/signup', { method: 'POST', body: { email: `p${Date.now()}@t.dev`, password: 'pass1234', displayName: 'P' } })).json.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Plural', slug: `plural-${Date.now()}`, baseLocale: 'en', locales: ['en', 'ar'] } })).json.id;
  const keys = async (branch) => (await call(`/projects/${pid}/keys${branch ? `?branch=${branch}` : ''}`, { jwt })).json;
  const formsOf = (ks, name, loc) => ks.find((k) => k.name === name)?.translations.find((t) => t.localeCode === loc)?.pluralForms;

  const kid = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'cart.items', isPlural: true } })).json.id;
  check('plural key created', !!kid);

  const w1 = await call(`/projects/${pid}/keys/${kid}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'items', pluralForms: { one: '1 item', other: '# items' } } });
  check('pluralForms write accepted on plural key', w1.status === 201 || w1.status === 200, `status=${w1.status}`);
  check('pluralForms readable on key list', JSON.stringify(formsOf(await keys(), 'cart.items', 'en')) === JSON.stringify({ one: '1 item', other: '# items' }));

  const w2 = await call(`/projects/${pid}/keys/${kid}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'items v2' } });
  check('value-only write accepted', w2.status === 200 || w2.status === 201, `status=${w2.status}`);
  check('value-only write preserves pluralForms', JSON.stringify(formsOf(await keys(), 'cart.items', 'en')) === JSON.stringify({ one: '1 item', other: '# items' }));

  const kidPlain = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'plain.key' } })).json.id;
  check('pluralForms rejected on non-plural key (400)', (await call(`/projects/${pid}/keys/${kidPlain}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'x', pluralForms: { other: 'x' } } })).status === 400);
  check('category outside locale CLDR set rejected (en has no "few")', (await call(`/projects/${pid}/keys/${kid}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'x', pluralForms: { few: 'x', other: 'x' } } })).status === 400);
  check('missing "other" rejected', (await call(`/projects/${pid}/keys/${kid}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'x', pluralForms: { one: 'x' } } })).status === 400);
  const wAr = await call(`/projects/${pid}/keys/${kid}/translations`, { jwt, method: 'PUT', body: { locale: 'ar', value: 'عناصر', pluralForms: { zero: 'لا عناصر', one: 'عنصر', two: 'عنصران', few: 'عناصر', many: 'عنصرا', other: 'عنصر' } } });
  check('ar accepts its six CLDR categories', wAr.status === 200 || wAr.status === 201, `status=${wAr.status}`);
  check('non-string form value rejected (400)', (await call(`/projects/${pid}/keys/${kid}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'x', pluralForms: { one: 5, other: 'x' } } })).status === 400);

  // Snapshot round-trip carries pluralForms.
  const snap = (await call(`/projects/${pid}/snapshots`, { jwt, method: 'POST', body: { label: 'plural baseline' } })).json;
  await call(`/projects/${pid}/keys/${kid}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'items v3', pluralForms: { one: '1 thing', other: '# things' } } });
  await call(`/projects/${pid}/snapshots/${snap.id}/restore`, { jwt, method: 'POST' });
  const ksAfterRestore = await keys();
  check('snapshot restore restores pluralForms', JSON.stringify(formsOf(ksAfterRestore, 'cart.items', 'en')) === JSON.stringify({ one: '1 item', other: '# items' }));
  check('snapshot restore restores value', ksAfterRestore.find((k) => k.name === 'cart.items').translations.find((t) => t.localeCode === 'en').value === 'items v2');

  // Branch merge carries pluralForms.
  await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat' } });
  const mainBranch = (await call(`/projects/${pid}/branches`, { jwt })).json.find((b) => b.name === 'main');
  await call(`/projects/${pid}/keys/${kid}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'items v4', pluralForms: { one: '1 merged', other: '# merged' } } });
  const merge = await call(`/projects/${pid}/branches/${mainBranch.id}/merge`, { jwt, method: 'POST', body: { into: 'feat' } });
  check('merge main->feat accepted', merge.status === 200 || merge.status === 201, `status=${merge.status}`);
  check('merge carries pluralForms to target branch', JSON.stringify(formsOf(await keys('feat'), 'cart.items', 'en')) === JSON.stringify({ one: '1 merged', other: '# merged' }));

  // Format import writers upsert value/status only: forms must survive an
  // import over an existing plural key (imports never delete+recreate rows).
  const imp = await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { 'cart.items': 'imported items' } } });
  check('JSON import over a plural key accepted', imp.status === 200 || imp.status === 201, `status=${imp.status}`);
  check('import preserves pluralForms', JSON.stringify(formsOf(await keys(), 'cart.items', 'en')) === JSON.stringify({ one: '1 merged', other: '# merged' }));
  check('import still updates the plain value', (await keys()).find((k) => k.name === 'cart.items').translations.find((t) => t.localeCode === 'en').value === 'imported items');

  // Android format layer (slice 4): <plurals> import upgrades metadata and
  // writes forms; a <string> import over a plural key preserves them.
  const ax = await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { xml: '<resources><plurals name="cart.android"><item quantity="one">one thing</item><item quantity="other">many things</item></plurals></resources>' } });
  check('Android plurals import accepted', ax.status === 200 || ax.status === 201, `status=${ax.status}`);
  const ksAx = await keys();
  const axKey = ksAx.find((k) => k.name === 'cart.android');
  check('Android import sets isPlural and forms', axKey?.isPlural === true && JSON.stringify(formsOf(ksAx, 'cart.android', 'en')) === JSON.stringify({ one: 'one thing', other: 'many things' }));
  check('Android import sets plain value to the other form', axKey?.translations.find((t) => t.localeCode === 'en')?.value === 'many things');
  const axOut = await (await fetch(`${API}/projects/${pid}/export/en/android`, { headers: { Authorization: `Bearer ${jwt}` } })).text();
  check('Android export emits a <plurals> element', axOut.includes('<plurals name="cart.android">') && axOut.includes('<item quantity="one">one thing</item>'), axOut.split('\n').find((l) => l.includes('cart.android')) ?? '');
  const axStr = await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { xml: '<resources><string name="cart.android">plain string</string></resources>' } });
  check('Android <string> import over a plural key accepted', axStr.status === 200 || axStr.status === 201, `status=${axStr.status}`);
  const ksAx2 = await keys();
  check('<string> import preserves pluralForms', JSON.stringify(formsOf(ksAx2, 'cart.android', 'en')) === JSON.stringify({ one: 'one thing', other: 'many things' }));
  check('<string> import updates plain value', ksAx2.find((k) => k.name === 'cart.android').translations.find((t) => t.localeCode === 'en').value === 'plain string');

  // Failure atomicity (no inference from construction; direct evidence):
  // a failed plural import leaves isPlural, forms and value unchanged.
  const fewExisting = await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { xml: '<resources><plurals name="cart.android"><item quantity="few">a few</item><item quantity="other">others</item></plurals></resources>' } });
  check('locale-invalid category on existing plural key fails the key only', fewExisting.status === 201 && fewExisting.json.failed === 1, `${fewExisting.status} ${JSON.stringify(fewExisting.json)}`);
  const ksF = await keys();
  check('failed plural import leaves isPlural and forms unchanged', ksF.find((k) => k.name === 'cart.android')?.isPlural === true && JSON.stringify(formsOf(ksF, 'cart.android', 'en')) === JSON.stringify({ one: 'one thing', other: 'many things' }));
  check('failed plural import leaves plain value unchanged', ksF.find((k) => k.name === 'cart.android').translations.find((t) => t.localeCode === 'en').value === 'plain string');
  const fewNew = await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { xml: '<resources><plurals name="few.check"><item quantity="few">x</item><item quantity="other">y</item></plurals></resources>' } });
  check('locale-invalid category on a new key fails the key only', fewNew.status === 201 && fewNew.json.failed === 1, `${fewNew.status} ${JSON.stringify(fewNew.json)}`);
  check('failed new plural key was not created', (await keys()).every((k) => k.name !== 'few.check'));
  const noOther = await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { xml: '<resources><plurals name="no.other"><item quantity="one">x</item></plurals></resources>' } });
  check('plurals import without "other" fails the key (consistent with API 400)', noOther.status === 201 && noOther.json.failed === 1, `${noOther.status} ${JSON.stringify(noOther.json)}`);
  check('missing-other key was not created', (await keys()).every((k) => k.name !== 'no.other'));
  // Locked key: a non-assignee MEMBER's plural import fails atomically.
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `m${Date.now()}@t.dev`, password: 'pass1234', displayName: 'M' } })).json;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.teamMember.create({ data: { teamId: (await prisma.project.findUniqueOrThrow({ where: { id: pid } })).teamId, userId: member.user.id, role: 'MEMBER' } });
  await prisma.$disconnect();
  const androidKey = (await keys()).find((k) => k.name === 'cart.android');
  const lock = (await call(`/projects/${pid}/tasks`, { jwt, method: 'POST', body: { title: 'Lock android key', lockKeys: true, keyIds: [androidKey.id] } })).json;
  check('lock task created for the atomicity leg', lock.lockKeys === true, JSON.stringify(lock).slice(0, 80));
  const lockedImp = await call(`/projects/${pid}/import/en`, { jwt: member.accessToken, method: 'POST', body: { xml: '<resources><plurals name="cart.android"><item quantity="one">locked one</item><item quantity="other">locked other</item></plurals></resources>' } });
  check('locked-key plural import fails the key', lockedImp.status === 201 && lockedImp.json.failed === 1, `${lockedImp.status} ${JSON.stringify(lockedImp.json)}`);
  const ksL = await keys();
  check('locked failed import leaves isPlural and forms unchanged', ksL.find((k) => k.name === 'cart.android')?.isPlural === true && JSON.stringify(formsOf(ksL, 'cart.android', 'en')) === JSON.stringify({ one: 'one thing', other: 'many things' }));
  check('locked failed import leaves plain value unchanged', ksL.find((k) => k.name === 'cart.android').translations.find((t) => t.localeCode === 'en').value === 'plain string');

  // isPlural=false clears stored forms explicitly.
  check('isPlural flip accepted', (await call(`/projects/${pid}/keys/${kid}`, { jwt, method: 'PATCH', body: { isPlural: false } })).status === 200);
  check('isPlural=false clears pluralForms', formsOf(await keys(), 'cart.items', 'en') === null);
  check('value survives the isPlural flip', (await keys()).find((k) => k.name === 'cart.items').translations.find((t) => t.localeCode === 'en').value === 'imported items');

  console.log(failures === 0 ? 'plural pass complete' : `${failures} FAILURES`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (e) {
  console.error('FAIL plural suite errored:', e.message);
  process.exitCode = 1;
} finally {
  if (api) api.kill('SIGKILL');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
