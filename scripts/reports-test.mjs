// Reports: progress counts per locale/branch. Real PostgreSQL + real HTTP API.
// Run: node scripts/reports-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = Number(process.env.REPORTS_TEST_PG_PORT ?? 55466), API_PORT = 3028;
const API = `http://127.0.0.1:${API_PORT}/api`;
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
  return { status: res.status, json: await res.json().catch(() => null), cacheControl:res.headers.get('cache-control') };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-rp-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api,prisma;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_rp');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_rp`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  prisma=new PrismaClient({datasources:{db:{url}}});
  await prisma.$executeRawUnsafe(`ALTER DATABASE openlocale_rp SET timezone TO 'America/Los_Angeles'`);
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'rp-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const owner = (await call('/auth/signup', { method: 'POST', body: { email: `rp${Date.now()}@t.dev`, password: 'pass1234', displayName: 'rp' } })).json;
  const jwt = owner.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Rp', slug: `rp-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { customStatuses: ['NEEDS_FIX'] } });
  const k = async (name, branch) => (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name, branch } })).json;
  const put = async (id, locale, value, status) => {
    await call(`/projects/${pid}/keys/${id}/translations`, { jwt, method: 'PUT', body: { locale, value } });
    if (status) await call(`/projects/${pid}/keys/${id}/translations/${locale}/status`, { jwt, method: 'PATCH', body: { status } });
  };
  // main: 4 keys. en: 4 non-empty (2 REVIEWED, 1 TRANSLATED, 1 NEEDS_FIX).
  // he: 2 non-empty (1 REVIEWED, 1 UNVERIFIED), 1 empty, 1 missing.
  const [a, b, c, d] = [await k('k.a'), await k('k.b'), await k('k.c'), await k('k.d')];
  await put(a.id, 'en', 'A', 'REVIEWED'); await put(b.id, 'en', 'B', 'REVIEWED');
  await put(c.id, 'en', 'C', 'TRANSLATED'); await put(d.id, 'en', 'D', 'NEEDS_FIX');
  await put(a.id, 'he', 'א', 'REVIEWED'); await put(b.id, 'he', 'ב', 'UNVERIFIED');
  await put(c.id, 'he', ''); // empty: untranslated
  // d.he missing entirely: untranslated

  const r = (await call(`/projects/${pid}/reports/progress`, { jwt })).json;
  const en = r.locales.find((l) => l.locale === 'en');
  const he = r.locales.find((l) => l.locale === 'he');
  check('total keys on branch', r.totalKeys === 4 && r.branch === 'main', JSON.stringify({ total: r.totalKeys, branch: r.branch }));
  check('en: 4/4 translated, 100%, status breakdown',
    en.translated === 4 && en.untranslated === 0 && en.percent === 100 && en.byStatus.REVIEWED === 2 && en.byStatus.TRANSLATED === 1 && en.byStatus.NEEDS_FIX === 1,
    JSON.stringify(en));
  check('he: empty value and missing row both count untranslated',
    he.translated === 2 && he.untranslated === 2 && he.percent === 50 && he.byStatus.REVIEWED === 1 && he.byStatus.UNVERIFIED === 1,
    JSON.stringify(he));
  check('status counts add up per locale', en.translated === Object.values(en.byStatus).reduce((x, y) => x + y, 0) && he.translated === Object.values(he.byStatus).reduce((x, y) => x + y, 0));

  // Branch scoping: feat has its own independent numbers.
  await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat' } });
  const fa = await k('k.a', 'feat');
  await put(fa.id, 'he', 'ברנץ', 'TRANSLATED');
  const rf = (await call(`/projects/${pid}/reports/progress?branch=feat`, { jwt })).json;
  const fhe = rf.locales.find((l) => l.locale === 'he');
  check('feat progress independent: 1 key, he 1/1', rf.totalKeys === 1 && fhe.translated === 1 && fhe.percent === 100, JSON.stringify({ t: rf.totalKeys, he: fhe }));
  check('main progress unaffected by feat', (await call(`/projects/${pid}/reports/progress`, { jwt })).json.totalKeys === 4);
  check('unknown branch 404', (await call(`/projects/${pid}/reports/progress?branch=nope`, { jwt })).status === 404);

  // Dashboards: quality / usage / tasks (slice 13)
  // Extra key with a placeholder mismatch on he: en 'Hello {name}' -> he missing {name}.
  const e = await k('k.e');
  await put(e.id, 'en', 'Hello {name}', 'REVIEWED');
  await put(e.id, 'he', 'שלום', 'UNVERIFIED');

  const q = (await call(`/projects/${pid}/reports/quality`, { jwt })).json;
  check('quality: totals add up', q.totalIssues === 3 && q.keysWithIssues === 3, JSON.stringify({ t: q.totalIssues, k: q.keysWithIssues }));
  check('quality: untranslated + placeholder_mismatch counts', q.byType.untranslated === 2 && q.byType.placeholder_mismatch === 1, JSON.stringify(q.byType));
  check('quality: types sorted, he carries all 3', q.types.join(',') === 'placeholder_mismatch,untranslated' && q.locales.length === 1 && q.locales[0].locale === 'he' && q.locales[0].total === 3, JSON.stringify(q.locales));
  check('quality: branch-scoped (feat has no issues)', (await call(`/projects/${pid}/reports/quality?branch=feat`, { jwt })).json.totalIssues === 0);

  // Tasks: one overdue open, one in-progress due soon, one done.
  const t1 = await call(`/projects/${pid}/tasks`, { jwt, method: 'POST', body: { title: 'overdue', dueDate: '2020-01-01T00:00:00Z' } });
  const ownerId = owner.user.id;
  const t2 = await call(`/projects/${pid}/tasks`, { jwt, method: 'POST', body: { title: 'soon', dueDate: new Date(Date.now() + 3 * 86400000).toISOString(), assigneeId: ownerId } });
  const t3 = (await call(`/projects/${pid}/tasks`, { jwt, method: 'POST', body: { title: 'done one' } })).json;
  await call(`/projects/${pid}/tasks/${t2.json.id}`, { jwt, method: 'PATCH', body: { status: 'IN_PROGRESS' } });
  await call(`/projects/${pid}/tasks/${t3.id}`, { jwt, method: 'PATCH', body: { status: 'DONE' } });
  check('task fixtures created', t1.status === 201 && t2.status === 201 && !!t3.id);
  const tr = (await call(`/projects/${pid}/reports/tasks`, { jwt })).json;
  check('tasks: status totals', tr.total === 3 && tr.byStatus.OPEN === 1 && tr.byStatus.IN_PROGRESS === 1 && tr.byStatus.DONE === 1, JSON.stringify(tr.byStatus));
  check('tasks: overdue and due-soon', tr.overdue === 1 && tr.dueSoon === 1, JSON.stringify({ o: tr.overdue, s: tr.dueSoon }));
  check('tasks: open work per assignee', tr.perAssignee.length === 2 && tr.perAssignee.every((a) => a.count === 1) && tr.perAssignee.some((a) => a.name === 'rp') && tr.perAssignee.some((a) => a.name === 'unassigned'), JSON.stringify(tr.perAssignee));

  const u = (await call(`/projects/${pid}/reports/usage`, { jwt })).json;
  check('usage: default window 30 days', u.days === 30 && u.totalEvents > 0 && u.activeKeys >= 5, JSON.stringify({ d: u.days, ev: u.totalEvents, keys: u.activeKeys }));
  check('usage: action breakdown sums to total', Object.values(u.byAction).reduce((x, y) => x + y, 0) === u.totalEvents && u.byAction['key.created'] === 6, JSON.stringify(u.byAction));
  check('usage: byDay covers today with all events', u.byDay.length === 1 && u.byDay[0].count === u.totalEvents, JSON.stringify(u.byDay));
  check('usage: top actor is the owner', u.topActors[0]?.name === 'rp' && u.topActors[0]?.count === u.totalEvents, JSON.stringify(u.topActors));
  check('usage: days clamped to 90', (await call(`/projects/${pid}/reports/usage?days=200`, { jwt })).json.days === 90);
  for(const value of ['abc','NaN','Infinity','1.5','1e2',' ','','9007199254740992'])check(`usage rejects malformed days ${JSON.stringify(value)}`,(await call(`/projects/${pid}/reports/usage?days=${encodeURIComponent(value)}`,{jwt})).status===400);
  check('usage zero and negative integers clamp to one day',(await call(`/projects/${pid}/reports/usage?days=0`,{jwt})).json.days===1&&(await call(`/projects/${pid}/reports/usage?days=-5`,{jwt})).json.days===1);
  const out2 = (await call('/auth/signup', { method: 'POST', body: { email: `rpu${Date.now()}@t.dev`, password: 'pass1234', displayName: 'out2' } })).json;
  check('usage: non-member rejected', [403, 404].includes((await call(`/projects/${pid}/reports/usage`, { jwt: out2.accessToken })).status));
  check('quality: non-member rejected', [403, 404].includes((await call(`/projects/${pid}/reports/quality`, { jwt: out2.accessToken })).status));
  check('tasks report: non-member rejected', [403, 404].includes((await call(`/projects/${pid}/reports/tasks`, { jwt: out2.accessToken })).status));

  const sameName=(await call('/auth/signup',{method:'POST',body:{email:`same${Date.now()}@t.dev`,password:'pass1234',displayName:'rp'}})).json;
  const namedUnassigned=(await call('/auth/signup',{method:'POST',body:{email:`unassigned${Date.now()}@t.dev`,password:'pass1234',displayName:'unassigned'}})).json;
  for(const person of [sameName,namedUnassigned]){await call(`/projects/${pid}/members`,{jwt,method:'POST',body:{email:person.user.email}});await call(`/projects/${pid}/tasks`,{jwt,method:'POST',body:{title:'identity bucket',assigneeId:person.user.id}});}
  const identities=(await call(`/projects/${pid}/reports/tasks`,{jwt})).json;
  check('task report groups same display names by distinct stable identity',identities.perAssignee.filter(a=>a.name==='rp').length===2&&identities.perAssignee.some(a=>a.assigneeId===ownerId&&a.count===1)&&identities.perAssignee.some(a=>a.assigneeId===sameName.user.id&&a.count===1));
  check('task report separates named unassigned person from null bucket',identities.perAssignee.filter(a=>a.name==='unassigned').length===2&&identities.perAssignee.some(a=>a.assigneeId===null&&a.count===1)&&identities.perAssignee.some(a=>a.assigneeId===namedUnassigned.user.id&&a.count===1));
  check('task report identity buckets reconcile with all open tasks',identities.perAssignee.length===4&&identities.perAssignee.reduce((n,a)=>n+a.count,0)===identities.byStatus.OPEN+identities.byStatus.IN_PROGRESS);

  const taskGroup=(await call(`/projects/${pid}/groups`,{jwt,method:'POST',body:{name:'rp',role:'MEMBER'}})).json;
  await call(`/projects/${pid}/tasks`,{jwt,method:'POST',body:{title:'group workload',assigneeGroupId:taskGroup.id}});
  const grouped=(await call(`/projects/${pid}/reports/tasks`,{jwt})).json;
  check('task report separates same-name group and users from truly unassigned',grouped.perAssignee.some(a=>a.kind==='group'&&a.assigneeGroupId===taskGroup.id&&a.assigneeId===null&&a.name==='rp'&&a.count===1)&&grouped.perAssignee.filter(a=>a.kind==='user'&&a.name==='rp').length===2&&grouped.perAssignee.some(a=>a.kind==='unassigned'&&a.assigneeId===null&&a.assigneeGroupId===null&&a.count===1));
  check('group workload counts once not expanded by group membership',grouped.perAssignee.length===5&&grouped.perAssignee.reduce((n,a)=>n+a.count,0)===grouped.byStatus.OPEN+grouped.byStatus.IN_PROGRESS);

  for(const person of [sameName,namedUnassigned])await call(`/projects/${pid}/keys`,{jwt:person.accessToken,method:'POST',body:{name:'actor-'+person.user.id}});
  const actors=(await call(`/projects/${pid}/reports/usage`,{jwt})).json.topActors;
  check('usage same-name actors retain distinct stable IDs and own counts',actors.filter(a=>a.name==='rp').length===2&&actors.some(a=>a.actorId===ownerId&&a.count>1)&&actors.some(a=>a.actorId===sameName.user.id&&a.count===1));
  check('usage top-actor ties use deterministic actor ID order',actors.filter(a=>a.count===1).map(a=>a.actorId).join(',')===[sameName.user.id,namedUnassigned.user.id].sort().join(','));

  const utcBoundary=new Date(Date.now()-2*86400000);utcBoundary.setUTCHours(0,30,0,0);
  const future=new Date(Date.now()+86400000);
  await prisma.activityEvent.createMany({data:[{projectId:pid,actorId:ownerId,action:'utc-boundary-fixture',keyName:'utc-only',createdAt:utcBoundary},{projectId:pid,actorId:ownerId,action:'future-fixture',keyName:'future-only',createdAt:future}]});
  const bounded=(await call(`/projects/${pid}/reports/usage`,{jwt})).json;
  check('usage future event excluded from all aggregates',!bounded.byAction['future-fixture']&&bounded.totalEvents===Object.values(bounded.byAction).reduce((a,b)=>a+b,0)&&bounded.byDay.reduce((a,b)=>a+b.count,0)===bounded.totalEvents&&bounded.activeKeys===u.activeKeys+3);
  check('usage days explicitly UTC under nonUTC database default',bounded.byDay.some(r=>r.day===utcBoundary.toISOString().slice(0,10)&&r.count===1)&&bounded.timezone==='UTC');
  check('usage one captured asOf bounds trailing window',new Date(bounded.asOf).getTime()-new Date(bounded.since).getTime()===30*86400000&&new Date(bounded.asOf)<future);

  const keysBefore=(await call(`/projects/${pid}/reports/usage`,{jwt})).json.activeKeys;
  const keyFixtures=[...Array.from({length:1500},(_,i)=>({projectId:pid,action:'distinct-count-fixture',keyName:'count-key-'+i})),{projectId:pid,action:'distinct-count-fixture',keyName:'count-key-0'},{projectId:pid,action:'distinct-count-fixture',keyName:null},{projectId:pid,action:'distinct-count-fixture',keyName:''},{projectId:pid,action:'distinct-count-fixture',keyName:'outside-old',createdAt:new Date(Date.now()-100*86400000)},{projectId:pid,action:'distinct-count-fixture',keyName:'outside-future',createdAt:future}];
  await prisma.activityEvent.createMany({data:keyFixtures});
  const keyCounts=(await call(`/projects/${pid}/reports/usage`,{jwt})).json;
  check('usage database distinct count includes empty name once excludes null duplicate and out-of-window names',keyCounts.activeKeys===keysBefore+1501);
  const otherProject=(await call('/projects',{jwt,method:'POST',body:{name:'Other count',slug:'other-count-'+Date.now(),baseLocale:'en',locales:['en']}})).json;
  await prisma.activityEvent.create({data:{projectId:otherProject.id,action:'distinct-count-fixture',keyName:'other-project-only'}});
  check('usage database distinct count remains project scoped',(await call(`/projects/${pid}/reports/usage`,{jwt})).json.activeKeys===keyCounts.activeKeys);

  const workloadBefore=(await call(`/projects/${pid}/reports/tasks`,{jwt})).json;
  await prisma.task.createMany({data:[...Array.from({length:1500},()=>({projectId:pid,title:'aggregated workload',assigneeId:ownerId})),{projectId:pid,title:'extra workload',assigneeId:ownerId},{projectId:pid,title:'done excluded',status:'DONE',assigneeId:ownerId},{projectId:otherProject.id,title:'other excluded',assigneeId:ownerId}]});
  const workload=(await call(`/projects/${pid}/reports/tasks`,{jwt})).json;
  check('task report aggregates large user workload without splitting user identity',workload.perAssignee.find(r=>r.assigneeId===ownerId)?.count===workloadBefore.perAssignee.find(r=>r.assigneeId===ownerId).count+1501&&workload.perAssignee.find(r=>r.assigneeId===ownerId)?.assigneeGroupId===null&&workload.perAssignee.find(r=>r.assigneeGroupId===taskGroup.id)?.count===1);
  check('task report aggregated workload excludes DONE and other project and reconciles open statuses',workload.perAssignee.length===workloadBefore.perAssignee.length&&workload.perAssignee.reduce((n,r)=>n+r.count,0)===workload.byStatus.OPEN+workload.byStatus.IN_PROGRESS&&workload.total===workloadBefore.total+1502);

  // Dedicated ranking project isolates the cutoff from earlier report fixtures.
  const rankingProject=(await call('/projects',{jwt,method:'POST',body:{name:'Ranking',slug:'ranking-'+Date.now(),baseLocale:'en',locales:['en']}})).json;
  await prisma.activityEvent.deleteMany({where:{projectId:rankingProject.id}});
  const rankingUsers=[];
  for(let i=0;i<7;i++)rankingUsers.push(await prisma.user.create({data:{email:`ranking-${i}-${Date.now()}@t.dev`,displayName:'same ranking name',passwordHash:'fixture-not-login'}}));
  const futureActor=await prisma.user.create({data:{email:`future-ranking-${Date.now()}@t.dev`,displayName:'future ranking actor',passwordHash:'fixture-not-login'}});
  await prisma.activityEvent.createMany({data:[...rankingUsers.flatMap(person=>Array.from({length:2},()=>({projectId:rankingProject.id,actorId:person.id,action:'ranking-tie',keyName:'ranking-shared'}))),...Array.from({length:8},()=>({projectId:rankingProject.id,actorId:null,action:'ranking-null',keyName:null})),...Array.from({length:9},()=>({projectId:rankingProject.id,actorId:futureActor.id,action:'ranking-future',keyName:'ranking-future',createdAt:future}))]});
  const ranking=(await call(`/projects/${rankingProject.id}/reports/usage`,{jwt})).json;
  const expectedTop=rankingUsers.map(p=>p.id).sort().slice(0,5);
  check('usage top-five cutoff deterministic among seven tied same-name actor IDs',ranking.topActors.length===5&&ranking.topActors.map(a=>a.actorId).join(',')===expectedTop.join(',')&&ranking.topActors.every(a=>a.name==='same ranking name'&&a.count===2));
  check('usage null-actor events remain in totals and days but not ranked actors',ranking.totalEvents===22&&ranking.byAction['ranking-null']===8&&ranking.byDay.reduce((n,d)=>n+d.count,0)===22&&ranking.topActors.every(a=>a.actorId!==null));
  check('usage future-only actor cannot displace real tied actors',!ranking.byAction['ranking-future']&&!ranking.topActors.some(a=>a.actorId===futureActor.id)&&ranking.activeKeys===1);
  const reranked=(await call(`/projects/${rankingProject.id}/reports/usage`,{jwt})).json;
  check('usage repeated read preserves tied top-five cutoff',reranked.topActors.map(a=>a.actorId).join(',')===expectedTop.join(','));

  // Progress retains removed workflow states only for filled values.
  await call(`/projects/${pid}`,{jwt,method:'PATCH',body:{customStatuses:[]}});
  const retired=(await call(`/projects/${pid}/reports/progress`,{jwt})).json;
  const retiredEn=retired.locales.find(l=>l.locale==='en');
  check('progress retains removed workflow status count for existing filled translation',retiredEn.byStatus.NEEDS_FIX===1&&retiredEn.translated===5&&retiredEn.translated===Object.values(retiredEn.byStatus).reduce((n,c)=>n+c,0));
  await call(`/projects/${pid}`,{jwt,method:'PATCH',body:{customStatuses:['NEEDS_FIX']}});
  await call(`/projects/${pid}/keys/${c.id}/translations/he/status`,{jwt,method:'PATCH',body:{status:'NEEDS_FIX'}});
  await call(`/projects/${pid}`,{jwt,method:'PATCH',body:{customStatuses:[]}});
  const emptyRetired=(await call(`/projects/${pid}/reports/progress`,{jwt})).json;
  const emptyHe=emptyRetired.locales.find(l=>l.locale==='he');
  check('progress excludes empty translation carrying retired status from filled and status totals',emptyHe.translated===3&&emptyHe.untranslated===4&&!emptyHe.byStatus.NEEDS_FIX&&emptyHe.total===7&&emptyHe.translated===Object.values(emptyHe.byStatus).reduce((n,c)=>n+c,0));
  await call(`/projects/${pid}/branches`,{jwt,method:'POST',body:{name:'empty-report'}});
  const emptyBranch=(await call(`/projects/${pid}/reports/progress?branch=empty-report`,{jwt})).json;
  check('progress empty branch has zero totals and finite zero percentages in every locale',emptyBranch.branch==='empty-report'&&emptyBranch.totalKeys===0&&emptyBranch.locales.length===2&&emptyBranch.locales.every(l=>l.total===0&&l.translated===0&&l.untranslated===0&&l.percent===0&&Object.values(l.byStatus).every(n=>n===0)));

  for(const route of ['progress','quality','usage','tasks']){
    const malformed=await call(`/projects/not-a-uuid/reports/${route}`,{jwt});
    check(`reports ${route} malformed project ID returns400 without database details`,malformed.status===400&&malformed.json?.statusCode===400&&!JSON.stringify(malformed.json).includes('Prisma'));
    check(`reports ${route} unknown valid UUID remains404`,(await call(`/projects/00000000-0000-4000-8000-000000000000/reports/${route}`,{jwt})).status===404);
    check(`reports ${route} unauthenticated malformed ID still401`,(await call(`/projects/not-a-uuid/reports/${route}`)).status===401);
  }

  const datesProject=(await call('/projects',{jwt,method:'POST',body:{name:'Task dates',slug:'task-dates-'+Date.now(),baseLocale:'en',locales:['en']}})).json;
  const pastDate=new Date(Date.now()-86400000),soonDate=new Date(Date.now()+3*86400000),laterDate=new Date(Date.now()+9*86400000);
  await prisma.task.createMany({data:[{projectId:datesProject.id,title:'past open',dueDate:pastDate},{projectId:datesProject.id,title:'soon in progress',status:'IN_PROGRESS',dueDate:soonDate},{projectId:datesProject.id,title:'later open',dueDate:laterDate},{projectId:datesProject.id,title:'no deadline'},{projectId:datesProject.id,title:'done past',status:'DONE',dueDate:pastDate},{projectId:datesProject.id,title:'done soon',status:'DONE',dueDate:soonDate}]});
  const dates=(await call(`/projects/${datesProject.id}/reports/tasks`,{jwt})).json;
  check('task single-statement summary preserves exact status and deadline exclusions',dates.total===6&&dates.byStatus.OPEN===3&&dates.byStatus.IN_PROGRESS===1&&dates.byStatus.DONE===2&&dates.overdue===1&&dates.dueSoon===1);
  check('task summary totals still reconcile separate assignment query in static fixture',dates.perAssignee.length===1&&dates.perAssignee[0].kind==='unassigned'&&dates.perAssignee[0].count===4);

  for(const route of ['progress','quality']){
    for(const suffix of ['branch=','branch=a&branch=b','branch='+encodeURIComponent('bad branch'),'branch='+('a'.repeat(41))]){
      const malformedBranch=await call(`/projects/${pid}/reports/${route}?${suffix}`,{jwt});
      check(`reports ${route} rejects malformed branch query ${suffix}`,malformedBranch.status===400&&!JSON.stringify(malformedBranch.json).includes('Prisma'));
    }
    check(`reports ${route} bracket query key is not interpreted as branch`,(await call(`/projects/${pid}/reports/${route}?branch%5Bx%5D=a`,{jwt})).json.branch==='main');
    check(`reports ${route} omitted branch resolves and reports main`,(await call(`/projects/${pid}/reports/${route}`,{jwt})).json.branch==='main');
    check(`reports ${route} unknown valid branch remains404`,(await call(`/projects/${pid}/reports/${route}?branch=valid-missing.1`,{jwt})).status===404);
  }

  // Access: member and read token can read; non-member and anonymous cannot.
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `rpm${Date.now()}@t.dev`, password: 'pass1234', displayName: 'rpm' } })).json;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email } });
  check('member can read progress', (await call(`/projects/${pid}/reports/progress`, { jwt: member.accessToken })).status === 200);
  const rtok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'sdk', scopes: ['read'] } })).json.token;
  check('read token can read progress', (await call(`/projects/${pid}/reports/progress`, { token: rtok })).status === 200);
  for(const route of ['progress','quality','usage','tasks']){
    const sessionReport=await call(`/projects/${pid}/reports/${route}`,{jwt:member.accessToken});
    check(`reports ${route} member session response explicitly no-store`,sessionReport.status===200&&sessionReport.cacheControl==='no-store');
    const tokenReport=await call(`/projects/${pid}/reports/${route}`,{token:rtok});
    check(`reports ${route} read token response explicitly no-store`,tokenReport.status===200&&tokenReport.cacheControl==='no-store');
  }

  const memberCredential=(await call('/auth/tokens',{jwt:member.accessToken,method:'POST',body:{name:'report-revocation',scopes:['read']}})).json;
  for(const route of ['progress','quality','usage','tasks'])check(`reports ${route} member-owned token initially authorized`,(await call(`/projects/${pid}/reports/${route}`,{token:memberCredential.token})).status===200);
  const removedReportMember=await call(`/projects/${pid}/members/${member.user.id}`,{jwt,method:'DELETE'});
  check('report member revocation committed',removedReportMember.status===200);
  for(const route of ['progress','quality','usage','tasks']){
    const deniedSession=await call(`/projects/${pid}/reports/${route}`,{jwt:member.accessToken});
    const deniedToken=await call(`/projects/${pid}/reports/${route}`,{token:memberCredential.token});
    check(`reports ${route} existing session and token lose revoked team access`,[403,404].includes(deniedSession.status)&&[403,404].includes(deniedToken.status)&&!('totalEvents' in (deniedSession.json??{}))&&!('perAssignee' in (deniedToken.json??{})));
  }
  await call(`/projects/${pid}/members`,{jwt,method:'POST',body:{email:member.user.email}});
  for(const route of ['progress','quality','usage','tasks'])check(`reports ${route} same session and token regain explicitly restored team access`,(await call(`/projects/${pid}/reports/${route}`,{jwt:member.accessToken})).status===200&&(await call(`/projects/${pid}/reports/${route}`,{token:memberCredential.token})).status===200);
  const revokedReportToken=await call(`/auth/tokens/${memberCredential.id}`,{jwt:member.accessToken,method:'DELETE'});
  check('report API token revocation committed',revokedReportToken.status===200||revokedReportToken.status===204);
  for(const route of ['progress','quality','usage','tasks'])check(`reports ${route} revoked token denied401 while session remains valid`,(await call(`/projects/${pid}/reports/${route}`,{token:memberCredential.token})).status===401&&(await call(`/projects/${pid}/reports/${route}`,{jwt:member.accessToken})).status===200);

  const out = (await call('/auth/signup', { method: 'POST', body: { email: `rpo${Date.now()}@t.dev`, password: 'pass1234', displayName: 'out' } })).json;
  check('non-member rejected', [403, 404].includes((await call(`/projects/${pid}/reports/progress`, { jwt: out.accessToken })).status));
  check('anonymous rejected (401)', (await fetch(`${API}/projects/${pid}/reports/progress`)).status === 401);
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  if (api) api.kill('SIGTERM');
  await prisma?.$disconnect();
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `reports: ${failures} FAILURES` : 'reports pass complete');
process.exit(failures ? 1 : 0);
