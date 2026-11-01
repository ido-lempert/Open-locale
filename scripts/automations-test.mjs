// Automations slice: explicit trigger/action whitelist, admin-only rule
// management, bounded firing (main branch + base-locale writes only),
// internal effects only (pretranslate pseudo test data, task creation),
// runs execute as the rule creator with live permission re-checks, and
// automation writes never re-trigger rules. Real PG + HTTP.
// Run: node scripts/automations-test.mjs (requires: nx build api)
import { execFileSync, spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55470, API_PORT = 3000, HOOK_PORT = 55870;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
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

// Local webhook receiver for the notify action legs (fixture-only loopback).
const received = [];
let repositoryReceipt;
const receiver = createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', async () => { received.push({ event: req.headers['x-openlocale-event'], sig: req.headers['x-openlocale-signature'], body: b });
    if(repositoryReceipt){try{await repositoryReceipt();res.writeHead(500).end('retry fixture');}catch{res.writeHead(500).end('fixture mutation failed');}return;}
    res.writeHead(200).end(); });
});
await new Promise((r) => receiver.listen(HOOK_PORT, '127.0.0.1', r));

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-au-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api,prisma;
const require=createRequire(import.meta.url);
const automationBundle=join(root,'.tmp-automation-outcome.cjs');
execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/automations/automations.service.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+automationBundle]);
const {AutomationsService}=require(automationBundle);

