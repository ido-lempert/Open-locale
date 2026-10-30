// Granular permissions: real PostgreSQL + real HTTP API.
// Roles (OWNER/ADMIN/MEMBER) and per-locale contributor access.
// Run: node scripts/permissions-test.mjs
import { PrismaClient } from '@prisma/client';
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55478, API_PORT = 3044;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-sync-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api,prisma;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_sync');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_sync`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'perm-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  prisma=new PrismaClient({datasources:{db:{url}}});
  const signup = async name => (await call('/auth/signup', { method:'POST',body:{email:name+'@sync.dev',password:'pass1234',displayName:name} })).json;
  const owner=await signup('owner'), outsider=await signup('outsider'), member=await signup('member'), admin=await signup('admin');
  const jwt=owner.accessToken;
  const project=(await call('/projects',{jwt,method:'POST',body:{name:'Sync',slug:'sync',locales:['en','he']}})).json;
  const P=`/projects/${project.id}`;
  await call(`${P}/members`,{jwt,method:'POST',body:{email:member.user.email,role:'MEMBER',allowedLocales:['he']}});
  await call(`${P}/members`,{jwt,method:'POST',body:{email:admin.user.email,role:'ADMIN'}});
  await call(`${P}/import/en`,{jwt,method:'POST',body:{entries:{same:'v',local:'edited',remote:'old',conflict:'ours',removed:'v'}}});
  const input={branch:'main',locale:'en',baselineJson:JSON.stringify({same:'v',local:'old',remote:'old',conflict:'old',removed:'v'}),remoteJson:JSON.stringify({same:'v',local:'old',remote:'new',conflict:'theirs'}),remoteSha:'a'.repeat(40)};
  const preview=(overrides={},auth=jwt)=>call(`${P}/sync/preview`,{jwt:auth,method:'POST',body:{...input,...overrides}});
  const before=(await call(`${P}/export/en?flat=true`,{jwt})).json;
  const p=await preview();
  check('authenticated owner preview returns 201 and no-store',p.status===201,JSON.stringify(p));
  const headers=await fetch(`${API}${P}/sync/preview`,{method:'POST',headers:{Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:JSON.stringify(input)});
  check('preview HTTP response is no-store',headers.headers.get('cache-control')==='no-store');await headers.arrayBuffer();
  check('remote and baseline explicitly unverified, cannot apply',p.json.remoteVerified===false && p.json.baselineVerified===false && p.json.canApply===false && p.json.source==='caller-supplied-files');
  const decision=k=>p.json.decisions.find(d=>d.key===k);
  check('stored locale data supplies local side',decision('local').local==='edited' && decision('local').suggested==='push');
  check('remote-only edit suggests pull',decision('remote').suggested==='pull');
  check('conflict stays manual',decision('conflict').kind==='conflict' && decision('conflict').suggested==='manual');
  check('remote removal stays manual',decision('removed').remote===null && decision('removed').suggested==='manual');
  check('same snapshot yields stable scoped fingerprint',(await preview()).json.fingerprint===p.json.fingerprint);
  check('preview writes no translation values',JSON.stringify((await call(`${P}/export/en?flat=true`,{jwt})).json)===JSON.stringify(before));
  check('outsider denied before file validation',(await preview({remoteJson:'invalid'},outsider.accessToken)).status===404);
  check('member denied even for granted locale',(await preview({locale:'he'},member.accessToken)).status===403);
  check('admin allowed',(await preview({},admin.accessToken)).status===201);
  check('unauthenticated denied',(await call(`${P}/sync/preview`,{method:'POST',body:input})).status===401);
  const token=(await call('/auth/tokens',{jwt,method:'POST',body:{name:'sync',scopes:['read','write']}})).json;
  check('write API token cannot use session preview',(await call(`${P}/sync/preview`,{apiKey:token.token,method:'POST',body:input})).status===403);
  check('unknown project locale rejected',(await preview({locale:'zz'})).status===400);
  check('unknown project branch rejected',(await preview({branch:'missing'})).status===404);
  check('branch must be explicit',(await preview({branch:undefined})).status===400);
  check('baseline must be explicit',(await preview({baselineJson:undefined})).status===400);
  check('malformed remote rejected',(await preview({remoteJson:'{'})).status===400);
  check('duplicate raw JSON properties rejected',(await preview({remoteJson:'{"a":"x","a":"y"}'})).status===400);
  check('nested JSON rejected',(await preview({remoteJson:'{"a":{"b":"x"}}'})).status===400);
  check('invalid remote SHA rejected',(await preview({remoteSha:'wrong'})).status===400);
  check('oversized file rejected',(await preview({remoteJson:JSON.stringify({a:'x'.repeat(33000)})})).status===400);
  await call(`${P}/branches`,{jwt,method:'POST',body:{name:'feature'}});
  await call(`${P}/import/en?branch=feature`,{jwt,method:'POST',body:{entries:{local:'feature value'}}});
  const feature=await preview({branch:'feature'});
  check('branch preview reads named branch and binds identity',feature.status===201 && feature.json.branch==='feature' && feature.json.decisions.find(d=>d.key==='local').local==='feature value' && feature.json.fingerprint!==p.json.fingerprint);
  await call(`${P}/import/he`,{jwt,method:'POST',body:{entries:{local:'Hebrew'}}});
  const he=await preview({locale:'he'});
  check('locale preview reads only named locale',he.status===201 && he.json.decisions.find(d=>d.key==='local').local==='Hebrew' && he.json.fingerprint!==p.json.fingerprint);
  const localKey=(await call(`${P}/keys`,{jwt})).json.find(k=>k.name==='local');
  await call(`${P}/keys/${localKey.id}/translations`,{jwt,method:'PUT',body:{locale:'en',value:'temporary'}});
  await call(`${P}/keys/${localKey.id}/translations`,{jwt,method:'PUT',body:{locale:'en',value:'edited'}});
  check('edit then revert changes row-generation fingerprint',(await preview()).json.fingerprint!==p.json.fingerprint);
  const records=()=>call(`${P}/sync/preview-records`,{jwt});
  check('ordinary previews leave diagnostic history empty',(await records()).json.records.length===0);
  const recorded=await call(`${P}/sync/preview-records`,{jwt,method:'POST',body:{...input,summary:{total:999},fingerprint:'forged',actorId:member.user.id}});
  check('explicit recording recomputes summary and actor',recorded.status===201 && recorded.json.record.summary.total===5 && recorded.json.record.actorId===owner.user.id && recorded.json.record.fingerprint!=='forged' && recorded.json.canApply===false);
  const stored=await prisma.syncPreviewRecord.findUnique({where:{id:recorded.json.record.id}});
  check('record contains no translation values or raw files',!JSON.stringify(stored).includes('edited') && !('baselineJson' in stored) && !('remoteJson' in stored) && !('decisions' in stored));
  check('record listing returns saved summary',(await records()).json.records.some(r=>r.id===stored.id));
  check('member cannot list records',(await call(`${P}/sync/preview-records`,{jwt:member.accessToken})).status===403);
  check('outsider cannot list records',(await call(`${P}/sync/preview-records`,{jwt:outsider.accessToken})).status===404);
  check('API token cannot read record history',(await call(`${P}/sync/preview-records`,{apiKey:token.token})).status===403);
  const recordCount=await prisma.syncPreviewRecord.count();
  check('bad preview is never persisted',(await call(`${P}/sync/preview-records`,{jwt,method:'POST',body:{...input,remoteJson:'invalid'}})).status===400 && await prisma.syncPreviewRecord.count()===recordCount);
  check('member cannot persist record',(await call(`${P}/sync/preview-records`,{jwt:member.accessToken,method:'POST',body:input})).status===403);
  const another=(await call('/projects',{jwt,method:'POST',body:{name:'Other history',slug:'other-history',locales:['en']}})).json;
  check('history scoped to project',(await call(`/projects/${another.id}/sync/preview-records`,{jwt})).json.records.length===0);
  await prisma.syncPreviewRecord.createMany({data:Array.from({length:55},(_,i)=>({projectId:project.id,actorId:owner.user.id,branch:'main',locale:'en',fingerprint:'f'+i,remoteSha:'a'.repeat(40),summary:{total:0}}))});
  check('record listing bounded to latest fifty',(await records()).json.records.length===50);
  await prisma.syncPreviewRecord.createMany({data:Array.from({length:60},(_,i)=>({projectId:project.id,actorId:owner.user.id,branch:'main',locale:'en',fingerprint:'older'+i,remoteSha:'a'.repeat(40),summary:{total:0},createdAt:new Date('2020-01-01')}))});
  const trimmed=await call(`${P}/sync/preview-records`,{jwt,method:'POST',body:input});
  check('explicit recording trims oldest retained history to hundred',trimmed.status===201 && await prisma.syncPreviewRecord.count({where:{projectId:project.id}})===100 && !!await prisma.syncPreviewRecord.findUnique({where:{id:trimmed.json.record.id}}));

  const concurrent=await Promise.all(Array.from({length:4},()=>call(`${P}/sync/preview-records`,{jwt,method:'POST',body:input})));
  check('concurrent diagnostic records succeed without exceeding retention',concurrent.every(r=>r.status===201) && await prisma.syncPreviewRecord.count({where:{projectId:project.id}})<=100);
  const invalidId=await call('/projects/not-a-uuid/sync/preview',{jwt,method:'POST',body:input});
  check('invalid project id is a bounded client error',invalidId.status===400);
  const bounded=(await call('/projects',{jwt,method:'POST',body:{name:'Bounds',slug:'bounds',locales:['en']}})).json;
  const boundedBranch=await prisma.branch.findUnique({where:{projectId_name:{projectId:bounded.id,name:'main'}}});
  const huge=await prisma.key.create({data:{projectId:bounded.id,branchId:boundedBranch.id,name:'huge'}});
  await prisma.translation.create({data:{keyId:huge.id,projectId:bounded.id,localeCode:'en',value:'x'.repeat(512*1024+1)}});
  const boundedPreview=()=>call(`/projects/${bounded.id}/sync/preview`,{jwt,method:'POST',body:input});
  check('database byte budget rejects before materializing local values',(await boundedPreview()).status===400);
  await prisma.translation.delete({where:{keyId_localeCode:{keyId:huge.id,localeCode:'en'}}});
  await prisma.key.createMany({data:Array.from({length:10000},(_,i)=>({projectId:bounded.id,branchId:boundedBranch.id,name:'key'+i}))});
  check('database key budget rejects oversized branch',(await boundedPreview()).status===400);
  const key=(await call(`${P}/keys`,{jwt,method:'POST',body:{name:'plural',isPlural:true}})).json;
  check('plural setup succeeded',!!key.id && key.isPlural===true,JSON.stringify(key));
  check('flat-only preview rejects plural branch',(await preview()).status===400);
  await prisma.project.delete({where:{id:another.id}});
  const deleted=await prisma.project.create({data:{teamId:project.teamId,name:'Delete records',slug:'delete-records'}});
  await prisma.syncPreviewRecord.create({data:{projectId:deleted.id,actorId:owner.user.id,branch:'main',locale:'en',fingerprint:'x',remoteSha:'a'.repeat(40),summary:{}}});
  await prisma.project.delete({where:{id:deleted.id}});
  check('project deletion cascades diagnostic history',await prisma.syncPreviewRecord.count({where:{projectId:deleted.id}})===0);

} catch (err) { console.error('SUITE INCOMPLETE:',err);process.exitCode=1;failures++; }
finally {
 if(api) { const stopped=new Promise(resolve=>api.once('close',resolve));api.kill('SIGTERM');await stopped; }
 await prisma?.$disconnect();await pg.stop();rmSync(dataDir,{recursive:true,force:true});
}
console.log(failures ? `sync-preview: ${failures} FAILURES` : 'sync-preview pass complete');
process.exit(failures?1:0);
