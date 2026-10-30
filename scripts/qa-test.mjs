// QA checks: real PostgreSQL + real HTTP API. Run: node scripts/qa-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55445, API_PORT = 3012;
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

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-qa-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_qa');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_qa`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'qa-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@qa.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@qa.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'QA', slug: 'qa', locales: ['en', 'he', 'de'] } })).json;
  const P = `/projects/${proj.id}`;

  // k1: untranslated in he+de; k2: placeholder mismatch; k3: maxLength; k4: clean
  const k1 = (await call(`${P}/keys`, { token: at, method: 'POST', body: { name: 'k.untranslated' } })).json;
  await call(`${P}/keys/${k1.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Hello world' } });

  const k2 = (await call(`${P}/keys`, { token: at, method: 'POST', body: { name: 'k.placeholder' } })).json;
  await call(`${P}/keys/${k2.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Welcome {name}, you have %d messages' } });
  await call(`${P}/keys/${k2.id}/translations`, { token: at, method: 'PUT', body: { locale: 'he', value: 'שלום, יש לך הודעות' } });
  await call(`${P}/keys/${k2.id}/translations`, { token: at, method: 'PUT', body: { locale: 'de', value: 'Willkommen {name}, %d Nachrichten' } });

  const k3 = (await call(`${P}/keys`, { token: at, method: 'POST', body: { name: 'k.long', maxLength: 10 } })).json;
  await call(`${P}/keys/${k3.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Short' } });
  await call(`${P}/keys/${k3.id}/translations`, { token: at, method: 'PUT', body: { locale: 'he', value: 'תרגום ארוך מדי לגמרי' } });

  const k4 = (await call(`${P}/keys`, { token: at, method: 'POST', body: { name: 'k.clean', maxLength: 50 } })).json;
  await call(`${P}/keys/${k4.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Pay {total}' } });
  await call(`${P}/keys/${k4.id}/translations`, { token: at, method: 'PUT', body: { locale: 'he', value: 'שלם {total}' } });
  await call(`${P}/keys/${k4.id}/translations`, { token: at, method: 'PUT', body: { locale: 'de', value: '{total} zahlen' } });

  // k5: empty base - no untranslated flags expected
  const k5 = (await call(`${P}/keys`, { token: at, method: 'POST', body: { name: 'k.emptybase' } })).json;

  const allRes = await call(`${P}/qa`, { token: at });
  if (allRes.status !== 200) { console.log('QA endpoint status', allRes.status, JSON.stringify(allRes.json)); }
  const all = allRes.json ?? { issues: [] };
  const types = (k) => all.issues.filter((i) => i.key === k).map((i) => `${i.locale}:${i.type}`).sort();
  check('untranslated flagged per missing target', JSON.stringify(types('k.untranslated')) === JSON.stringify(['de:untranslated', 'he:untranslated']), JSON.stringify(types('k.untranslated')));
  check('placeholder mismatch only in he', JSON.stringify(types('k.placeholder')) === JSON.stringify(['he:placeholder_mismatch']), JSON.stringify(types('k.placeholder')));
  check('maxLength flagged in he, de still untranslated', JSON.stringify(types('k.long')) === JSON.stringify(['de:untranslated', 'he:max_length']), JSON.stringify(types('k.long')));
  check('clean key has no issues', types('k.clean').length === 0);
  check('empty base not flagged untranslated', types('k.emptybase').length === 0);

  const heOnly = (await call(`${P}/qa?locale=he`, { token: at })).json;
  check('locale filter narrows results', heOnly.issues.every((i) => i.locale === 'he') && heOnly.issues.length === 3, String(heOnly.issues.length));

  const badLocale = (await call(`${P}/qa?locale=fr`, { token: at })).json;
  check('non-project locale yields empty', badLocale.issues.length === 0);

  const cross = await call(`${P}/qa`, { token: bt });
  check('cross-team QA denied (404)', cross.status === 404, String(cross.status));

  const detail = all.issues.find((i) => i.key === 'k.placeholder' && i.locale === 'he');
  check('mismatch detail lists both placeholder sets', !!detail && detail.detail.includes('{name}') && detail.detail.includes('%d'), detail?.detail);

  // Plural keys (slice 9): QA runs per category form, anchored on the
  // source form set - not on the plain value (the "other" form) alone.
  const k6 = (await call(`${P}/keys`, { token: at, method: 'POST', body: { name: 'k.plural', maxLength: 40, isPlural: true } })).json;
  const k6put = await call(`${P}/keys/${k6.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: '%d apples', pluralForms: { one: '%d apple', other: '%d apples' } } });
  check('plural: source forms PUT accepted', k6put.status === 200 || k6put.status === 201, `${k6put.status} ${JSON.stringify(k6put.json)}`);
  // he: the 'one' form is missing entirely and the 'other' form drops the
  // %d placeholder (the write API requires 'other', so it stays present)
  await call(`${P}/keys/${k6.id}/translations`, { token: at, method: 'PUT', body: { locale: 'he', value: 'תפוחים', pluralForms: { other: 'תפוחים' } } });
  // de: complete and consistent - no issues expected
  await call(`${P}/keys/${k6.id}/translations`, { token: at, method: 'PUT', body: { locale: 'de', value: '%d Äpfel', pluralForms: { one: '%d Apfel', other: '%d Äpfel' } } });
  const k7 = (await call(`${P}/keys`, { token: at, method: 'POST', body: { name: 'k.plurallong', maxLength: 5, isPlural: true } })).json;
  await call(`${P}/keys/${k7.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'aa bb', pluralForms: { one: 'aa', other: 'aa bb' } } });
  await call(`${P}/keys/${k7.id}/translations`, { token: at, method: 'PUT', body: { locale: 'he', value: 'אא', pluralForms: { one: 'אא', other: 'אא בב גג' } } });

  const pl = (await call(`${P}/qa`, { token: at })).json ?? { issues: [] };
  const ptypes = (k) => pl.issues.filter((i) => i.key === k).map((i) => `${i.locale}:${i.type}`).sort();
  check('plural: missing source category form flagged untranslated (he one)', ptypes('k.plural').includes('he:untranslated'), JSON.stringify(ptypes('k.plural')));
  check('plural: placeholder mismatch flagged per category (he other)', ptypes('k.plural').includes('he:placeholder_mismatch'), JSON.stringify(ptypes('k.plural')));
  check('plural: exactly two he issues, no double-report of other', ptypes('k.plural').length === 2, JSON.stringify(ptypes('k.plural')));
  check('plural: consistent target (de) has no issues', ptypes('k.plural').filter((t) => t.startsWith('de:')).length === 0, JSON.stringify(ptypes('k.plural')));
  check('plural: maxLength applies per form (he other over, one within; de untranslated)', JSON.stringify(ptypes('k.plurallong')) === JSON.stringify(['de:untranslated', 'he:max_length']), JSON.stringify(ptypes('k.plurallong')));
  const uDetail = pl.issues.find((i) => i.key === 'k.plural' && i.type === 'untranslated');
  const mDetail = pl.issues.find((i) => i.key === 'k.plural' && i.type === 'placeholder_mismatch');
  check('plural: details name the category', !!uDetail && uDetail.detail.includes('"one"') && !!mDetail && mDetail.detail.includes('"other"') && mDetail.detail.includes('%d'), `${uDetail?.detail} | ${mDetail?.detail}`);
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('All QA checks passed');
process.exitCode = 0;