try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_au');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_au`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'au-secret', PORT: String(API_PORT), WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true' }, stdio: 'pipe' }); // fixture-only opt-in for the loopback receiver
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

  // Re-enabled rule fires again.
  await call(`/projects/${pid}/automations/${taskRule.id}`, { jwt, method: 'PATCH', body: { enabled: true } });
  const k6 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'auto.six' } })).json;
  const task6 = await pollFor(async () => {
    const tasks6 = (await call(`/projects/${pid}/tasks`, { jwt })).json;
    return (Array.isArray(tasks6) ? tasks6 : tasks6.items || []).find((t) => t.title === 'Translate new key auto.six') || null;
  });
  check('re-enabled rule fires again', !!task6);

  // Attribution: the run event records the trigger actor and the run-as creator.
  const runSix = await pollFor(async () => (await runs()).find((a) => a.keyName === 'auto.six'));
  check('run records trigger actor and run-as creator', !!runSix && runSix.detail.triggeredBy === owner.user.id && runSix.detail.runAs === owner.user.id, JSON.stringify(runSix && runSix.detail).slice(0, 160));

  // Task-explosion bound: repeated fires with the same resolved title dedupe
  // to a single OPEN task; later runs are recorded as deduplicated.
  await call(`/projects/${pid}/automations`, { jwt, method: 'POST', body: { name: 'Review base change', trigger: 'translation.value', action: 'task.create', config: { title: 'Review base copy change' } } });
  await call(`/projects/${pid}/keys/${k6.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'v1' } });
  await pollFor(async () => (await runs()).find((a) => a.detail && a.detail.title === 'Review base copy change'));
  await call(`/projects/${pid}/keys/${k6.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'v2' } });
  const dedupeRun = await pollFor(async () => (await runs()).find((a) => a.detail && a.detail.deduplicated === true));
  const allTasks = (await call(`/projects/${pid}/tasks`, { jwt })).json;
  const openDupes = (Array.isArray(allTasks) ? allTasks : allTasks.items || []).filter((t) => t.title === 'Review base copy change');
  check('repeated fire dedupes to one open task', !!dedupeRun && openDupes.length === 1, `tasks=${openDupes.length}`);

  // Concurrent fires, deterministic sequencing: close the open task first,
  // then two parallel base writes resolve the same title. The advisory lock
  // must serialize check-then-create so exactly one new task appears.
  const reviewRuns = async () => (await runs()).filter((a) => a.detail && a.detail.title === 'Review base copy change');
  const reviewTask = (Array.isArray((await call(`/projects/${pid}/tasks?status=OPEN`, { jwt })).json) ? (await call(`/projects/${pid}/tasks?status=OPEN`, { jwt })).json : []).find((t) => t.title === 'Review base copy change');
  await call(`/projects/${pid}/tasks/${reviewTask.id}`, { jwt, method: 'PATCH', body: { status: 'DONE' } });
  const runsSoFar = (await reviewRuns()).length;
  await Promise.all([
    call(`/projects/${pid}/keys/${k6.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'v5' } }),
    call(`/projects/${pid}/keys/${k6.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'v6' } }),
  ]);
  await pollFor(async () => ((await reviewRuns()).length >= runsSoFar + 2 ? true : null));
  const reviewTasksAll = (Array.isArray((await call(`/projects/${pid}/tasks`, { jwt })).json) ? (await call(`/projects/${pid}/tasks`, { jwt })).json : []).filter((t) => t.title === 'Review base copy change');
  const dedupeSeen = (await reviewRuns()).some((a) => a.detail.deduplicated === true);
  check('concurrent fires create exactly one task (advisory lock)', reviewTasksAll.length === 2 && dedupeSeen, `tasks=${reviewTasksAll.length}`);

  // Demotion: creator changed ADMIN -> MEMBER with a he-only grant after
  // creating the rule. The next run fills he but ar fails visibly - the
  // creator's CURRENT grants apply, not the grants at creation time.
  await call(`/projects/${pid}/locales`, { jwt, method: 'POST', body: { code: 'ar' } });
  const admin3 = (await call('/auth/signup', { method: 'POST', body: { email: `aud${ts}@t.dev`, password: 'pass1234', displayName: 'a3' } })).json;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: admin3.user.email, role: 'ADMIN', allowedLocales: [] } });
  await call(`/projects/${pid}/automations`, { jwt: admin3.accessToken, method: 'POST', body: { name: 'A3 rule', trigger: 'translation.value', action: 'pretranslate', config: { providerId: provider.id, locales: ['he', 'ar'] } } });
  await call(`/projects/${pid}/members/${admin3.user.id}`, { jwt, method: 'PATCH', body: { role: 'MEMBER', allowedLocales: ['he'] } });
  const k7 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'auto.seven' } })).json;
  await call(`/projects/${pid}/keys/${k7.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Source text' } });
  // A2's rule also fires on this event and legitimately records an error
  // (its creator was removed from the team) - select A3's run by runAs, not
  // just keyName, or the check races the two runs' list order.
  const demoteRun = await pollFor(async () => (await runs()).find((a) => a.keyName === 'auto.seven' && a.detail && a.detail.results && a.detail.runAs === admin3.user.id));
  const k7rows = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k7.id).translations;
  const k7he = k7rows.find((t) => t.localeCode === 'he');
  const k7ar = k7rows.find((t) => t.localeCode === 'ar');
  check('demoted creator: granted locale fills, ungranted locale fails visibly', !!k7he && !k7ar && !!(demoteRun && demoteRun.detail.results.ar && demoteRun.detail.results.ar.error), JSON.stringify(demoteRun && demoteRun.detail.results).slice(0, 200));
  // --- notify action (slice 19): dispatches the project's admin-managed
  // webhooks subscribed to automation.notify; the rule config carries no URL.
  const noMsg = await call(`/projects/${pid}/automations`, { jwt, method: 'POST', body: { name: 'n', trigger: 'key.created', action: 'notify', config: {} } });
  check('notify without config.message rejected (400)', noMsg.status === 400, `got ${noMsg.status}`);
  const hook = (await call(`/projects/${pid}/webhooks`, { jwt, method: 'POST', body: { url: `http://127.0.0.1:${HOOK_PORT}/au`, events: ['automation.notify'] } })).json;
  check('webhook can subscribe to automation.notify (secret revealed once)', typeof hook.secret === 'string' && hook.secret.length >= 24);
  const notifRule = (await call(`/projects/${pid}/automations`, { jwt, method: 'POST', body: { name: 'Announce keys', trigger: 'key.created', action: 'notify', config: { message: 'New key {key} needs translation' } } })).json;
  check('notify rule created', !!notifRule.id, JSON.stringify(notifRule).slice(0, 160));
  await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'auto.notify' } });
  const hit = await pollFor(async () => received.find((r) => r.event === 'automation.notify') || null);
  check('key.created fired notify: receiver got the signed event', !!hit, JSON.stringify(hit && hit.body).slice(0, 120));
  const parsed = hit && JSON.parse(hit.body);
  check('payload carries key and interpolated message', !!parsed && parsed.key === 'auto.notify' && parsed.message === 'New key auto.notify needs translation' && typeof parsed.keyId === 'string', parsed && parsed.message);
  const expectedSig = hit && 'sha256=' + createHmac('sha256', hook.secret).update(hit.body).digest('hex');
  check('HMAC signature verifies against the one-time secret', !!hit && hit.sig === expectedSig, String(hit && hit.sig));
  const notifRun = await pollFor(async () => (await runs()).find((a) => a.detail && a.detail.message));
  check('notify run recorded in activity with the delivered message', !!notifRun && notifRun.detail.action === 'notify', JSON.stringify(notifRun && notifRun.detail).slice(0, 140));
  prisma=new PrismaClient({datasources:{db:{url}}});
  const summaryProject=await prisma.project.create({data:{teamId:(await prisma.project.findUnique({where:{id:pid}})).teamId,name:'Summary fixture',slug:'summary-fixture',baseLocale:'en'}});
  const summaryBranch=await prisma.branch.create({data:{projectId:summaryProject.id,name:'main'}});
  const summaryKey=await prisma.key.create({data:{projectId:summaryProject.id,branchId:summaryBranch.id,name:'summary.key'}});
  const activityBundle=join(root,'.tmp-automation-activity.cjs'),projectsBundle=join(root,'.tmp-automation-projects.cjs'),tasksBundle=join(root,'.tmp-automation-tasks.cjs');
  for(const [src,out] of [['activity/activity.service.ts',activityBundle],['projects/projects.service.ts',projectsBundle],['tasks/tasks.service.ts',tasksBundle]])execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/'+src,'--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+out]);
  const {ActivityService}=require(activityBundle),{ProjectsService}=require(projectsBundle),{TasksService}=require(tasksBundle);const activityService=new ActivityService(prisma),projectsService=new ProjectsService(prisma,activityService),tasksService=new TasksService(prisma,projectsService,activityService);
  const summaryService=new AutomationsService(prisma,projectsService,activityService,{},tasksService,{deliver:async()=>({matched:1,succeeded:0,failed:1})});
  const summaryCtx={keyId:summaryKey.id,keyName:summaryKey.name,branchName:'main',localeCode:'en',actorId:owner.user.id};
  const noRules=await summaryService.fire(summaryProject.id,'translation.value',summaryCtx);
  check('automation no-rule summary is zero without false delivery claim',noRules.matched===0&&noRules.succeeded===0&&noRules.failed===0&&!noRules.skipped);
  const summaryRule=await prisma.automationRule.create({data:{projectId:summaryProject.id,name:'Summary task',trigger:'translation.value',action:'task.create',config:{title:'Summary task'},creatorId:owner.user.id}});
  const taskSummary=await summaryService.fire(summaryProject.id,'translation.value',summaryCtx);
  check('automation successful summary waits for actual task and activity',taskSummary.matched===1&&taskSummary.succeeded===1&&taskSummary.failed===0&&await prisma.task.count({where:{projectId:summaryProject.id,title:'Summary task'}})===1&&await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'automation.run'}})===1);
  const branchSummary=await summaryService.fire(summaryProject.id,'translation.value',{...summaryCtx,branchName:'feature'}),localeSummary=await summaryService.fire(summaryProject.id,'translation.value',{...summaryCtx,localeCode:'he'});
  check('automation summary explicitly skips branch and nonbase trigger',branchSummary.skipped&&localeSummary.skipped&&branchSummary.matched===0&&localeSummary.matched===0);
  await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'notify',config:{message:'Summary notification'}}});
  const failedNotify=await summaryService.fire(summaryProject.id,'translation.value',summaryCtx);
  check('notification transport aggregate failure becomes failed automation summary',failedNotify.matched===1&&failedNotify.failed===1&&failedNotify.succeeded===0);
  await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'pretranslate',config:{providerId:'missing-fixture',locales:['he']}}});
  const failedMt=await summaryService.fire(summaryProject.id,'translation.value',summaryCtx);
  check('caught per-locale MT errors cannot count as successful automation',failedMt.matched===1&&failedMt.failed===1&&failedMt.succeeded===0);
  const repositoryBundle=join(root,'.tmp-repository-automation.cjs');execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-automation-handler.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+repositoryBundle]);const {fireRepositoryAutomation}=require(repositoryBundle);
  await prisma.projectLocale.createMany({data:[{projectId:summaryProject.id,code:'en'},{projectId:summaryProject.id,code:'he'}]});
  const sourceRow=await prisma.translation.create({data:{projectId:summaryProject.id,keyId:summaryKey.id,localeCode:'en',value:'Repository source'}});
  const repoTarget=await prisma.repositorySyncTarget.create({data:{projectId:summaryProject.id,branchId:summaryBranch.id,localBranch:'main',locale:'en',owner:'fixture',repo:'fixture',path:'en.json',remoteBranch:'main'}});
  const repoIntent=await prisma.repositoryLocalEffectIntent.create({data:{projectId:summaryProject.id,targetId:repoTarget.id,targetRevision:1,actorId:owner.user.id,keyId:summaryKey.id,keyName:summaryKey.name,branchId:summaryBranch.id,branch:'main',locale:'en',operation:'set-value',value:sourceRow.value,translationRowId:sourceRow.rowId,translationVersion:sourceRow.version,draftContentDigest:'a'.repeat(64),previewFingerprint:'b'.repeat(64),state:'leased',attempts:1,leaseToken:owner.user.id,leaseUntil:new Date('2099-01-01')}});
  await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'task.create',config:{title:'Repository task'}}});
  const repoSummary=await fireRepositoryAutomation(prisma,summaryService,repoIntent);
  check('repository automation adapter creates actual task and awaited activity',repoSummary.succeeded===1&&repoSummary.failed===0&&await prisma.task.count({where:{projectId:summaryProject.id,title:'Repository task'}})===1);
  const repoRun=await prisma.activityEvent.findFirst({where:{projectId:summaryProject.id,action:'automation.run'},orderBy:{createdAt:'desc'}});
  check('repository automation preserves triggering actor and creator audit',repoRun.detail.triggeredBy===owner.user.id&&repoRun.detail.runAs===owner.user.id);
  await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:{increment:1}}});let deniedRepo=false;const runsBefore=await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'automation.run'}});try{await fireRepositoryAutomation(prisma,summaryService,repoIntent);}catch{deniedRepo=true;}
  check('changed repository context rejects before automation runs',deniedRepo&&await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'automation.run'}})===runsBefore);
  await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:1}});
  await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'notify',config:{message:'Failed repository notification'}}});let failedRepo=false;try{await fireRepositoryAutomation(prisma,summaryService,repoIntent);}catch{failedRepo=true;}
  check('repository automation adapter propagates failed rule summary',failedRepo);
  await prisma.translation.delete({where:{keyId_localeCode:{keyId:summaryKey.id,localeCode:'en'}}});await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{operation:'remove-locale-value',value:null,translationRowId:null,translationVersion:null}});
  const removalSummary=await fireRepositoryAutomation(prisma,summaryService,repoIntent);
  check('repository locale removal does not invent value automation trigger',removalSummary.skipped&&removalSummary.matched===0);
  const emptyRepoRow=await prisma.translation.create({data:{projectId:summaryProject.id,keyId:summaryKey.id,localeCode:'en',value:''}});await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{operation:'set-value',value:'',translationRowId:emptyRepoRow.rowId,translationVersion:emptyRepoRow.version}});await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'task.create',config:{title:'Empty repository task'}}});
  const emptyRepoSummary=await fireRepositoryAutomation(prisma,summaryService,repoIntent);
  check('empty repository set follows normal value automation semantics',emptyRepoSummary.succeeded===1&&await prisma.task.count({where:{projectId:summaryProject.id,title:'Empty repository task'}})===1);
  // Mutate actual PG context in the first committed automation activity.
  // Next rule must be stopped before its task or activity, not just summarized.
  const secondRepoRule=await prisma.automationRule.create({data:{projectId:summaryProject.id,name:'Second repository rule',trigger:'translation.value',action:'task.create',config:{title:'Guarded second task'},creatorId:owner.user.id,createdAt:new Date('2098-01-01')}});
  for(const mutation of ['target','lease']) {
    await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:1}});
    await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{leaseUntil:new Date('2099-01-01')}});
    const firstTitle='Guarded first '+mutation,secondTitle='Guarded second '+mutation;
    await prisma.automationRule.update({where:{id:summaryRule.id},data:{config:{title:firstTitle}}});
    await prisma.automationRule.update({where:{id:secondRepoRule.id},data:{config:{title:secondTitle}}});
    let mutated=false;
    const changingActivity={record:async(tx,event)=>{await activityService.record(tx,event);if(event.action==='automation.run'&&!mutated){mutated=true;if(mutation==='target')await tx.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:{increment:1}}});else await tx.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()-interval '1 second' WHERE id=${repoIntent.id}::uuid`;}}};
    const guardedService=new AutomationsService(prisma,projectsService,changingActivity,{},tasksService,{deliver:async()=>({matched:0,succeeded:0,failed:0})});
    const beforeRuns=await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'automation.run'}});let stopped=false;
    try{await fireRepositoryAutomation(prisma,guardedService,repoIntent);}catch{stopped=true;}
    check('repository '+mutation+' change after first rule preserves committed first effect',mutated&&await prisma.task.count({where:{projectId:summaryProject.id,title:firstTitle}})===1);
    check('repository '+mutation+' change suppresses second actual rule task and activity',stopped&&await prisma.task.count({where:{projectId:summaryProject.id,title:secondTitle}})===0&&await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'automation.run'}})===beforeRuns+1);
  }
  await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:1}});
  await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{leaseUntil:new Date('2099-01-01')}});
  await prisma.automationRule.delete({where:{id:secondRepoRule.id}});
  for(const mutation of ['disable','delete','config','disable-restore','config-restore']) {
    const firstTitle='Fresh first '+mutation,secondTitle='Fresh second '+mutation;
    await prisma.automationRule.update({where:{id:summaryRule.id},data:{config:{title:firstTitle}}});
    const captured=await prisma.automationRule.create({data:{projectId:summaryProject.id,name:'Freshness '+mutation,trigger:'translation.value',action:'task.create',config:{title:secondTitle},creatorId:owner.user.id,createdAt:new Date('2098-01-01')}});
    let mutated=false;
    const changingActivity={record:async(tx,event)=>{await activityService.record(tx,event);if(event.action==='automation.run'&&!mutated){mutated=true;
      const path=`/projects/${summaryProject.id}/automations/${captured.id}`;
      if(mutation==='delete'){const res=await call(path,{jwt,method:'DELETE'});if(res.status>=300)throw new Error('fixture delete failed');}
      else {const configMutation=mutation.startsWith('config');const res=await call(path,{jwt,method:'PATCH',body:configMutation?{config:{title:'Unexpected stale destination '+mutation}}:{enabled:false}});if(res.status>=300)throw new Error('fixture update failed');
        if(mutation.endsWith('restore')){const restored=await call(path,{jwt,method:'PATCH',body:configMutation?{config:{title:secondTitle}}:{enabled:true}});if(restored.status>=300)throw new Error('fixture restore failed');}
      }
    }}};
    const guardedService=new AutomationsService(prisma,projectsService,changingActivity,{},tasksService,{deliver:async()=>({matched:0,succeeded:0,failed:0})});
    const beforeRuns=await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'automation.run'}});let stopped=false;
    try{await fireRepositoryAutomation(prisma,guardedService,repoIntent);}catch{stopped=true;}
    check('captured rule '+mutation+' stops second task and activity after actual first effect',mutated&&stopped&&await prisma.task.count({where:{projectId:summaryProject.id,title:firstTitle}})===1&&await prisma.task.count({where:{projectId:summaryProject.id,title:secondTitle}})===0&&await prisma.task.count({where:{projectId:summaryProject.id,title:'Unexpected stale destination '+mutation}})===0&&await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'automation.run'}})===beforeRuns+1);
    if(mutation!=='delete'){const changed=await prisma.automationRule.findUnique({where:{id:captured.id}});check('authenticated rule '+mutation+' increments revision',changed.revision===captured.revision+(mutation.endsWith('restore')?2:1));await prisma.automationRule.delete({where:{id:captured.id}});}
  }
  const webhookBundle=join(root,'.tmp-automation-webhooks.cjs');execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/webhooks/webhooks.service.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+webhookBundle]);const {WebhooksService}=require(webhookBundle);
  process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS='true';
  const socketService=new AutomationsService(prisma,projectsService,activityService,{},tasksService,new WebhooksService(prisma,projectsService));
  const socketHook=await prisma.webhook.create({data:{projectId:summaryProject.id,url:`http://127.0.0.1:${HOOK_PORT}/repository-notify`,events:['automation.notify'],secret:'repository-notify-fixture'}});
  for(const mutation of ['target','lease','rule-restore']) {
    await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:1}});
    await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{leaseUntil:new Date('2099-01-01')}});
    await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'notify',config:{message:'Repository socket '+mutation}}});
    const capturedRevision=(await prisma.automationRule.findUnique({where:{id:summaryRule.id}})).revision;
    let mutated=false;const receiptBefore=received.length;
    repositoryReceipt=async()=>{if(mutated)return;mutated=true;
      if(mutation==='target')await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:{increment:1}}});
      else if(mutation==='lease')await prisma.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()-interval '1 second' WHERE id=${repoIntent.id}::uuid`;
      else {const path=`/projects/${summaryProject.id}/automations/${summaryRule.id}`;for(const enabled of [false,true]){const r=await call(path,{jwt,method:'PATCH',body:{enabled}});if(r.status>=300)throw new Error('receiver fixture update failed');}}
    };
    let failed=false;try{await fireRepositoryAutomation(prisma,socketService,repoIntent);}catch{failed=true;}repositoryReceipt=undefined;
    const journal=await prisma.webhookDelivery.findFirst({where:{webhookId:socketHook.id},orderBy:{createdAt:'desc'}});
    check('repository notify '+mutation+' change after real500 suppresses second socket',mutated&&failed&&received.length===receiptBefore+1&&journal?.attempts===1&&journal?.success===false);
    const hit=received[receiptBefore],sig='sha256='+createHmac('sha256',socketHook.secret).update(hit.body).digest('hex');
    check('repository notify '+mutation+' first socket signed and guard abort journaled',hit.event==='automation.notify'&&hit.sig===sig&&typeof journal?.error==='string'&&journal.error.length>0);
    if(mutation==='rule-restore')check('notify socket ABA uses actual authenticated revision changes',(await prisma.automationRule.findUnique({where:{id:summaryRule.id}})).revision===capturedRevision+2);
  }
  await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:1}});await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{leaseUntil:new Date('2099-01-01')}});
  rmSync(webhookBundle,{force:true});
  const mtBundle=join(root,'.tmp-automation-mt.cjs');execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/mt/mt.service.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+mtBundle]);const {MtService}=require(mtBundle);
  await prisma.projectLocale.create({data:{projectId:summaryProject.id,code:'ar'}});
  const actualProvider=await prisma.mtProvider.create({data:{projectId:summaryProject.id,name:'Repository pseudo',type:'pseudo'}});
  for(const mutation of ['target','lease','rule-restore']) {
    await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:1}});await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{leaseUntil:new Date('2099-01-01')}});
    await prisma.translation.update({where:{keyId_localeCode:{keyId:summaryKey.id,localeCode:'en'}},data:{value:'Locale guard source'}});
    const currentSource=await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:summaryKey.id,localeCode:'en'}}});await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{value:currentSource.value,translationRowId:currentSource.rowId,translationVersion:currentSource.version}});
    await prisma.translation.deleteMany({where:{keyId:summaryKey.id,localeCode:{in:['he','ar']}}});
    await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'pretranslate',config:{providerId:actualProvider.id,locales:['he','ar']}}});
    const beforeHistory=await prisma.translationHistory.count({where:{keyId:summaryKey.id,localeCode:'ar'}}),beforeActivity=await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'mt.pretranslate'}});let mutated=false;
    // MT emits after its locale transaction commits. Delegate real offline MT
    // and activity services; use that event seam solely for fixture mutation.
    const afterLocale={deliver:async()=>{if(mutated)return {matched:0,succeeded:0,failed:0};mutated=true;
      if(mutation==='target')await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:{increment:1}}});
      else if(mutation==='lease')await prisma.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()-interval '1 second' WHERE id=${repoIntent.id}::uuid`;
      else {const path=`/projects/${summaryProject.id}/automations/${summaryRule.id}`;for(const enabled of [false,true]){const r=await call(path,{jwt,method:'PATCH',body:{enabled}});if(r.status>=300)throw new Error('locale fixture rule change failed');}}
      return {matched:0,succeeded:0,failed:0};}};
    // Await the seam to make the between-locale mutation deterministic even
    // though production MT's notification is fire-and-forget.
    const actualMt=new MtService(prisma,projectsService,activityService,afterLocale,tasksService);
    const mtWithCommitSeam={pretranslate:async(...args)=>{const result=await actualMt.pretranslate(...args);await mutationDone;return result;}};
    let mutationDone=Promise.resolve();const deliverMutation=afterLocale.deliver;afterLocale.deliver=()=>{mutationDone=deliverMutation();return mutationDone;};
    const localeService=new AutomationsService(prisma,projectsService,activityService,mtWithCommitSeam,tasksService,{deliver:async()=>({matched:0,succeeded:0,failed:0})});
    let failed=false;try{await fireRepositoryAutomation(prisma,localeService,repoIntent);}catch{failed=true;}
    check('repository MT '+mutation+' preserves first actual offline locale fill',mutated&&failed&&!!(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:summaryKey.id,localeCode:'he'}}}))?.value);
    check('repository MT '+mutation+' suppresses second locale translation history and activity',await prisma.translation.count({where:{keyId:summaryKey.id,localeCode:'ar'}})===0&&await prisma.translationHistory.count({where:{keyId:summaryKey.id,localeCode:'ar'}})===beforeHistory&&await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'mt.pretranslate'}})===beforeActivity+1);
  }
  await prisma.translation.deleteMany({where:{keyId:summaryKey.id,localeCode:{in:['he','ar']}}});
  await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:1}});await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{leaseUntil:new Date('2099-01-01')}});
  for(const mutation of ['target','lease','rule-restore']) {
    await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:1}});await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{leaseUntil:new Date('2099-01-01')}});
    await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'pretranslate',config:{providerId:actualProvider.id,locales:['he']}}});
    const beforeHistory=await prisma.translationHistory.count({where:{keyId:summaryKey.id,localeCode:'he'}}),beforeActivity=await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'mt.pretranslate'}});let mutated=false,guardSupplied=false;
    const realMt=new MtService(prisma,projectsService,activityService,{deliver:async()=>({matched:0,succeeded:0,failed:0})},tasksService);
    // Real service/driver compute normally. The explicit beforeWrite seam then
    // changes context before delegating the production guard supplied by caller.
    const computationSeam={pretranslate:async(user,project,dto,options)=>realMt.pretranslate(user,project,dto,{beforeWrite:async()=>{
      guardSupplied=typeof options?.beforeWrite==='function';mutated=true;
      if(mutation==='target')await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:{increment:1}}});
      else if(mutation==='lease')await prisma.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()-interval '1 second' WHERE id=${repoIntent.id}::uuid`;
      else {const path=`/projects/${summaryProject.id}/automations/${summaryRule.id}`;for(const enabled of [false,true]){const r=await call(path,{jwt,method:'PATCH',body:{enabled}});if(r.status>=300)throw new Error('prewrite fixture update failed');}}
      await options?.beforeWrite?.();
    }})};
    const computedService=new AutomationsService(prisma,projectsService,activityService,computationSeam,tasksService,{deliver:async()=>({matched:0,succeeded:0,failed:0})});
    let failed=false;try{await fireRepositoryAutomation(prisma,computedService,repoIntent);}catch{failed=true;}
    check('repository MT prewrite '+mutation+' rejects after real provider computation',mutated&&guardSupplied&&failed);
    check('repository MT prewrite '+mutation+' leaves no translation history or MT activity',await prisma.translation.count({where:{keyId:summaryKey.id,localeCode:'he'}})===0&&await prisma.translationHistory.count({where:{keyId:summaryKey.id,localeCode:'he'}})===beforeHistory&&await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'mt.pretranslate'}})===beforeActivity);
  }
  await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:1}});await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{leaseUntil:new Date('2099-01-01')}});
  rmSync(mtBundle,{force:true});
  const stepBundle=join(root,'.tmp-repository-automation-step.cjs');execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-automation-step.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+stepBundle]);const {runRepositoryAutomationStep}=require(stepBundle);
  const resetStep=()=>prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{state:'pending',attempts:0,leaseToken:null,leaseUntil:null,finishedAt:null,automationHandledAt:null,availableAt:new Date('2020-01-01')}});
  await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'task.create',config:{title:'Checkpointed automation task'}}});await resetStep();
  const stepResult=await runRepositoryAutomationStep(prisma,summaryService),handledRow=await prisma.repositoryLocalEffectIntent.findUnique({where:{id:repoIntent.id}});
  check('automation step commits actual task activity and independent handled checkpoint',stepResult.status==='completed'&&!!handledRow.automationHandledAt&&handledRow.webhookHandledAt===null&&await prisma.task.count({where:{projectId:summaryProject.id,title:'Checkpointed automation task'}})===1);
  const beforeReplay=await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'automation.run'}});
  await prisma.task.updateMany({where:{projectId:summaryProject.id,title:'Checkpointed automation task'},data:{status:'DONE'}});
  await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{state:'pending',attempts:0,finishedAt:null,availableAt:new Date('2020-01-01')}});
  const replayStep=await runRepositoryAutomationStep(prisma,summaryService);
  check('checkpointed automation requeue skips actual task and activity replay',replayStep.status==='completed'&&await prisma.task.count({where:{projectId:summaryProject.id,title:'Checkpointed automation task'}})===1&&await prisma.activityEvent.count({where:{projectId:summaryProject.id,action:'automation.run'}})===beforeReplay&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:repoIntent.id}})).automationHandledAt.getTime()===handledRow.automationHandledAt.getTime());
  await resetStep();await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'notify',config:{message:'Checkpoint failure fixture'}}});
  const failedStep=await runRepositoryAutomationStep(prisma,summaryService),failedRow=await prisma.repositoryLocalEffectIntent.findUnique({where:{id:repoIntent.id}});
  check('failed aggregate step requeues without automation handled checkpoint',failedStep.status==='retry'&&failedRow.state==='pending'&&failedRow.automationHandledAt===null);
  await resetStep();await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'task.create',config:{title:'Expired checkpoint task'}}});
  const expiringActivity={record:async(tx,event)=>{await activityService.record(tx,event);if(event.action==='automation.run')await tx.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()-interval '1 second' WHERE id=${repoIntent.id}::uuid`;}};
  const expiryService=new AutomationsService(prisma,projectsService,expiringActivity,{},tasksService,{deliver:async()=>({matched:0,succeeded:0,failed:0})});
  const expiredStep=await runRepositoryAutomationStep(prisma,expiryService),expiredRow=await prisma.repositoryLocalEffectIntent.findUnique({where:{id:repoIntent.id}});
  check('post-effect expired lease cannot checkpoint or settle automation completion',expiredStep.status==='stale'&&expiredRow.automationHandledAt===null&&await prisma.task.count({where:{projectId:summaryProject.id,title:'Expired checkpoint task'}})===1);
  const combinedBundle=join(root,'.tmp-repository-combined-step.cjs');execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-effect-step.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+combinedBundle]);const {runRepositoryEffectStep}=require(combinedBundle);
  await prisma.webhook.update({where:{id:socketHook.id},data:{events:['translation.updated']}});
  const liveWebhooks=new WebhooksService(prisma,projectsService);
  const resetCombined=async()=>{await resetStep();await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{webhookHandledAt:null}});};
  await resetCombined();await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'task.create',config:{title:'Combined task'}}});let socketBefore=received.length;
  const combinedOk=await runRepositoryEffectStep(prisma,liveWebhooks,summaryService),combinedRow=await prisma.repositoryLocalEffectIntent.findUnique({where:{id:repoIntent.id}});
  check('combined explicit step signs actual receiver then creates task with both checkpoints',combinedOk.status==='completed'&&!!combinedRow.webhookHandledAt&&!!combinedRow.automationHandledAt&&received.length===socketBefore+1&&JSON.parse(received.at(-1).body).effectId===repoIntent.id&&await prisma.task.count({where:{projectId:summaryProject.id,title:'Combined task'}})===1);
  const combinedHit=received.at(-1);check('combined first channel actual signature verifies',combinedHit.sig==='sha256='+createHmac('sha256',socketHook.secret).update(combinedHit.body).digest('hex'));
  await resetCombined();await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'notify',config:{message:'Combined failure fixture'}}});socketBefore=received.length;
  const combinedFailed=await runRepositoryEffectStep(prisma,liveWebhooks,summaryService),partialCombined=await prisma.repositoryLocalEffectIntent.findUnique({where:{id:repoIntent.id}});
  check('combined automation failure preserves webhook checkpoint but not automation completion',combinedFailed.status==='retry'&&partialCombined.state==='pending'&&!!partialCombined.webhookHandledAt&&partialCombined.automationHandledAt===null&&received.length===socketBefore+1);
  await prisma.automationRule.update({where:{id:summaryRule.id},data:{action:'task.create',config:{title:'Combined recovered task'}}});await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{availableAt:new Date('2020-01-01')}});socketBefore=received.length;
  const combinedRetry=await runRepositoryEffectStep(prisma,liveWebhooks,summaryService),recoveredCombined=await prisma.repositoryLocalEffectIntent.findUnique({where:{id:repoIntent.id}});
  check('combined due retry skips handled webhook and executes remaining actual task',combinedRetry.status==='completed'&&received.length===socketBefore&&!!recoveredCombined.automationHandledAt&&recoveredCombined.webhookHandledAt.getTime()===partialCombined.webhookHandledAt.getTime()&&await prisma.task.count({where:{projectId:summaryProject.id,title:'Combined recovered task'}})===1);
  socketBefore=received.length;check('combined completed row is idle without another receiver call',(await runRepositoryEffectStep(prisma,liveWebhooks,summaryService)).status==='idle'&&received.length===socketBefore);
  await resetCombined();await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:{increment:1}}});socketBefore=received.length;
  const invalidCombined=await runRepositoryEffectStep(prisma,liveWebhooks,summaryService);
  check('combined changed target is ineligible before either channel',invalidCombined.status==='ineligible'&&received.length===socketBefore&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:repoIntent.id}})).webhookHandledAt===null);
  await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{revision:1}});
  rmSync(combinedBundle,{force:true});
  // Fresh leased row for remaining direct-adapter scope checks.
  await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{state:'leased',leaseToken:owner.user.id,leaseUntil:new Date('2099-01-01')}});
  rmSync(stepBundle,{force:true});
  const heRepoRow=await prisma.translation.create({data:{projectId:summaryProject.id,keyId:summaryKey.id,localeCode:'he',value:'Target'}});await prisma.repositorySyncTarget.update({where:{id:repoTarget.id},data:{locale:'he'}});await prisma.repositoryLocalEffectIntent.update({where:{id:repoIntent.id},data:{locale:'he',value:heRepoRow.value,translationRowId:heRepoRow.rowId,translationVersion:heRepoRow.version}});
  const nonbaseRepo=await fireRepositoryAutomation(prisma,summaryService,repoIntent);
  check('repository target locale does not trigger base-value automations',nonbaseRepo.skipped&&nonbaseRepo.matched===0);
  rmSync(repositoryBundle,{force:true});
  await prisma.project.delete({where:{id:summaryProject.id}});
  for(const out of [activityBundle,projectsBundle,tasksBundle])rmSync(out,{force:true});
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  rmSync(automationBundle,{force:true});await prisma?.$disconnect();
  receiver.close();
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `automations: ${failures} FAILURES` : 'automations pass complete');
process.exit(failures ? 1 : 0);
