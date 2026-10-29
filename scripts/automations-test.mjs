// Automations slice: explicit trigger/action whitelist, admin-only rule
// management, bounded firing (main branch + base-locale writes only),
// internal effects only (pretranslate pseudo test data, task creation),
// runs execute as the rule creator with live permission re-checks, and
// automation writes never re-trigger rules. Real PG + HTTP.
// Run: node scripts/automations-test.mjs (requires: nx build api)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55470, API_PORT = 3000;
const API = `http://127.0.0.1:${API_PORT}/api`;
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
const pollFor = async (fn, tries = 20) => {
  for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 400)); }
  return null;
};

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-au-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_au');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_au`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'au-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  if (!(await waitFor(`${API}/projects`))) throw new Error('API did not start');

  const ts = Date.now();
  const owner = (await call('/auth/signup', { method: 'POST', body: { email: `au${ts}@t.dev`, password: 'pass1234', displayName: 'au' } })).json;
  const jwt = owner.accessToken;
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `aum${ts}@t.dev`, password: 'pass1234', displayName: 'm' } })).json;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Au', slug: `au-${ts}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email, role: 'MEMBER', allowedLocales: ['he'] } });
  const provider = (await call(`/projects/${pid}/mt/providers`, { jwt, method: 'POST', body: { name: 'Pseudo', type: 'pseudo' } })).json;

  const runs = async () => {
    const acts = (await call(`/projects/${pid}/activity`, { jwt })).json;
    return (acts.items || []).filter((a) => a.action === 'automation.run');
  };

  // Rule management is admin-only and whitelisted.
  const memberCreate = await call(`/projects/${pid}/automations`, { jwt: member.accessToken, method: 'POST', body: { name: 'x', trigger: 'key.created', action: 'task.create', config: { title: 't' } } });
  check('member cannot create a rule (403)', memberCreate.status === 403, `got ${memberCreate.status}`);
  const badTrigger = await call(`/projects/${pid}/automations`, { jwt, method: 'POST', body: { name: 'x', trigger: 'user.login', action: 'task.create', config: { title: 't' } } });
  check('unknown trigger rejected (400)', badTrigger.status === 400, `got ${badTrigger.status}`);
  const badAction = await call(`/projects/${pid}/automations`, { jwt, method: 'POST', body: { name: 'x', trigger: 'key.created', action: 'notify.slack', config: {} } });
  check('unknown action rejected (400)', badAction.status === 400, `got ${badAction.status}`);
  const badCombo = await call(`/projects/${pid}/automations`, { jwt, method: 'POST', body: { name: 'x', trigger: 'key.created', action: 'pretranslate', config: { providerId: provider.id, locales: ['he'] } } });
  check('key.created + pretranslate rejected (nothing to translate yet)', badCombo.status === 400, `got ${badCombo.status}`);
  const badProvider = await call(`/projects/${pid}/automations`, { jwt, method: 'POST', body: { name: 'x', trigger: 'translation.value', action: 'pretranslate', config: { providerId: '00000000-0000-0000-0000-000000000000', locales: ['he'] } } });
  check('foreign/unknown provider rejected (400)', badProvider.status === 400, `got ${badProvider.status}`);
  const baseLocaleRule = await call(`/projects/${pid}/automations`, { jwt, method: 'POST', body: { name: 'x', trigger: 'translation.value', action: 'pretranslate', config: { providerId: provider.id, locales: ['en'] } } });
  check('base locale in config.locales rejected (400)', baseLocaleRule.status === 400, `got ${baseLocaleRule.status}`);

  // Pretranslate rule: base-locale write on main fills the target cell.
  const rule = (await call(`/projects/${pid}/automations`, { jwt, method: 'POST', body: { name: 'Fill he', trigger: 'translation.value', action: 'pretranslate', config: { providerId: provider.id, locales: ['he'] } } })).json;
  check('rule created', !!rule.id && rule.enabled === true, JSON.stringify(rule).slice(0, 200));
  const k1 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'auto.one' } })).json;
  await new Promise((r) => setTimeout(r, 800));
  check('key.created alone does not fire the pretranslate rule', (await runs()).length === 0);
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Automation hello' } });
  const filled = await pollFor(async () => {
    const keys = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json;
    const t = keys.find((k) => k.id === k1.id).translations.find((t) => t.localeCode === 'he');
    return t && t.value ? t : null;
  });
  check('base write fired the rule: he filled with pseudo test data', !!filled && /^\[.*·he\]$/.test(filled.value) && filled.status === 'UNVERIFIED', filled && filled.value);
  const runEvents = await runs();
  check('automation.run activity recorded with attribution', runEvents.length === 1 && runEvents[0].keyName === 'auto.one', JSON.stringify(runEvents.length));

  // Bounds: non-base writes and non-main branches never fire.
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'ערך ידני' } });
  await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat-au' } });
  const kf = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'auto.feat', branch: 'feat-au' } })).json;
  await call(`/projects/${pid}/keys/${kf.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Feat source' } });
  await new Promise((r) => setTimeout(r, 1000));
  check('non-base and non-main writes do not fire rules', (await runs()).length === 1, `got ${(await runs()).length}`);
  const featTr = (await call(`/projects/${pid}/keys?branch=feat-au`, { jwt })).json.find((k) => k.id === kf.id).translations.find((t) => t.localeCode === 'he');
  check('feat branch key not auto-filled', !featTr);

  // No recursion: the rule's own he write did not re-fire (still 1 run event).
  check('automation writes do not re-trigger rules (no recursion)', (await runs()).length === 1);

  // task.create rule on key.created with {key} templating.
  const taskRule = (await call(`/projects/${pid}/automations`, { jwt, method: 'POST', body: { name: 'Task on new key', trigger: 'key.created', action: 'task.create', config: { title: 'Translate new key {key}' } } })).json;
  const k2 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'auto.two' } })).json;
  const task = await pollFor(async () => {
    const tasks = (await call(`/projects/${pid}/tasks`, { jwt })).json;
    const list = Array.isArray(tasks) ? tasks : tasks.items || [];
    return list.find((t) => t.title === 'Translate new key auto.two') || null;
  });
  check('key.created fired task.create with templated title', !!task, task && task.title);

  // Disabled rules do not fire.
  await call(`/projects/${pid}/automations/${taskRule.id}`, { jwt, method: 'PATCH', body: { enabled: false } });
  const k3 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'auto.three' } })).json;
  await new Promise((r) => setTimeout(r, 1000));
  const tasks3 = (await call(`/projects/${pid}/tasks`, { jwt })).json;
  check('disabled rule does not fire', !(Array.isArray(tasks3) ? tasks3 : tasks3.items || []).some((t) => t.title === 'Translate new key auto.three'));

  // Creator loses access: run fails visibly, write still succeeds. Disable
  // the owner's rule first so ONLY the removed admin's rule can fire here.
  await call(`/projects/${pid}/automations/${rule.id}`, { jwt, method: 'PATCH', body: { enabled: false } });
  const admin2 = (await call('/auth/signup', { method: 'POST', body: { email: `aua${ts}@t.dev`, password: 'pass1234', displayName: 'a2' } })).json;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: admin2.user.email, role: 'ADMIN', allowedLocales: [] } });
  const rule2 = (await call(`/projects/${pid}/automations`, { jwt: admin2.accessToken, method: 'POST', body: { name: 'A2 rule', trigger: 'translation.value', action: 'pretranslate', config: { providerId: provider.id, locales: ['he'] } } })).json;
  await call(`/projects/${pid}/members/${admin2.user.id}`, { jwt, method: 'DELETE' });
  const k4 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'auto.four' } })).json;
  const w4 = await call(`/projects/${pid}/keys/${k4.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Still written' } });
  check('triggering write succeeds even when the rule cannot run', w4.status === 200, `got ${w4.status}`);
  const errRun = await pollFor(async () => (await runs()).find((a) => a.keyName === 'auto.four'));
  const k4he = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k4.id).translations.find((t) => t.localeCode === 'he');
  check('removed creator: run recorded with error, nothing filled', !!errRun && !k4he, JSON.stringify(errRun && errRun.detail).slice(0, 120));

  // Deleted rule never fires.
  await call(`/projects/${pid}/automations/${rule.id}`, { jwt, method: 'DELETE' });
  const k5 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'auto.five' } })).json;
  await call(`/projects/${pid}/keys/${k5.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'No rule now' } });
  await new Promise((r) => setTimeout(r, 1000));
  const k5he = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k5.id).translations.find((t) => t.localeCode === 'he');
  check('deleted rule does not fire', !k5he);
} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `automations: ${failures} FAILURES` : 'automations pass complete');
process.exit(failures ? 1 : 0);
