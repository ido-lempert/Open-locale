import { createServer } from 'node:http';
import { createHash,createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const freshBundle=join(process.cwd(),'.tmp-fresh-execution.cjs');
execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-targets.controller.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+freshBundle]);
const {RepositoryTargetsService}=require(freshBundle);

const writerSource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/local-value-writer.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {writeExistingLocalValues}=await import('data:text/javascript;base64,'+Buffer.from(writerSource).toString('base64'));
const recoverySource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/deletion-recovery-plan.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {inspectDeletionRecovery}=await import('data:text/javascript;base64,'+Buffer.from(recoverySource).toString('base64'));
const recoveryLockSource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/deletion-recovery-lock.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {lockDeletionRecovery}=await import('data:text/javascript;base64,'+Buffer.from(recoveryLockSource).toString('base64'));
const recoveryWriterSource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/deletion-recovery-writer.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {writeDeletionRecovery}=await import('data:text/javascript;base64,'+Buffer.from(recoveryWriterSource).toString('base64'));
const transactionSource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-local-transaction.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {repositoryLocalTransaction}=await import('data:text/javascript;base64,'+Buffer.from(transactionSource).toString('base64'));
const leaseSource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-effect-lease.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {claimRepositoryEffect,settleRepositoryEffect}=await import('data:text/javascript;base64,'+Buffer.from(leaseSource).toString('base64'));
const eligibilitySource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-effect-eligibility.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {validateRepositoryEffect}=await import('data:text/javascript;base64,'+Buffer.from(eligibilitySource).toString('base64'));
const retentionSource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-effect-retention.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {pruneRepositoryEffects}=await import('data:text/javascript;base64,'+Buffer.from(retentionSource).toString('base64'));
const budgetSource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-effect-budget.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {assertRepositoryEffectBudget}=await import('data:text/javascript;base64,'+Buffer.from(budgetSource).toString('base64'));
const runnerSource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-effect-runner.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {runRepositoryEffect}=await import('data:text/javascript;base64,'+Buffer.from(runnerSource).toString('base64'));
const scopeSource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-write-scope.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {lockRepositoryWriteScope}=await import('data:text/javascript;base64,'+Buffer.from(scopeSource).toString('base64'));
const preconditionSource=execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/local-preconditions.ts','--bundle','--platform=node','--format=esm'],{encoding:'utf8'});
const {lockLocalPreconditions}=await import('data:text/javascript;base64,'+Buffer.from(preconditionSource).toString('base64'));
// Granular permissions: real PostgreSQL + real HTTP API.
// Roles (OWNER/ADMIN/MEMBER) and per-locale contributor access.
// Run: node scripts/permissions-test.mjs
import { Prisma, PrismaClient } from '@prisma/client';
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55482, API_PORT = 3044;
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
let api,prisma,repositoryFixture;
let repoCalls=0,repoText='{"fromRepo":"verified bytes"}',repoStatus=200,repoGate,releaseRepo,repoSeen,repoMethod,repoAuth;
repositoryFixture=createServer(async(req,res)=>{repoCalls++;repoMethod=req.method;repoAuth=req.headers.authorization;req.resume();if(repoSeen)repoSeen();if(repoGate)await repoGate;const bytes=Buffer.from(repoText);res.writeHead(repoStatus,{'content-type':'application/json'});res.end(JSON.stringify({type:'file',path:'updated/en.json',encoding:'base64',size:bytes.length,sha:createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),content:bytes.toString('base64')}));});
await new Promise(r=>repositoryFixture.listen(0,'127.0.0.1',r));
const repoOrigin=`http://127.0.0.1:${repositoryFixture.address().port}`;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_sync');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_sync`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'perm-secret', NODE_ENV:'test',GITHUB_READ_OWNER:'owner',GITHUB_READ_REPO:'repo',GITHUB_READ_TOKEN:'fixture-read-only-token',GITHUB_READ_FIXTURE_ORIGIN:repoOrigin, PORT: String(API_PORT) }, stdio: 'pipe' });
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

  const fresh=await preview();
  const choices={local:'local',remote:'remote',conflict:'base',removed:'remote'};
  const resolve=(overrides={},auth=jwt)=>call(`${P}/sync/resolve-preview`,{jwt:auth,method:'POST',body:{...input,expectedFingerprint:fresh.json.fingerprint,choices,...overrides}});
  const resolved=await resolve();
  check('explicit resolution returns draft JSON using each reviewed selection',resolved.status===201 && JSON.stringify(JSON.parse(resolved.json.json))===JSON.stringify({conflict:'old',local:'edited',remote:'new',same:'v'}),JSON.stringify(resolved));
  check('resolved draft never grants provenance or apply',resolved.json.canApply===false && resolved.json.baselineVerified===false && resolved.json.remoteVerified===false && resolved.json.source==='explicit-preview-resolution');
  check('draft reports explicit missing value selection without implicit import',resolved.json.absentKeys===1 && resolved.json.explicitChoices===4 && resolved.json.outputKeys===4);
  const rh=await fetch(`${API}${P}/sync/resolve-preview`,{method:'POST',headers:{Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:JSON.stringify({...input,expectedFingerprint:fresh.json.fingerprint,choices})});
  check('resolved draft HTTP response is no-store',rh.status===201 && rh.headers.get('cache-control')==='no-store');await rh.arrayBuffer();
  check('resolution does not write translations or diagnostic records',JSON.stringify((await call(`${P}/export/en?flat=true`,{jwt})).json)===JSON.stringify(before) && await prisma.syncPreviewRecord.count()===0);
  check('resolution rejects old row-generation fingerprint after edit and revert',(await resolve({expectedFingerprint:p.json.fingerprint})).status===409);
  check('resolution rejects changed remote bytes',(await resolve({remoteJson:'{}'})).status===409);
  check('resolution rejects other branch fingerprint',(await resolve({branch:'feature'})).status===409);
  check('resolution rejects other locale fingerprint',(await resolve({locale:'he'})).status===409);
  check('resolution rejects omitted selection',(await resolve({choices:{local:'local'}})).status===400);
  check('resolution rejects extra selection',(await resolve({choices:{...choices,same:'local'}})).status===400);
  check('resolution rejects invalid winner',(await resolve({choices:{...choices,conflict:'push'}})).status===400);
  check('resolution rejects array choices',(await resolve({choices:[]})).status===400);
  check('resolution rejects missing fingerprint',(await resolve({expectedFingerprint:undefined})).status===400);
  check('resolution ignores forged caller local JSON',(await resolve({localJson:'{"local":"forged"}'})).json.json===resolved.json.json);
  check('resolution requires session',(await call(`${P}/sync/resolve-preview`,{method:'POST',body:{...input,expectedFingerprint:fresh.json.fingerprint,choices}})).status===401);
  check('resolution denies contributor',(await resolve({},member.accessToken)).status===403);
  check('resolution denies outsider before parsing files',(await resolve({remoteJson:'invalid'},outsider.accessToken)).status===404);
  check('resolution denies write API token',(await call(`${P}/sync/resolve-preview`,{apiKey:token.token,method:'POST',body:{...input,expectedFingerprint:fresh.json.fingerprint,choices}})).status===403);
  check('admin may resolve reviewed draft',(await resolve({},admin.accessToken)).status===201);
  const records=()=>call(`${P}/sync/preview-records`,{jwt});
  check('ordinary previews leave diagnostic history empty',(await records()).json.records.length===0);

  // Repository target configuration is metadata only, no external connection.
  const T=`${P}/sync/repository-targets`;
  const coordinates={localBranch:'main',locale:'en',owner:'owner',repo:'repo',path:'locales/en.json',remoteBranch:'feature/test'};
  const tc=(path=T,method='POST',body=coordinates,auth=jwt)=>call(path,{jwt:auth,method,body:method==='GET'?undefined:body});
  const createdTarget=await tc();const target=createdTarget.json.target;
  check('repository target coordinates stored with revision one and no connection claim',createdTarget.status===201&&target.revision===1&&createdTarget.json.connected===false&&createdTarget.json.baselineAccepted===false&&createdTarget.json.canApply===false,JSON.stringify(createdTarget));
  const targetHeaders=await fetch(`${API}${T}`,{headers:{Authorization:`Bearer ${jwt}`}});
  check('repository target listing is no-store',targetHeaders.status===200&&targetHeaders.headers.get('cache-control')==='no-store');await targetHeaders.arrayBuffer();
  check('repository target lists stored coordinates',(await tc(T,'GET',undefined)).json.targets.some(t=>t.id===target.id&&t.remoteBranch==='feature/test'));
  check('duplicate local branch locale target conflicts',(await tc()).status===409);
  check('target metadata ignores forged secret and connected claims',(await tc(T,'POST',{...coordinates,locale:'he',token:'secret-fixture-only',connected:true,revision:999})).json.target.revision===1&&!JSON.stringify(await prisma.repositorySyncTarget.findMany()).includes('secret-fixture-only'));
  const summaryPath=`${T}/${target.id}/effects-summary`;
  const emptySummary=await tc(summaryPath,'GET',undefined);
  check('effect summary starts empty without delivery or sync claim',emptySummary.status===200&&JSON.stringify(emptySummary.json.counts)===JSON.stringify({pending:0,leased:0,completed:0,dead:0})&&JSON.stringify(emptySummary.json.channelCheckpoints)===JSON.stringify({webhook:0,automation:0,both:0})&&emptySummary.json.expiredLeases===0&&emptySummary.json.oldestPendingAt===null&&emptySummary.json.deliveryConfirmed===false&&emptySummary.json.syncAccepted===false);
  check('effect summary requires session',(await call(summaryPath)).status===401);
  check('effect summary denies contributor',(await tc(summaryPath,'GET',undefined,member.accessToken)).status===403);
  check('effect summary denies outsider',(await tc(summaryPath,'GET',undefined,outsider.accessToken)).status===404);
  check('effect summary denies API token',(await call(summaryPath,{apiKey:token.token})).status===403);
  check('effect summary permits project admin',(await tc(summaryPath,'GET',undefined,admin.accessToken)).status===200);
  check('effect summary unknown target denied',(await tc(`${T}/${owner.user.id}/effects-summary`,'GET',undefined)).status===404);
  check('effect summary rejects malformed target id',(await tc(`${T}/bad-id/effects-summary`,'GET',undefined)).status===400);
  const summaryHeaders=await fetch(`${API}${summaryPath}`,{headers:{Authorization:`Bearer ${jwt}`}});
  check('effect summary no-store',summaryHeaders.status===200&&summaryHeaders.headers.get('cache-control')==='no-store');await summaryHeaders.arrayBuffer();
  const summaryBranch=await prisma.branch.findUnique({where:{projectId_name:{projectId:project.id,name:'main'}}});
  const summaryData={projectId:project.id,targetId:target.id,actorId:owner.user.id,keyId:owner.user.id,keyName:'secret-summary-key',branchId:summaryBranch.id,branch:'main',locale:'en',operation:'set-value',value:'private-summary-value',draftContentDigest:'digest',previewFingerprint:'fingerprint'};
  const summaryOtherProject=(await call('/projects',{jwt,method:'POST',body:{name:'SummaryOther',slug:'summary-other',locales:['en']}})).json;
  const summaryRows=await Promise.all([
    prisma.repositoryLocalEffectIntent.create({data:{...summaryData,createdAt:new Date('2020-01-01'),webhookHandledAt:new Date()}}),
    prisma.repositoryLocalEffectIntent.create({data:{...summaryData,state:'leased',leaseToken:owner.user.id,leaseUntil:new Date('2020-01-01'),attempts:1}}),
    prisma.repositoryLocalEffectIntent.create({data:{...summaryData,state:'leased',leaseToken:owner.user.id,leaseUntil:new Date('2099-01-01'),attempts:1}}),
    prisma.repositoryLocalEffectIntent.create({data:{...summaryData,state:'completed',finishedAt:new Date(),webhookHandledAt:new Date(),automationHandledAt:new Date()}}),
    prisma.repositoryLocalEffectIntent.create({data:{...summaryData,state:'dead',finishedAt:new Date(),attempts:3,automationHandledAt:new Date()}}),
    prisma.repositoryLocalEffectIntent.create({data:{...summaryData,targetId:owner.user.id}}),
    prisma.repositoryLocalEffectIntent.create({data:{...summaryData,projectId:summaryOtherProject.id}}),
  ]);
  const summaryBefore=JSON.stringify(await prisma.repositoryLocalEffectIntent.findMany({orderBy:{id:'asc'}}));
  const mixedSummary=(await tc(summaryPath,'GET',undefined)).json;
  check('effect summary reports exact states expired leases and oldest pending',JSON.stringify(mixedSummary.counts)===JSON.stringify({pending:1,leased:2,completed:1,dead:1})&&mixedSummary.expiredLeases===1&&mixedSummary.oldestPendingAt==='2020-01-01T00:00:00.000Z'&&Number.isFinite(Date.parse(mixedSummary.asOf)));
  check('effect summary counts independent and combined channel checkpoints',JSON.stringify(mixedSummary.channelCheckpoints)===JSON.stringify({webhook:2,automation:2,both:1}));
  check('effect summary does not disclose payloads identities lease tokens or rows',Object.keys(mixedSummary).sort().join(',')==='asOf,channelCheckpoints,counts,deliveryConfirmed,expiredLeases,oldestPendingAt,source,syncAccepted,targetId'&&!JSON.stringify(mixedSummary).includes('private-summary')&&!JSON.stringify(mixedSummary).includes(owner.user.id));
  check('effect summary does not mutate queue',summaryBefore===JSON.stringify(await prisma.repositoryLocalEffectIntent.findMany({orderBy:{id:'asc'}})));
  const updatedTarget=await tc(`${T}/${target.id}`,'PUT',{...coordinates,path:'updated/en.json',expectedRevision:1});
  check('target replacement increments revision',updatedTarget.status===200&&updatedTarget.json.target.path==='updated/en.json'&&updatedTarget.json.target.revision===2);
  check('effect summary includes prior coordinate revision bookkeeping',JSON.stringify((await tc(summaryPath,'GET',undefined)).json.counts)===JSON.stringify(mixedSummary.counts));
  await prisma.repositoryLocalEffectIntent.deleteMany({where:{id:{in:summaryRows.map(r=>r.id)}}});

  const readTarget=(overrides={},auth=jwt)=>tc(`${T}/${target.id}/read`,'POST',{expectedRevision:2,...overrides},auth);
  const readResult=await readTarget();
  check('configured repository read returns verified exact flat JSON only',readResult.status===201&&readResult.json.json===repoText&&readResult.json.remoteVerified===true&&readResult.json.baselineAccepted===false&&readResult.json.canApply===false,JSON.stringify(readResult));
  check('repository read uses deployment credential with GET only',repoCalls===1&&repoMethod==='GET'&&repoAuth==='Bearer fixture-read-only-token');
  check('repository read is not accepted baseline or persisted file data',await prisma.syncPreviewRecord.count()===0&&!(JSON.stringify(await prisma.repositorySyncTarget.findUnique({where:{id:target.id}}))).includes('verified bytes'));
  const readHeaders=await fetch(`${API}${T}/${target.id}/read`,{method:'POST',headers:{Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:2})});
  check('verified repository bytes are no-store',readHeaders.status===201&&readHeaders.headers.get('cache-control')==='no-store');await readHeaders.arrayBuffer();

  const baselinePath=`${T}/${target.id}/baseline`;
  const acceptInput={expectedRevision:2,expectedRemoteSha:readResult.json.remoteSha,expectedContentDigest:readResult.json.contentDigest,expectedBaselineVersion:0};
  const accept=(overrides={},auth=jwt)=>tc(baselinePath,'POST',{...acceptInput,...overrides},auth);
  const repositoryPreview=(overrides={},auth=jwt)=>tc(`${T}/${target.id}/preview`,'POST',{expectedRevision:2,...overrides},auth);
  const countBeforeUnacceptedPreview=repoCalls;
  check('repository preview requires accepted baseline before remote I/O',(await repositoryPreview()).status===409&&repoCalls===countBeforeUnacceptedPreview);
  check('repository resolution without accepted baseline fails before remote I/O',(await tc(`${T}/${target.id}/resolve-preview`,'POST',{expectedRevision:2,expectedFingerprint:'a'.repeat(64),choices:{}})).status===409&&repoCalls===countBeforeUnacceptedPreview);
  check('target begins without accepted baseline',(await tc(baselinePath,'GET',undefined)).json.baseline===null);
  const accepted=await accept();
  check('explicit acceptance stores verified bytes actor and version',accepted.status===201&&accepted.json.baseline.version===1&&accepted.json.baseline.text===repoText&&accepted.json.baseline.actorId===owner.user.id&&accepted.json.baselineAccepted===true&&accepted.json.canApply===false,JSON.stringify(accepted));
  check('accepted baseline read returns stored bytes without another remote request',(await tc(baselinePath,'GET',undefined)).json.baseline.contentDigest===readResult.json.contentDigest);
  check('baseline acceptance never writes translations or diagnostic history',JSON.stringify((await call(`${P}/export/en?flat=true`,{jwt})).json)===JSON.stringify(before)&&await prisma.syncPreviewRecord.count()===0);
  check('stale baseline version rejected without overwrite',(await accept()).status===409&&(await prisma.repositorySyncBaseline.findUnique({where:{targetId:target.id}})).version===1);
  repoText='{"fromRepo":"new unreviewed value"}';
  check('remote change since review cannot be accepted',(await accept({expectedBaselineVersion:1})).status===409&&(await prisma.repositorySyncBaseline.findUnique({where:{targetId:target.id}})).text==='{"fromRepo":"verified bytes"}');repoText='{"fromRepo":"verified bytes"}';
  check('forged digest cannot accept remote bytes',(await accept({expectedBaselineVersion:1,expectedContentDigest:'a'.repeat(64)})).status===409);
  const accepts=await Promise.all([accept({expectedBaselineVersion:1}),accept({expectedBaselineVersion:1})]);
  check('concurrent baseline acceptance has one version winner',accepts.filter(r=>r.status===201).length===1&&accepts.filter(r=>r.status===409).length===1&&(await prisma.repositorySyncBaseline.findUnique({where:{targetId:target.id}})).version===2);
  const baselineHeaders=await fetch(`${API}${baselinePath}`,{headers:{Authorization:`Bearer ${jwt}`}});check('accepted baseline response is no-store',baselineHeaders.status===200&&baselineHeaders.headers.get('cache-control')==='no-store');await baselineHeaders.arrayBuffer();
  const callsBeforeBaselineDeny=repoCalls;
  check('baseline member and outsider denied before remote reads',(await accept({expectedBaselineVersion:2},member.accessToken)).status===403&&(await accept({expectedBaselineVersion:2},outsider.accessToken)).status===404&&repoCalls===callsBeforeBaselineDeny);
  check('baseline API token cannot read stored bytes',(await call(baselinePath,{apiKey:token.token})).status===403);
  check('baseline rejects missing expected snapshot fields',(await tc(baselinePath,'POST',{expectedRevision:2})).status===400);
  repoGate=new Promise(r=>releaseRepo=r);const baselineRequested=new Promise(r=>repoSeen=r);const heldAcceptance=accept({expectedBaselineVersion:2});await baselineRequested;
  await prisma.repositorySyncTarget.update({where:{id:target.id},data:{revision:3}});releaseRepo();
  check('target change during acceptance stores no new baseline',(await heldAcceptance).status===409&&(await prisma.repositorySyncBaseline.findUnique({where:{targetId:target.id}})).version===2);repoGate=undefined;repoSeen=undefined;
  await prisma.repositorySyncTarget.update({where:{id:target.id},data:{revision:2}});
  repoGate=new Promise(r=>releaseRepo=r);const baselineAdminRequested=new Promise(r=>repoSeen=r);const heldAdminAcceptance=accept({expectedBaselineVersion:2},admin.accessToken);await baselineAdminRequested;
  await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'MEMBER'}});releaseRepo();
  check('lost admin during baseline acceptance stores nothing',(await heldAdminAcceptance).status===403&&(await prisma.repositorySyncBaseline.findUnique({where:{targetId:target.id}})).version===2);repoGate=undefined;repoSeen=undefined;
  await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'ADMIN'}});

  const repositoryPlan=await repositoryPreview();
  check('repository preview combines accepted verified base local DB and fresh remote',repositoryPlan.status===201&&repositoryPlan.json.source==='accepted-baseline-repository-preview'&&repositoryPlan.json.baselineVerified===true&&repositoryPlan.json.remoteVerified===true&&repositoryPlan.json.canApply===false&&repositoryPlan.json.baselineVersion===2&&repositoryPlan.json.decisions.find(d=>d.key==='local').local==='edited',JSON.stringify(repositoryPlan));
  check('repository preview ignores forged caller file values',(await repositoryPreview({baselineJson:'{}',remoteJson:'{}',localJson:'{}'})).json.fingerprint===repositoryPlan.json.fingerprint);
  repoText='{"fromRepo":"changed remote"}';const changedRepoPlan=await repositoryPreview();
  check('fresh repository changes alter scoped preview fingerprint',changedRepoPlan.status===201&&changedRepoPlan.json.fingerprint!==repositoryPlan.json.fingerprint&&changedRepoPlan.json.decisions.find(d=>d.key==='fromRepo').remote==='changed remote');repoText='{"fromRepo":"verified bytes"}';
  check('repository preview never advances baseline',(await tc(baselinePath,'GET',undefined)).json.baseline.version===2&&(await tc(baselinePath,'GET',undefined)).json.baseline.text===repoText);
  check('repository preview writes no translation or diagnostic history',await prisma.syncPreviewRecord.count()===0&&JSON.stringify((await call(`${P}/export/en?flat=true`,{jwt})).json)===JSON.stringify(before));
  const repoPreviewHeaders=await fetch(`${API}${T}/${target.id}/preview`,{method:'POST',headers:{Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:2})});check('repository preview is no-store',repoPreviewHeaders.status===201&&repoPreviewHeaders.headers.get('cache-control')==='no-store');await repoPreviewHeaders.arrayBuffer();
  await prisma.translation.update({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}},data:{version:{increment:1}}});
  check('repository fingerprint binds local row generation even with identical text',(await repositoryPreview()).json.fingerprint!==repositoryPlan.json.fingerprint);
  const deniedRepoPreviewCalls=repoCalls;
  check('repository preview member outsider stale revision denied before remote',(await repositoryPreview({},member.accessToken)).status===403&&(await repositoryPreview({},outsider.accessToken)).status===404&&(await repositoryPreview({expectedRevision:1})).status===409&&repoCalls===deniedRepoPreviewCalls);
  check('repository preview API token denied',(await call(`${T}/${target.id}/preview`,{apiKey:token.token,method:'POST',body:{expectedRevision:2}})).status===403&&repoCalls===deniedRepoPreviewCalls);
  repoGate=new Promise(r=>releaseRepo=r);const previewRequested=new Promise(r=>repoSeen=r);const heldPreview=repositoryPreview();await previewRequested;
  await prisma.repositorySyncBaseline.update({where:{targetId:target.id},data:{version:3}});releaseRepo();
  check('baseline change during repository read suppresses stale preview',(await heldPreview).status===409);repoGate=undefined;repoSeen=undefined;await prisma.repositorySyncBaseline.update({where:{targetId:target.id},data:{version:2}});
  const resolveRepository=(overrides={},auth=jwt)=>tc(`${T}/${target.id}/resolve-preview`,'POST',{expectedRevision:2,expectedFingerprint:resolvedRepositoryPlan.json.fingerprint,choices:repositoryChoices,...overrides},auth);
  const resolvedRepositoryPlan=await repositoryPreview();
  const repositoryChoices=Object.fromEntries(resolvedRepositoryPlan.json.decisions.filter(d=>!['unchanged','converged'].includes(d.kind)).map(d=>[d.key,d.key==='fromRepo'?'remote':'local']));
  const repositoryDraft=await resolveRepository();
  check('repository resolution returns exact explicit selected draft and digest',repositoryDraft.status===201&&repositoryDraft.json.json===JSON.stringify(Object.fromEntries(Object.entries({...before,fromRepo:'verified bytes'}).sort(([a],[b])=>a.localeCompare(b))),null,2)+'\n'&&repositoryDraft.json.contentDigest===createHash('sha256').update(repositoryDraft.json.json).digest('hex'),JSON.stringify(repositoryDraft));
  check('repository draft materializes exact local changes without execution',repositoryDraft.json.localChangePlan?.changes.length===1&&repositoryDraft.json.localChangePlan.changes[0].key==='fromRepo'&&repositoryDraft.json.localChangePlan.changes[0].expectedValue===null&&repositoryDraft.json.localChangePlan.changes[0].nextValue==='verified bytes'&&repositoryDraft.json.localChangePlan.changes[0].action==='set-value'&&repositoryDraft.json.localChangePlan.previewFingerprint===repositoryDraft.json.previewFingerprint&&repositoryDraft.json.localChangePlan.draftContentDigest===repositoryDraft.json.contentDigest&&repositoryDraft.json.localChangePlan.canApply===false);
  const removeLocalDraft=await resolveRepository({choices:{...repositoryChoices,local:'remote'}});
  check('explicit absent selection materializes locale value removal not key deletion',removeLocalDraft.status===201&&removeLocalDraft.json.localChangePlan.changes.some(c=>c.key==='local'&&c.action==='remove-locale-value'&&c.expectedValue==='edited'&&c.nextValue===null)&&removeLocalDraft.json.localChangePlan.deletesKeys===false&&removeLocalDraft.json.localChangePlan.touchesOtherLocales===false);
  const noopRepositoryDraft=await resolveRepository({choices:{...repositoryChoices,fromRepo:'local'}});
  check('draft matching local values materializes no local changes',noopRepositoryDraft.status===201&&noopRepositoryDraft.json.localChangePlan.changes.length===0&&noopRepositoryDraft.json.localChangePlan.unchangedValues===resolvedRepositoryPlan.json.decisions.length);
  const preconditions=repositoryDraft.json.localChangePlan.preconditions;
  const storedLocalKey=await prisma.key.findUnique({where:{id:localKey.id},include:{translations:{where:{localeCode:'en'}}}});
  check('local plan preconditions bind actual branch key identities and row generations',preconditions.projectId===project.id&&preconditions.branchId===storedLocalKey.branchId&&preconditions.locale==='en'&&preconditions.requiresExactKeySet===true&&preconditions.canApply===false&&preconditions.keys.find(k=>k.key==='local').keyId===localKey.id&&preconditions.keys.find(k=>k.key==='local').translation.rowId===storedLocalKey.translations[0].rowId&&preconditions.keys.find(k=>k.key==='local').translation.version===storedLocalKey.translations[0].version&&preconditions.keys.find(k=>k.key==='local').translation.value==='edited');
  check('remote-only key has no invented database key precondition',!preconditions.keys.some(k=>k.key==='fromRepo')&&repositoryDraft.json.localChangePlan.changes.some(c=>c.key==='fromRepo'));
  const noValueKey=await prisma.key.create({data:{projectId:project.id,branchId:storedLocalKey.branchId,name:'without-value'}});
  const noValuePreview=await repositoryPreview();const noValueChoices=Object.fromEntries(noValuePreview.json.decisions.filter(d=>!['unchanged','converged'].includes(d.kind)).map(d=>[d.key,'local']));
  const noValueDraft=await resolveRepository({expectedFingerprint:noValuePreview.json.fingerprint,choices:noValueChoices});
  check('key without translation has explicit absent-row precondition',noValueDraft.status===201&&noValueDraft.json.localChangePlan.preconditions.keys.find(k=>k.keyId===noValueKey.id)?.translation===null);
  await prisma.key.delete({where:{id:noValueKey.id}});
  await prisma.key.update({where:{id:localKey.id},data:{maxLength:7}});
  check('key metadata change invalidates reviewed draft even if text unchanged',(await resolveRepository()).status===409);
  await prisma.key.update({where:{id:localKey.id},data:{maxLength:storedLocalKey.maxLength}});
  resolvedRepositoryPlan.json=(await repositoryPreview()).json;
  const validateLocal=expected=>prisma.$transaction(tx=>lockLocalPreconditions(tx,expected),{isolationLevel:'Serializable'});
  const currentLocalPlan=(await resolveRepository()).json.localChangePlan;
  check('internal serializable validator locks and validates real snapshot', (await validateLocal(currentLocalPlan.preconditions)).validatedKeys===currentLocalPlan.preconditions.keys.length);
  let wrongIsolation=false;try{await prisma.$transaction(tx=>lockLocalPreconditions(tx,currentLocalPlan.preconditions));}catch(e){wrongIsolation=e.message.includes('serializable');}
  check('local validator refuses non-serializable transaction',wrongIsolation);
  const rejectsLocal=async(expected)=>{try{await validateLocal(expected);return false;}catch{return true;}};
  check('local validator rejects wrong scope and missing key set',await rejectsLocal({...currentLocalPlan.preconditions,locale:'missing'})&&await rejectsLocal({...currentLocalPlan.preconditions,branchId:crypto.randomUUID()})&&await rejectsLocal({...currentLocalPlan.preconditions,keys:[]}));
  await prisma.translation.update({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}},data:{version:{increment:1}}});
  check('local validator rejects status-only row generation change',await rejectsLocal(currentLocalPlan.preconditions));
  let livePlan=(await repositoryPreview()).json.localPreconditions;
  const oldRow=await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}});
  await prisma.translation.delete({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}});await prisma.translation.create({data:{keyId:oldRow.keyId,projectId:oldRow.projectId,localeCode:oldRow.localeCode,value:oldRow.value,version:oldRow.version}});
  check('local validator rejects deleted recreated ABA row identity',await rejectsLocal(livePlan));
  livePlan=(await repositoryPreview()).json.localPreconditions;const addedKey=await prisma.key.create({data:{projectId:project.id,branchId:storedLocalKey.branchId,name:'added-after-plan'}});
  check('local validator rejects added key even without locale value',await rejectsLocal(livePlan));await prisma.key.delete({where:{id:addedKey.id}});
  livePlan=(await repositoryPreview()).json.localPreconditions;await prisma.key.update({where:{id:localKey.id},data:{maxLength:13}});
  check('local validator rejects changed key metadata',await rejectsLocal(livePlan));await prisma.key.update({where:{id:localKey.id},data:{maxLength:storedLocalKey.maxLength}});
  const missingRowKey=await prisma.key.create({data:{projectId:project.id,branchId:storedLocalKey.branchId,name:'absent-row-check'}});livePlan=(await repositoryPreview()).json.localPreconditions;
  await prisma.translation.create({data:{keyId:missingRowKey.id,projectId:project.id,localeCode:'en',value:'concurrent create'}});
  check('local validator rejects newly created formerly absent locale row',await rejectsLocal(livePlan));await prisma.key.delete({where:{id:missingRowKey.id}});
  livePlan=(await repositoryPreview()).json.localPreconditions;
  let lockedRelease,lockedReached;const lockedGate=new Promise(r=>lockedRelease=r),lockedReady=new Promise(r=>lockedReached=r);
  const locking=prisma.$transaction(async tx=>{await lockLocalPreconditions(tx,livePlan);lockedReached();await lockedGate;},{isolationLevel:'Serializable',timeout:10000});await lockedReady;
  let writerDone=false;const blockedWriter=prisma.translation.update({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}},data:{version:{increment:1}}}).then(()=>writerDone=true);await new Promise(r=>setTimeout(r,100));
  check('validated existing translation row blocks concurrent writer until transaction ends',!writerDone);lockedRelease();await locking;await blockedWriter;
  check('blocked writer completes after validator transaction releases locks',writerDone);
  const rollbackVersion=(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).version;
  try{await prisma.$transaction(async tx=>{await tx.translation.update({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}},data:{value:'must rollback'}});await lockLocalPreconditions(tx,{...livePlan,locale:'missing'});},{isolationLevel:'Serializable'});}catch{}
  check('failed validation rolls back transaction writes atomically',(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='edited'&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).version===rollbackVersion);

  const scopeBaseline=await prisma.repositorySyncBaseline.findUnique({where:{targetId:target.id}});
  const writeScope={actorId:owner.user.id,projectId:project.id,targetId:target.id,targetRevision:2,branchId:storedLocalKey.branchId,branch:'main',locale:'en',baselineVersion:scopeBaseline.version,baselineSha:scopeBaseline.remoteSha,baselineDigest:scopeBaseline.contentDigest};
  const validateWriteScope=scope=>prisma.$transaction(tx=>lockRepositoryWriteScope(tx,scope),{isolationLevel:'Serializable'});
  const deniedScope=async scope=>{try{await validateWriteScope(scope);return false;}catch{return true;}};
  check('repository transaction guard validates actual owner and accepted target scope',(await validateWriteScope(writeScope)).adminValidated===true&&(await validateWriteScope(writeScope)).canApply===false);
  check('repository transaction guard denies member outsider and mismatched scope',await deniedScope({...writeScope,actorId:member.user.id})&&await deniedScope({...writeScope,actorId:outsider.user.id})&&await deniedScope({...writeScope,targetRevision:1})&&await deniedScope({...writeScope,branch:'other'})&&await deniedScope({...writeScope,locale:'he'})&&await deniedScope({...writeScope,projectId:crypto.randomUUID()}));
  check('repository guard rejects baseline version SHA and digest mismatches',await deniedScope({...writeScope,baselineVersion:999})&&await deniedScope({...writeScope,baselineSha:'f'.repeat(40)})&&await deniedScope({...writeScope,baselineDigest:'f'.repeat(64)}));
  await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'MEMBER'}});
  check('repository guard denies formerly authorized admin at commit boundary',await deniedScope({...writeScope,actorId:admin.user.id}));await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'ADMIN'}});
  let scopeIsolationDenied=false;try{await prisma.$transaction(tx=>lockRepositoryWriteScope(tx,writeScope));}catch(e){scopeIsolationDenied=e.message.includes('serializable');}
  check('repository guard rejects non-serializable caller',scopeIsolationDenied);
  let scopeRelease,scopeReached;const scopeGate=new Promise(r=>scopeRelease=r),scopeReady=new Promise(r=>scopeReached=r);
  const heldScope=prisma.$transaction(async tx=>{await lockRepositoryWriteScope(tx,{...writeScope,actorId:admin.user.id});scopeReached();await scopeGate;},{isolationLevel:'Serializable',timeout:10000});await scopeReady;
  let roleWriteDone=false;const roleWriter=prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'MEMBER'}}).then(()=>roleWriteDone=true);await new Promise(r=>setTimeout(r,100));
  check('validated admin membership blocks concurrent revocation through transaction',!roleWriteDone);scopeRelease();await heldScope;await roleWriter;
  check('revocation completes after guard releases and next guard denies',roleWriteDone&&await deniedScope({...writeScope,actorId:admin.user.id}));await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'ADMIN'}});
  let baselineRelease,baselineReached;const baselineLockGate=new Promise(r=>baselineRelease=r),baselineLockReady=new Promise(r=>baselineReached=r);
  const heldBaselineScope=prisma.$transaction(async tx=>{await lockRepositoryWriteScope(tx,writeScope);baselineReached();await baselineLockGate;},{isolationLevel:'Serializable',timeout:10000});await baselineLockReady;
  let baselineWriteDone=false;const baselineWriter=prisma.repositorySyncBaseline.update({where:{targetId:target.id},data:{version:{increment:1}}}).then(()=>baselineWriteDone=true);await new Promise(r=>setTimeout(r,100));
  check('guard holds accepted baseline row through transaction',!baselineWriteDone);baselineRelease();await heldBaselineScope;await baselineWriter;
  check('baseline replacement completes after release and stale scope denied',baselineWriteDone&&await deniedScope(writeScope));await prisma.repositorySyncBaseline.update({where:{targetId:target.id},data:{version:scopeBaseline.version}});
  const composeLocal=(await repositoryPreview()).json.localPreconditions;
  const composeValues=Object.fromEntries(composeLocal.keys.filter(k=>k.translation).map(k=>[k.key,k.translation.value]));
  const composeJson=JSON.stringify({...composeValues,local:'composed value'},null,2)+'\n';
  const composeDigest=createHash('sha256').update(composeJson).digest('hex');
  const composeFingerprint=(await repositoryPreview()).json.fingerprint;
  const reviewedCompose={scope:writeScope,local:composeLocal,json:composeJson,contentDigest:composeDigest,previewFingerprint:composeFingerprint};
  const compose=reviewed=>prisma.$transaction(tx=>repositoryLocalTransaction(tx,reviewed,composeDigest,composeFingerprint),{isolationLevel:'Serializable'});
  const rejectCompose=async reviewed=>{try{await compose(reviewed);return false;}catch{return true;}};
  const composeBeforeHistory=await prisma.translationHistory.count(),composeBeforeActivity=await prisma.activityEvent.count();
  const composeBeforeIntents=await prisma.repositoryLocalEffectIntent.count();
  check('transaction composition rejects altered bytes digest fingerprint and local scope',await rejectCompose({...reviewedCompose,json:'{}'})&&await rejectCompose({...reviewedCompose,contentDigest:'f'.repeat(64)})&&await rejectCompose({...reviewedCompose,previewFingerprint:'f'.repeat(64)})&&await rejectCompose({...reviewedCompose,local:{...composeLocal,locale:'he'}}));
  check('composition rejects current non-admin before mutation',await rejectCompose({...reviewedCompose,scope:{...writeScope,actorId:member.user.id}})&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='edited');
  try{await prisma.$transaction(async tx=>{await repositoryLocalTransaction(tx,reviewedCompose,composeDigest,composeFingerprint);throw new Error('composed rollback');},{isolationLevel:'Serializable'});}catch{}
  check('composed post-write failure atomically restores value history activity',(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='edited'&&await prisma.translationHistory.count()===composeBeforeHistory&&await prisma.activityEvent.count()===composeBeforeActivity);
  check('post-write rollback leaves no durable effect intent',await prisma.repositoryLocalEffectIntent.count()===composeBeforeIntents);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION fail_effect_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected intent storage failure'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER fail_effect_insert BEFORE INSERT ON repository_local_effect_intents FOR EACH ROW EXECUTE FUNCTION fail_effect_insert()`);
  let intentFailure=false;try{await compose(reviewedCompose);}catch(e){intentFailure=e.message.includes('injected intent storage failure');}
  check('intent insertion failure rolls back local value history and activity',intentFailure&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='edited'&&await prisma.translationHistory.count()===composeBeforeHistory&&await prisma.activityEvent.count()===composeBeforeActivity&&await prisma.repositoryLocalEffectIntent.count()===composeBeforeIntents);
  await prisma.$executeRawUnsafe(`DROP TRIGGER fail_effect_insert ON repository_local_effect_intents`);await prisma.$executeRawUnsafe(`DROP FUNCTION fail_effect_insert()`);
  const budgetData={projectId:project.id,targetId:target.id,actorId:owner.user.id,keyId:localKey.id,keyName:'budget',branchId:writeScope.branchId,branch:'main',locale:'en',operation:'set-value',value:'v',draftContentDigest:composeDigest,previewFingerprint:composeFingerprint};
  await prisma.repositoryLocalEffectIntent.createMany({data:Array.from({length:10000},()=>budgetData)});
  const budgetHistory=await prisma.translationHistory.count(),budgetActivity=await prisma.activityEvent.count();let deniedBudget=false;
  try{await compose(reviewedCompose);}catch(e){deniedBudget=e.message.includes('backlog budget');}
  check('pending effect row cap rejects before local history activity mutation',deniedBudget&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='edited'&&await prisma.translationHistory.count()===budgetHistory&&await prisma.activityEvent.count()===budgetActivity&&await prisma.repositoryLocalEffectIntent.count()===10000);
  await prisma.repositoryLocalEffectIntent.deleteMany();
  await prisma.repositoryLocalEffectIntent.create({data:{...budgetData,state:'leased',attempts:3,leaseToken:owner.user.id,leaseUntil:new Date('2020-01-01'),value:'x'.repeat(8*1024*1024)}});
  deniedBudget=false;try{await compose(reviewedCompose);}catch(e){deniedBudget=e.message.includes('backlog budget');}
  check('expired exhausted leased payload still consumes byte budget',deniedBudget&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='edited');
  await prisma.repositoryLocalEffectIntent.deleteMany();
  await prisma.repositoryLocalEffectIntent.create({data:{...budgetData,keyName:'unicode',value:'א'.repeat(4*1024*1024)}});
  deniedBudget=false;try{await compose(reviewedCompose);}catch(e){deniedBudget=e.message.includes('backlog budget');}
  check('backlog payload budget counts UTF8 bytes not characters',deniedBudget);
  await prisma.repositoryLocalEffectIntent.deleteMany();
  const noopBudgetJson=JSON.stringify(composeValues),noopBudgetDigest=createHash('sha256').update(noopBudgetJson).digest('hex');
  await prisma.repositoryLocalEffectIntent.create({data:{...budgetData,value:'x'.repeat(8*1024*1024)}});
  const noopBudget=await prisma.$transaction(tx=>repositoryLocalTransaction(tx,{...reviewedCompose,json:noopBudgetJson,contentDigest:noopBudgetDigest},noopBudgetDigest,composeFingerprint),{isolationLevel:'Serializable'});
  check('over-budget existing backlog does not prevent no-op composition',noopBudget.updatedValues===0&&noopBudget.pendingEffectIntents===0);
  await prisma.repositoryLocalEffectIntent.deleteMany();
  await prisma.repositoryLocalEffectIntent.createMany({data:Array.from({length:9999},()=>budgetData)});
  const contenders=await Promise.allSettled([0,1].map(()=>prisma.$transaction(async tx=>{await assertRepositoryEffectBudget(tx,project.id,[{key:'budget',nextValue:'v'}]);await tx.repositoryLocalEffectIntent.create({data:budgetData});},{isolationLevel:'Serializable'})));
  check('concurrent final-slot producers cannot exceed pending row cap',contenders.filter(r=>r.status==='fulfilled').length===1&&await prisma.repositoryLocalEffectIntent.count()===10000);
  await prisma.repositoryLocalEffectIntent.deleteMany();
  let weakBudget=false;try{await prisma.$transaction(tx=>assertRepositoryEffectBudget(tx,project.id,[]));}catch{weakBudget=true;}
  check('budget helper rejects weak isolation',weakBudget);
  const terminalBudget=await prisma.repositoryLocalEffectIntent.create({data:{...budgetData,state:'dead',finishedAt:new Date(),value:'x'.repeat(8*1024*1024)}});
  const composed=await compose(reviewedCompose);
  check('terminal payload does not consume pending effect quota',composed.updatedValues===1);
  await prisma.repositoryLocalEffectIntent.delete({where:{id:terminalBudget.id}});
  check('composition commits rederived exact draft operations under both guards',composed.updatedValues===1&&composed.draftContentDigest===composeDigest&&composed.previewFingerprint===composeFingerprint&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='composed value');
  check('composition replay fails stale local preconditions without duplicate audit',await rejectCompose(reviewedCompose)&&await prisma.translationHistory.count()===composeBeforeHistory+1&&await prisma.activityEvent.count()===composeBeforeActivity+1);
  const effectIntent=await prisma.repositoryLocalEffectIntent.findFirst({where:{projectId:project.id},orderBy:{createdAt:'desc'}});
  check('composition persists exact pending set context without delivery claim',composed.pendingEffectIntents===1&&effectIntent.projectId===project.id&&effectIntent.actorId===owner.user.id&&effectIntent.targetId===target.id&&effectIntent.keyId===localKey.id&&effectIntent.keyName==='local'&&effectIntent.branchId===writeScope.branchId&&effectIntent.branch==='main'&&effectIntent.locale==='en'&&effectIntent.operation==='set-value'&&effectIntent.value==='composed value'&&effectIntent.draftContentDigest===composeDigest&&effectIntent.previewFingerprint===composeFingerprint);
  let handlerCalls=0,handlerAfterLocks=false,runnerContext=false;
  const runCompleted=await runRepositoryEffect(prisma,async intent=>{handlerCalls++;runnerContext=intent.id===effectIntent.id&&intent.value==='composed value';await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL lock_timeout='1s'`);await tx.$queryRaw`SELECT id FROM projects WHERE id=${project.id}::uuid FOR UPDATE`;handlerAfterLocks=true;});});
  check('single effect runner passes exact context after guard locks release',runCompleted.status==='completed'&&handlerCalls===1&&runnerContext&&handlerAfterLocks);
  check('completed runner does not run handler twice',(await runRepositoryEffect(prisma,async()=>{handlerCalls++;})).status==='idle'&&handlerCalls===1);
  const resetRunner=()=>prisma.repositoryLocalEffectIntent.update({where:{id:effectIntent.id},data:{state:'pending',attempts:0,leaseToken:null,leaseUntil:null,finishedAt:null,availableAt:new Date('2020-01-01'),targetRevision:writeScope.targetRevision}});
  await resetRunner();let concurrentHandlerStarted,releaseHandler;const handlerStarted=new Promise(r=>concurrentHandlerStarted=r),handlerGate=new Promise(r=>releaseHandler=r);let concurrentHandlerCalls=0;
  const heldRun=runRepositoryEffect(prisma,async()=>{concurrentHandlerCalls++;concurrentHandlerStarted();await handlerGate;});await handlerStarted;
  const competingRun=await runRepositoryEffect(prisma,async()=>{concurrentHandlerCalls++;});releaseHandler();const heldRunResult=await heldRun;
  check('concurrent runners do not invoke same active intent handler',competingRun.status==='idle'&&heldRunResult.status==='completed'&&concurrentHandlerCalls===1);
  await resetRunner();const runnerHistory=await prisma.translationHistory.count(),runnerActivity=await prisma.activityEvent.count();
  const runFailed=await runRepositoryEffect(prisma,async()=>{throw new Error('private fixture error');});
  check('handler failure requeues without reverting committed locale or duplicating audit',runFailed.status==='retry'&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:effectIntent.id}})).state==='pending'&&await prisma.translationHistory.count()===runnerHistory&&await prisma.activityEvent.count()===runnerActivity&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='composed value'&&!JSON.stringify(runFailed).includes('private fixture'));
  await resetRunner();await prisma.repositoryLocalEffectIntent.update({where:{id:effectIntent.id},data:{targetRevision:writeScope.targetRevision+1}});
  check('ineligible runner never invokes handler',(await runRepositoryEffect(prisma,async()=>{handlerCalls++;})).status==='ineligible'&&handlerCalls===1);
  for(const blockedScope of ['project','translation']) {
  await resetRunner();
  let effectLockReady,releaseEffectLock;
  const effectLockHeld=new Promise(r=>effectLockReady=r),effectLockGate=new Promise(r=>releaseEffectLock=r);
  const effectBlocker=prisma.$transaction(async tx=>{if(blockedScope==='project')await tx.$queryRaw`SELECT id FROM projects WHERE id=${project.id}::uuid FOR UPDATE`;else await tx.$queryRaw`SELECT "rowId" FROM translations WHERE "keyId"=${localKey.id}::uuid AND "localeCode"='en' FOR UPDATE`;effectLockReady();await effectLockGate;},{timeout:10000});
  await effectLockHeld;
  const guardedDb=new Proxy(prisma,{get(db,prop){if(prop==='$transaction')return async(fn,options)=>db.$transaction(async tx=>fn(new Proxy(tx,{get(inner,key){if(key==='$queryRaw')return async(...args)=>{try{return await inner.$queryRaw(...args);}catch(error){effectLockError=error;throw error;}};return inner[key];}})),options);return db[prop];}});
  let effectLockError;const effectLockStart=Date.now(),effectLockCalls=handlerCalls;
  const effectBlocked=await runRepositoryEffect(guardedDb,async()=>{handlerCalls++;});
  const effectLockElapsed=Date.now()-effectLockStart;
  const effectBlockedRow=await prisma.repositoryLocalEffectIntent.findUnique({where:{id:effectIntent.id}});
  check('actual eligibility '+blockedScope+' lock timeout requeues without invoking handler',effectBlocked.status==='ineligible'&&handlerCalls===effectLockCalls&&effectBlockedRow.state==='pending'&&effectBlockedRow.attempts===1&&effectLockError?.code==='P2010'&&effectLockError?.meta?.code==='55P03'&&effectLockElapsed>=1800&&effectLockElapsed<4500,JSON.stringify({effectLockElapsed,code:effectLockError?.code,meta:effectLockError?.meta}));
  releaseEffectLock();await effectBlocker;
  await prisma.repositoryLocalEffectIntent.update({where:{id:effectIntent.id},data:{availableAt:new Date('2020-01-01')}});
  check('eligibility runner recovers after actual '+blockedScope+' lock release',(await runRepositoryEffect(prisma,async()=>{})).status==='completed');
  }
  await resetRunner();const staleRun=await runRepositoryEffect(prisma,async()=>{await prisma.repositoryLocalEffectIntent.update({where:{id:effectIntent.id},data:{leaseUntil:new Date('2020-01-01')}});});
  check('runner reports stale instead of completing expired handler lease',staleRun.status==='stale'&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:effectIntent.id}})).state==='leased');
  await resetRunner();
  const eligibilityLease=await prisma.$transaction(claimRepositoryEffect);
  const eligible=()=>prisma.$transaction(tx=>validateRepositoryEffect(tx,effectIntent.id,eligibilityLease.leaseToken),{isolationLevel:'Serializable'});
  check('committed intent has exact translation generation and current eligibility',(await eligible()).id===effectIntent.id&&effectIntent.targetRevision===writeScope.targetRevision&&effectIntent.translationRowId&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).version===effectIntent.translationVersion);
  const deniedEligibility=async mutate=>{let denied=false;try{await prisma.$transaction(async tx=>{await mutate(tx);try{await validateRepositoryEffect(tx,effectIntent.id,eligibilityLease.leaseToken);}catch{denied=true;}throw new Error('rollback eligibility fixture');},{isolationLevel:'Serializable'});}catch{}return denied;};
  check('effect eligibility rejects wrong lease token',await deniedEligibility(tx=>tx.repositoryLocalEffectIntent.update({where:{id:effectIntent.id},data:{leaseToken:owner.user.id}})));
  check('effect eligibility rejects expired lease',await deniedEligibility(tx=>tx.repositoryLocalEffectIntent.update({where:{id:effectIntent.id},data:{leaseUntil:new Date('2020-01-01')}})));
  check('legacy effect without revision evidence fails closed',await deniedEligibility(tx=>tx.repositoryLocalEffectIntent.update({where:{id:effectIntent.id},data:{targetRevision:null}})));
  check('effect eligibility rejects revoked actor admin',await deniedEligibility(tx=>tx.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:owner.user.id}},data:{role:'MEMBER'}})));
  check('effect eligibility rejects changed target revision',await deniedEligibility(tx=>tx.repositorySyncTarget.update({where:{id:target.id},data:{revision:{increment:1}}})));
  check('effect eligibility rejects deleted target',await deniedEligibility(tx=>tx.repositorySyncTarget.delete({where:{id:target.id}})));
  check('effect eligibility rejects renamed key',await deniedEligibility(tx=>tx.key.update({where:{id:localKey.id},data:{name:'renamed-effect-key'}})));
  check('effect eligibility rejects plural conversion',await deniedEligibility(tx=>tx.key.update({where:{id:localKey.id},data:{isPlural:true}})));
  check('effect eligibility rejects value ABA via version',await deniedEligibility(async tx=>{await tx.translation.update({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}},data:{value:'intermediate',version:{increment:1}}});await tx.translation.update({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}},data:{value:'composed value',version:{increment:1}}});}));
  check('effect eligibility rejects same value row recreation',await deniedEligibility(async tx=>{await tx.translation.delete({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}});await tx.translation.create({data:{keyId:localKey.id,projectId:project.id,localeCode:'en',value:'composed value',version:effectIntent.translationVersion}});}));
  check('effect eligibility rejects removed project locale',await deniedEligibility(tx=>tx.projectLocale.delete({where:{projectId_code:{projectId:project.id,code:'en'}}})));
  let expiredDuringValidation=false;
  try{await prisma.$transaction(async tx=>{let reads=0;const observedTx=new Proxy(tx,{get(target,prop){if(prop==='$queryRaw')return async(...args)=>{const rows=await target.$queryRaw(...args);if(++reads===2)await target.repositoryLocalEffectIntent.update({where:{id:effectIntent.id},data:{leaseUntil:new Date('2020-01-01')}});return rows;};return target[prop];}});try{await validateRepositoryEffect(observedTx,effectIntent.id,eligibilityLease.leaseToken);}catch(e){expiredDuringValidation=e.message==='Effect lease expired during validation';}throw new Error('rollback expiry fixture');},{isolationLevel:'Serializable'});}catch{}
  check('lease expiring after initial check is rejected before eligibility returns',expiredDuringValidation);
  let weakIsolationDenied=false;try{await prisma.$transaction(tx=>validateRepositoryEffect(tx,effectIntent.id,eligibilityLease.leaseToken));}catch{weakIsolationDenied=true;}
  check('effect eligibility refuses weak transaction isolation',weakIsolationDenied);
  check('stale composition replay creates no duplicate effect intent',await prisma.repositoryLocalEffectIntent.count()===composeBeforeIntents+1);
  const effectLocal=(await repositoryPreview()).json.localPreconditions;
  const effectValues=Object.fromEntries(effectLocal.keys.filter(k=>k.translation).map(k=>[k.key,k.translation.value]));
  const noopJson=JSON.stringify(effectValues);const noopDigest=createHash('sha256').update(noopJson).digest('hex');
  const noopResult=await prisma.$transaction(tx=>repositoryLocalTransaction(tx,{...reviewedCompose,local:effectLocal,json:noopJson,contentDigest:noopDigest},noopDigest,composeFingerprint),{isolationLevel:'Serializable'});
  check('no-op composition enqueues no effect intent',noopResult.pendingEffectIntents===0&&await prisma.repositoryLocalEffectIntent.count()===composeBeforeIntents+1);
  const removeJson=JSON.stringify(Object.fromEntries(Object.entries(effectValues).filter(([k])=>k!=='local')));const removeDigest=createHash('sha256').update(removeJson).digest('hex');
  let removalIntent,removalEligibilityReached=false,removalSuperseded=false,removalEligibilityError='';
  try{await prisma.$transaction(async tx=>{const r=await repositoryLocalTransaction(tx,{...reviewedCompose,local:effectLocal,json:removeJson,contentDigest:removeDigest},removeDigest,composeFingerprint);removalIntent=await tx.repositoryLocalEffectIntent.findFirst({where:{operation:'remove-locale-value',keyId:localKey.id}});const removalLeaseToken=owner.user.id;await tx.$executeRaw`UPDATE repository_local_effect_intents SET state='leased',attempts=1,"leaseToken"=${removalLeaseToken}::uuid,"leaseUntil"=clock_timestamp()+INTERVAL '60 seconds' WHERE id=${removalIntent.id}::uuid`;const removalEligible=await validateRepositoryEffect(tx,removalIntent.id,removalLeaseToken);removalEligibilityReached=removalEligible.id===removalIntent.id;await tx.translation.create({data:{keyId:localKey.id,projectId:project.id,localeCode:'en',value:'restored'}});let superseded=false;try{await validateRepositoryEffect(tx,removalIntent.id,removalLeaseToken);}catch{superseded=true;}removalSuperseded=superseded;if(r.pendingEffectIntents!==1)throw new Error('wrong count');throw new Error('rollback intent removal fixture');},{isolationLevel:'Serializable'});}catch(e){removalEligibilityError=e.message;}
  check('removal effect eligible only while locale absent',removalEligibilityReached,removalEligibilityError);
  check('recreated locale supersedes removal effect',removalSuperseded,removalEligibilityError);
  let abaDenied=false,legacyRemovalDenied=false,abaMarkerChanged=false,newRemovalEligible=false;
  try {await prisma.$transaction(async tx=>{
    await repositoryLocalTransaction(tx,{...reviewedCompose,local:effectLocal,json:removeJson,contentDigest:removeDigest},removeDigest,composeFingerprint);
    const oldRemoval=await tx.repositoryLocalEffectIntent.findFirst({where:{operation:'remove-locale-value',keyId:localKey.id}});
    await tx.repositoryLocalEffectIntent.update({where:{id:oldRemoval.id},data:{state:'leased',attempts:1,leaseToken:owner.user.id,leaseUntil:new Date('2099-01-01')}});
    await tx.repositoryLocalEffectIntent.update({where:{id:oldRemoval.id},data:{removalAuditId:null}});
    try{await validateRepositoryEffect(tx,oldRemoval.id,owner.user.id);}catch(e){legacyRemovalDenied=e.message==='Effect removal generation superseded';}
    await tx.repositoryLocalEffectIntent.update({where:{id:oldRemoval.id},data:{removalAuditId:oldRemoval.removalAuditId}});
    const recreated=await tx.translation.create({data:{keyId:localKey.id,projectId:project.id,localeCode:'en',value:'ABA restored'}});
    const secondSnapshot={...effectLocal,keys:effectLocal.keys.map(k=>k.keyId===localKey.id?{...k,translation:{rowId:recreated.rowId,version:recreated.version,value:recreated.value}}:k)};
    await writeExistingLocalValues(tx,secondSnapshot,[{key:'local',action:'remove-locale-value',expectedValue:'ABA restored',nextValue:null}],owner.user.id);
    const marker=await tx.repositoryRemovalGeneration.findUnique({where:{projectId_keyId_locale:{projectId:project.id,keyId:localKey.id,locale:'en'}}});
    abaMarkerChanged=marker.auditId!==oldRemoval.removalAuditId&&await tx.translation.count({where:{keyId:localKey.id,localeCode:'en'}})===0;
    try{await validateRepositoryEffect(tx,oldRemoval.id,owner.user.id);}catch(e){abaDenied=e.message==='Effect removal generation superseded';}
    const freshRemoval=await tx.repositoryLocalEffectIntent.create({data:{projectId:project.id,targetId:target.id,actorId:owner.user.id,keyId:localKey.id,keyName:'local',branchId:writeScope.branchId,branch:'main',locale:'en',operation:'remove-locale-value',value:null,draftContentDigest:removeDigest,previewFingerprint:composeFingerprint,targetRevision:writeScope.targetRevision,removalAuditId:marker.auditId,state:'leased',attempts:1,leaseToken:owner.user.id,leaseUntil:new Date('2099-01-01')}});
    newRemovalEligible=(await validateRepositoryEffect(tx,freshRemoval.id,owner.user.id)).id===freshRemoval.id;
    throw new Error('rollback removal ABA fixture');
  },{isolationLevel:'Serializable'});}catch{}
  check('legacy removal without deletion generation fails closed',legacyRemovalDenied);
  check('actual recreate remove ABA replaces generation and denies older absent intent',abaMarkerChanged&&abaDenied);
  check('removal generation and audit rollback together',await prisma.repositoryRemovalGeneration.count({where:{projectId:project.id,keyId:localKey.id}})===0&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='composed value');
  check('new removal generation remains eligible after older generation superseded',newRemovalEligible);
  await prisma.repositoryRemovalGeneration.create({data:{projectId:project.id,keyId:localKey.id,locale:'en',auditId:owner.user.id}});
  try{await prisma.$transaction(async tx=>{await repositoryLocalTransaction(tx,{...reviewedCompose,local:effectLocal,json:removeJson,contentDigest:removeDigest},removeDigest,composeFingerprint);throw new Error('rollback prior marker');},{isolationLevel:'Serializable'});}catch{}
  check('failed removal restores previously committed generation marker',(await prisma.repositoryRemovalGeneration.findUnique({where:{projectId_keyId_locale:{projectId:project.id,keyId:localKey.id,locale:'en'}}})).auditId===owner.user.id);
  await prisma.repositoryRemovalGeneration.deleteMany({where:{projectId:project.id,keyId:localKey.id}});
  check('removal intent distinguishes absence from empty set',!!removalIntent?.removalAuditId&&removalIntent.operation==='remove-locale-value'&&removalIntent.value===null&&removalIntent.keyId===localKey.id&&removalIntent.draftContentDigest===removeDigest);
  check('removal intent rolls back with row and audit',await prisma.repositoryLocalEffectIntent.count()===composeBeforeIntents+1&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='composed value');
  const emptyJson=JSON.stringify({...effectValues,local:''});const emptyDigest=createHash('sha256').update(emptyJson).digest('hex');let emptyIntent,lineageSurvived=false;
  try{await prisma.$transaction(async tx=>{await repositoryLocalTransaction(tx,{...reviewedCompose,local:effectLocal,json:emptyJson,contentDigest:emptyDigest},emptyDigest,composeFingerprint);emptyIntent=await tx.repositoryLocalEffectIntent.findFirst({where:{keyId:localKey.id,draftContentDigest:emptyDigest}});await tx.key.delete({where:{id:localKey.id}});await tx.repositorySyncTarget.delete({where:{id:target.id}});lineageSurvived=await tx.repositoryLocalEffectIntent.count({where:{id:emptyIntent.id}})===1;throw new Error('rollback empty fixture');},{isolationLevel:'Serializable'});}catch{}
  check('empty set intent preserves empty string rather than removal',emptyIntent?.operation==='set-value'&&emptyIntent.value==='');
  check('pending intent lineage survives key and target deletion',lineageSurvived);
  let projectCascade=false;try{await prisma.$transaction(async tx=>{await tx.project.delete({where:{id:project.id}});projectCascade=await tx.repositoryLocalEffectIntent.count({where:{projectId:project.id}})===0;throw new Error('rollback cascade fixture');},{isolationLevel:'Serializable'});}catch{}
  check('project deletion removes private pending effect payloads',projectCascade);
  check('composition preserves accepted baseline and repository no-write posture',(await tc(baselinePath,'GET',undefined)).json.baseline.version===writeScope.baselineVersion&&composed.remoteWritten===false&&composed.baselineAdvanced===false);
  await prisma.translation.update({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}},data:{value:'edited',version:{increment:1}}});
  const tmKey=await prisma.key.create({data:{projectId:project.id,branchId:storedLocalKey.branchId,name:'transaction-tm'}});
  await prisma.translation.create({data:{keyId:tmKey.id,projectId:project.id,localeCode:'en',value:'Transactional source'}});
  const heSnapshot=async()=>{const scope=(await repositoryPreview()).json.localPreconditions;return {...scope,locale:'he',keys:await Promise.all(scope.keys.map(async k=>{const t=await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:k.keyId,localeCode:'he'}}});return {...k,translation:t?{rowId:t.rowId,version:t.version,value:t.value}:null};}))};};
  let tmSnapshot=await heSnapshot();const tmChange={key:'transaction-tm',action:'set-value',expectedValue:null,nextValue:'Transactional target'};
  const tmCountBefore=await prisma.tmEntry.count();
  const tmHistoryBefore=await prisma.translationHistory.count();const tmActivityBefore=await prisma.activityEvent.count();
  try{await prisma.$transaction(async tx=>{await writeExistingLocalValues(tx,tmSnapshot,[tmChange],owner.user.id);throw new Error('rollback TM');},{isolationLevel:'Serializable'});}catch{}
  check('transactional TM rolls back with value history and activity',await prisma.tmEntry.count()===tmCountBefore&&await prisma.translationHistory.count()===tmHistoryBefore&&await prisma.activityEvent.count()===tmActivityBefore&&!await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:tmKey.id,localeCode:'he'}}}));
  await prisma.$transaction(tx=>writeExistingLocalValues(tx,tmSnapshot,[tmChange],owner.user.id),{isolationLevel:'Serializable'});
  let tmPair=await prisma.tmEntry.findUnique({where:{projectId_localeCode_sourceLocaleCode_sourceText:{projectId:project.id,localeCode:'he',sourceLocaleCode:'en',sourceText:'Transactional source'}}});
  check('isolated locale writer remembers exact source target pair atomically',tmPair?.targetText==='Transactional target'&&tmPair.keyId===tmKey.id);
  tmSnapshot=await heSnapshot();await prisma.$transaction(tx=>writeExistingLocalValues(tx,tmSnapshot,[{...tmChange,expectedValue:'Transactional target',nextValue:'Updated target'}],owner.user.id),{isolationLevel:'Serializable'});
  check('transactional TM updates existing pair without duplicate',await prisma.tmEntry.count()===tmCountBefore+1&&(await prisma.tmEntry.findUnique({where:{id:tmPair.id}})).targetText==='Updated target');
  tmSnapshot=await heSnapshot();await prisma.$transaction(tx=>writeExistingLocalValues(tx,tmSnapshot,[{key:'transaction-tm',action:'remove-locale-value',expectedValue:'Updated target',nextValue:null}],owner.user.id),{isolationLevel:'Serializable'});
  check('locale removal preserves historical TM pair',(await prisma.tmEntry.findUnique({where:{id:tmPair.id}})).targetText==='Updated target');
  tmSnapshot=await heSnapshot();await prisma.$transaction(tx=>writeExistingLocalValues(tx,tmSnapshot,[{...tmChange,nextValue:''}],owner.user.id),{isolationLevel:'Serializable'});
  check('empty locale set does not overwrite remembered nonempty target',(await prisma.tmEntry.findUnique({where:{id:tmPair.id}})).targetText==='Updated target');
  const baseSnapshot=(await repositoryPreview()).json.localPreconditions;await prisma.$transaction(tx=>writeExistingLocalValues(tx,baseSnapshot,[{key:'transaction-tm',action:'set-value',expectedValue:'Transactional source',nextValue:'Changed source'}],owner.user.id),{isolationLevel:'Serializable'});
  check('base locale write does not invent TM target pair',await prisma.tmEntry.count()===tmCountBefore+1);
  await prisma.translation.update({where:{keyId_localeCode:{keyId:tmKey.id,localeCode:'en'}},data:{value:'',version:{increment:1}}});
  tmSnapshot=await heSnapshot();await prisma.$transaction(tx=>writeExistingLocalValues(tx,tmSnapshot,[{...tmChange,expectedValue:'',nextValue:'No source target'}],owner.user.id),{isolationLevel:'Serializable'});
  check('empty base source does not invent TM pair',await prisma.tmEntry.count()===tmCountBefore+1);
  await prisma.translation.delete({where:{keyId_localeCode:{keyId:tmKey.id,localeCode:'en'}}});
  tmSnapshot=await heSnapshot();await prisma.$transaction(tx=>writeExistingLocalValues(tx,tmSnapshot,[{...tmChange,expectedValue:'No source target',nextValue:'Missing source target'}],owner.user.id),{isolationLevel:'Serializable'});
  check('missing base source does not invent TM pair',await prisma.tmEntry.count()===tmCountBefore+1);
  await prisma.tmEntry.delete({where:{id:tmPair.id}});await prisma.key.delete({where:{id:tmKey.id}});
  const writerPreconditions=(await repositoryPreview()).json.localPreconditions;
  const beforeWriterRow=await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}});
  await prisma.translation.update({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}},data:{status:'REVIEWED',mtScore:88,mtProvider:'fixture'}});
  const writerSnapshot=(await repositoryPreview()).json.localPreconditions;
  const otherLocale=await call(`${P}/import/he`,{jwt,method:'POST',body:{entries:{local:'other locale preserved'}}});if(otherLocale.status!==201)throw new Error('Other locale fixture failed');
  const writeChange={key:'local',action:'set-value',expectedValue:'edited',nextValue:'writer draft'};
  const beforeHistory=await prisma.translationHistory.count({where:{keyId:localKey.id,localeCode:'en'}}),beforeActivity=await prisma.activityEvent.count({where:{projectId:project.id}});
  const writeResult=await prisma.$transaction(tx=>writeExistingLocalValues(tx,writerSnapshot,[writeChange],owner.user.id),{isolationLevel:'Serializable'});
  const written=await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}});
  check('internal writer commits exact locale value version and row identity',writeResult.updatedValues===1&&written.value==='writer draft'&&written.version===beforeWriterRow.version+1&&written.rowId===beforeWriterRow.rowId);
  check('internal human draft write resets review and MT provenance',written.status==='UNVERIFIED'&&written.mtScore===null&&written.mtProvider===null);
  check('internal write records history and activity in same transaction',await prisma.translationHistory.count({where:{keyId:localKey.id,localeCode:'en'}})===beforeHistory+1&&await prisma.activityEvent.count({where:{projectId:project.id}})===beforeActivity+1&&(await prisma.translationHistory.findFirst({where:{keyId:localKey.id,localeCode:'en'},orderBy:{createdAt:'desc'}})).previousValue==='edited');
  check('internal writer preserves other locales keys repository and baseline',(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'he'}}})).value==='other locale preserved'&&await prisma.key.count({where:{id:localKey.id}})===1&&writeResult.createdKeys===0&&writeResult.remoteWritten===false&&(await tc(baselinePath,'GET',undefined)).json.baseline.version===2);
  let batchSnapshot=(await repositoryPreview()).json.localPreconditions;
  const rejectsWrite=async(changes,snapshot=batchSnapshot)=>{try{await prisma.$transaction(tx=>writeExistingLocalValues(tx,snapshot,changes,owner.user.id),{isolationLevel:'Serializable'});return false;}catch{return true;}};
  const currentChange={...writeChange,expectedValue:'writer draft',nextValue:'next'};
  const beforeRejectedHistory=await prisma.translationHistory.count(),beforeRejectedActivity=await prisma.activityEvent.count();
  check('internal writer refuses malformed removal unknown key duplicate and no-op batches',await rejectsWrite([{...currentChange,action:'remove-locale-value',nextValue:'not absent'}])&&await rejectsWrite([{...currentChange,key:'remote-new'}])&&await rejectsWrite([currentChange,currentChange])&&await rejectsWrite([{...currentChange,nextValue:'writer draft'}]));
  check('invalid later operation cannot partially write earlier valid operation',await rejectsWrite([currentChange,{key:'remote',action:'remove-locale-value',expectedValue:'wrong stale value',nextValue:null}])&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='writer draft'&&await prisma.translationHistory.count()===beforeRejectedHistory&&await prisma.activityEvent.count()===beforeRejectedActivity);
  await prisma.key.update({where:{id:localKey.id},data:{maxLength:2}});batchSnapshot=(await repositoryPreview()).json.localPreconditions;
  check('internal writer rejects oversized draft before mutation',await rejectsWrite([currentChange]));await prisma.key.update({where:{id:localKey.id},data:{maxLength:storedLocalKey.maxLength}});batchSnapshot=(await repositoryPreview()).json.localPreconditions;
  try{await prisma.$transaction(async tx=>{await writeExistingLocalValues(tx,batchSnapshot,[currentChange],owner.user.id);throw new Error('injected post-write failure');},{isolationLevel:'Serializable'});}catch{}
  check('post-write failure rolls back value history and activity',(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).value==='writer draft'&&await prisma.translationHistory.count()===beforeRejectedHistory&&await prisma.activityEvent.count()===beforeRejectedActivity);
  const emptyKey=await prisma.key.create({data:{projectId:project.id,branchId:storedLocalKey.branchId,name:'writer-empty'}});batchSnapshot=(await repositoryPreview()).json.localPreconditions;
  await prisma.$transaction(tx=>writeExistingLocalValues(tx,batchSnapshot,[{key:'writer-empty',action:'set-value',expectedValue:null,nextValue:''}],owner.user.id),{isolationLevel:'Serializable'});
  check('writer creates absent locale row with empty text without new key',(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:emptyKey.id,localeCode:'en'}}})).value===''&&await prisma.key.count({where:{id:emptyKey.id}})===1);
  const deletionSnapshot=(await repositoryPreview()).json.localPreconditions;
  const deletedRow=await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}});
  const deletedHistory=await prisma.translationHistory.findMany({where:{keyId:localKey.id,localeCode:'en'},orderBy:[{createdAt:'asc'},{id:'asc'}]});
  const removal={key:'local',action:'remove-locale-value',expectedValue:'writer draft',nextValue:null};
  const deletionAuditsPath=`${P}/sync/deletion-audits`;
  check('deletion audit metadata empty project returns empty list',(await call(`/projects/${summaryOtherProject.id}/sync/deletion-audits`,{jwt})).json.audits.length===0);
  check('deletion audit metadata requires session',(await call(deletionAuditsPath)).status===401);
  check('deletion audit metadata denies contributor',(await call(deletionAuditsPath,{jwt:member.accessToken})).status===403);
  check('deletion audit metadata denies outsider',(await call(deletionAuditsPath,{jwt:outsider.accessToken})).status===404);
  check('deletion audit metadata denies API token',(await call(deletionAuditsPath,{apiKey:token.token})).status===403);
  check('deletion audit metadata accepts project admin',(await call(deletionAuditsPath,{jwt:admin.accessToken})).status===200);
  const auditBefore=await prisma.translationDeletionAudit.count();
  try{await prisma.$transaction(async tx=>{await writeExistingLocalValues(tx,deletionSnapshot,[removal],owner.user.id);throw new Error('rollback removal');},{isolationLevel:'Serializable'});}catch{}
  check('removal rollback restores row history and leaves no audit',await prisma.translationDeletionAudit.count()===auditBefore&&await prisma.translationHistory.count({where:{keyId:localKey.id,localeCode:'en'}})===deletedHistory.length&&!!await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}}));
  const removed=await prisma.$transaction(tx=>writeExistingLocalValues(tx,deletionSnapshot,[removal],owner.user.id),{isolationLevel:'Serializable'});
  const audit=await prisma.translationDeletionAudit.findFirst({where:{keyId:localKey.id},orderBy:{createdAt:'desc'}});
  const recoveryPreviewPath=deletionAuditsPath+'/'+audit.id+'/recovery-preview';
  check('recovery preview requires session',(await call(recoveryPreviewPath)).status===401);
  check('recovery preview denies contributor',(await call(recoveryPreviewPath,{jwt:member.accessToken})).status===403);
  check('recovery preview denies outsider',(await call(recoveryPreviewPath,{jwt:outsider.accessToken})).status===404);
  check('recovery preview denies API token',(await call(recoveryPreviewPath,{apiKey:token.token})).status===403);
  const publicRecoveryPreview=await call(recoveryPreviewPath,{jwt});
  check('recovery preview exposes only eligibility no value digest scope or authority',publicRecoveryPreview.status===200&&publicRecoveryPreview.json.eligibleNow===true&&publicRecoveryPreview.json.reason==='current-flat-value-absence'&&Object.keys(publicRecoveryPreview.json).sort().join(',')==='asOf,canRestore,eligibleNow,historyReplay,reason,reservationHeld,snapshotIncluded,source'&&publicRecoveryPreview.json.canRestore===false&&publicRecoveryPreview.json.snapshotIncluded===false&&publicRecoveryPreview.json.historyReplay===false&&publicRecoveryPreview.json.reservationHeld===false&&!JSON.stringify(publicRecoveryPreview.json).includes('writer draft'));
  const previewStamp=new Date(publicRecoveryPreview.json.asOf).getTime();
  const databaseClock=(await prisma.$queryRaw`SELECT clock_timestamp() AS now`)[0].now.getTime();
  check('recovery preview includes current database snapshot timestamp',Number.isFinite(previewStamp)&&previewStamp<=databaseClock&&databaseClock-previewStamp<10000);
  await new Promise(r=>setTimeout(r,20));
  check('recovery preview refresh gets newer database snapshot timestamp',new Date((await call(recoveryPreviewPath,{jwt})).json.asOf).getTime()>previewStamp);
  check('recovery preview accepts current admin',(await call(recoveryPreviewPath,{jwt:admin.accessToken})).json.eligibleNow===true);
  const recoveryHeaders=await fetch(API+recoveryPreviewPath,{headers:{Authorization:'Bearer '+jwt}});check('recovery preview no-store header',recoveryHeaders.headers.get('cache-control')==='no-store');await recoveryHeaders.arrayBuffer();
  check('recovery preview unavailable audit has no cross project metadata',(await call(`/projects/${summaryOtherProject.id}/sync/deletion-audits/${audit.id}/recovery-preview`,{jwt})).json.reason==='audit-unavailable');
  check('recovery preview missing audit is safe denial',(await call(deletionAuditsPath+'/'+owner.user.id+'/recovery-preview',{jwt})).json.reason==='audit-unavailable');
  check('recovery preview rejects invalid audit UUID',(await call(deletionAuditsPath+'/not-uuid/recovery-preview',{jwt})).status===400);
  const recoveryBefore=JSON.stringify(await prisma.translationDeletionAudit.findUnique({where:{id:audit.id}}));
  const recovery=await inspectDeletionRecovery(prisma,project.id,audit.id);
  check('internal recovery diagnostic recognizes exact current removal without execution grant',recovery.eligible&&recovery.canRestore===false&&recovery.snapshotIncluded===false&&recovery.historyReplay===false&&recovery.valueDigest===createHash('sha256').update('writer draft').digest('hex')&&!JSON.stringify(recovery).includes('writer draft'));
  check('internal recovery diagnostic cannot cross project boundary',(await inspectDeletionRecovery(prisma,summaryOtherProject.id,audit.id)).reason==='audit-unavailable');
  const storedSnapshot=audit.snapshot;
  for(const [label,snapshot] of [['null',null],['row-mismatch',{...storedSnapshot,row:{...storedSnapshot.row,keyId:owner.user.id}}],['plural',{...storedSnapshot,row:{...storedSnapshot.row,pluralForms:{one:'x'}}}],['history-mismatch',{...storedSnapshot,history:[{keyId:owner.user.id,localeCode:'en',value:'x'}]}],['oversized',{...storedSnapshot,row:{...storedSnapshot.row,value:'x'.repeat(512*1024)}}]]){
    await prisma.translationDeletionAudit.update({where:{id:audit.id},data:{snapshot:snapshot===null?Prisma.JsonNull:snapshot}});
    check('internal recovery denies unsupported snapshot '+label,(await inspectDeletionRecovery(prisma,project.id,audit.id)).reason==='unsupported-snapshot');
  }
  await prisma.translationDeletionAudit.update({where:{id:audit.id},data:{snapshot:storedSnapshot}});
  await prisma.key.update({where:{id:localKey.id},data:{maxLength:1}});
  check('internal recovery denies changed current length limit',(await inspectDeletionRecovery(prisma,project.id,audit.id)).reason==='unsupported-current-key');
  await prisma.key.update({where:{id:localKey.id},data:{maxLength:null,name:'renamed local'}});
  check('internal recovery denies renamed key',(await inspectDeletionRecovery(prisma,project.id,audit.id)).reason==='key-changed');
  await prisma.key.update({where:{id:localKey.id},data:{name:'local'}});
  const recoveryMarker=await prisma.repositoryRemovalGeneration.findUnique({where:{projectId_keyId_locale:{projectId:project.id,keyId:localKey.id,locale:'en'}}});
  await prisma.repositoryRemovalGeneration.update({where:{projectId_keyId_locale:{projectId:project.id,keyId:localKey.id,locale:'en'}},data:{auditId:owner.user.id}});
  check('internal recovery denies old deletion generation',(await inspectDeletionRecovery(prisma,project.id,audit.id)).reason==='deletion-generation-changed');
  await prisma.repositoryRemovalGeneration.update({where:{projectId_keyId_locale:{projectId:project.id,keyId:localKey.id,locale:'en'}},data:{auditId:recoveryMarker.auditId}});
  await prisma.repositoryRemovalGeneration.delete({where:{projectId_keyId_locale:{projectId:project.id,keyId:localKey.id,locale:'en'}}});
  check('internal recovery denies missing legacy generation',(await inspectDeletionRecovery(prisma,project.id,audit.id)).reason==='deletion-generation-changed');
  await prisma.repositoryRemovalGeneration.create({data:recoveryMarker});
  await prisma.key.update({where:{id:localKey.id},data:{isPlural:true}});
  check('internal recovery denies current plural key',(await inspectDeletionRecovery(prisma,project.id,audit.id)).reason==='unsupported-current-key');
  await prisma.key.update({where:{id:localKey.id},data:{isPlural:false}});
  // Real locale deletion in rollback-only transaction: no fixture translation loss.
  let missingLocale;try{await prisma.$transaction(async tx=>{await tx.projectLocale.delete({where:{projectId_code:{projectId:project.id,code:'en'}}});missingLocale=await inspectDeletionRecovery(tx,project.id,audit.id);throw new Error('rollback locale fixture');});}catch(e){if(e?.message!=='rollback locale fixture')throw e;}
  check('internal recovery denies removed project locale',missingLocale.reason==='locale-unavailable');
  check('recovery preview repeated reads never change archived bytes',JSON.stringify(await prisma.translationDeletionAudit.findUnique({where:{id:audit.id}}))===recoveryBefore);
  check('internal recovery diagnostic never alters archived snapshot',JSON.stringify(await prisma.translationDeletionAudit.findUnique({where:{id:audit.id}}))===recoveryBefore);
  const currentRecoveryReview=await inspectDeletionRecovery(prisma,project.id,audit.id);
  const recoveryScope={projectId:project.id,actorId:owner.user.id,auditId:audit.id,expectedBranchId:recovery.branchId,expectedKeyUpdatedAt:currentRecoveryReview.keyUpdatedAt,expectedKeyRevision:currentRecoveryReview.keyRevision,expectedValueDigest:recovery.valueDigest};
  const recoveryOtherBranch=await prisma.branch.create({data:{projectId:project.id,name:'recovery-other'}});
  let movedRecoveryDenied=false;try{await prisma.$transaction(async tx=>{await tx.key.update({where:{id:localKey.id},data:{branchId:recoveryOtherBranch.id}});await lockDeletionRecovery(tx,recoveryScope);},{isolationLevel:'Serializable'});}catch(e){movedRecoveryDenied=e.name==='RepositoryLocalError';}
  check('locked recovery rejects actual key movement away from reviewed branch',movedRecoveryDenied&&(await prisma.key.findUnique({where:{id:localKey.id}})).branchId===recovery.branchId);
  let wrongBranchDenied=false;try{await prisma.$transaction(tx=>lockDeletionRecovery(tx,{...recoveryScope,expectedBranchId:recoveryOtherBranch.id}),{isolationLevel:'Serializable'});}catch(e){wrongBranchDenied=e.name==='RepositoryLocalError';}
  check('locked recovery rejects different existing project branch binding',wrongBranchDenied);
  await prisma.branch.delete({where:{id:recoveryOtherBranch.id}});
  let deletedBranchDenied=false;try{await prisma.$transaction(tx=>lockDeletionRecovery(tx,{...recoveryScope,expectedBranchId:recoveryOtherBranch.id}),{isolationLevel:'Serializable'});}catch(e){deletedBranchDenied=e.name==='RepositoryLocalError';}
  check('locked recovery rejects deleted reviewed branch',deletedBranchDenied);
  let metadataAbaDenied=false;try{await prisma.$transaction(async tx=>{await tx.key.update({where:{id:localKey.id},data:{maxLength:999}});await tx.key.update({where:{id:localKey.id},data:{maxLength:null}});await lockDeletionRecovery(tx,recoveryScope);},{isolationLevel:'Serializable'});}catch(e){metadataAbaDenied=e.name==='RepositoryLocalError';}
  check('locked recovery rejects actual restored key metadata ABA',metadataAbaDenied);
  let staleKeyStampDenied=false;try{await prisma.$transaction(tx=>lockDeletionRecovery(tx,{...recoveryScope,expectedKeyUpdatedAt:'2020-01-01T00:00:00.000Z'}),{isolationLevel:'Serializable'});}catch(e){staleKeyStampDenied=e.name==='RepositoryLocalError';}
  check('locked recovery rejects stale reviewed key timestamp',staleKeyStampDenied);
  let sameStampDenied=false;try{await prisma.$transaction(async tx=>{
    await tx.$executeRaw`UPDATE keys SET "maxLength"=999,"updatedAt"="updatedAt" WHERE id=${localKey.id}::uuid`;
    await tx.$executeRaw`UPDATE keys SET "maxLength"=NULL,"updatedAt"="updatedAt",revision=${currentRecoveryReview.keyRevision} WHERE id=${localKey.id}::uuid`;
    const changed=await tx.key.findUnique({where:{id:localKey.id}});
    check('database key revision advances twice despite timestamp reuse and revision overwrite',changed.revision===currentRecoveryReview.keyRevision+2&&changed.updatedAt.toISOString()===currentRecoveryReview.keyUpdatedAt&&changed.maxLength===null,JSON.stringify({revision:changed.revision,expected:currentRecoveryReview.keyRevision,stamp:changed.updatedAt.toISOString(),expectedStamp:currentRecoveryReview.keyUpdatedAt,maxLength:changed.maxLength}));
    await lockDeletionRecovery(tx,recoveryScope);
  },{isolationLevel:'Serializable'});}catch(e){sameStampDenied=e.name==='RepositoryLocalError';}
  check('locked recovery rejects same timestamp restored metadata via database revision',sameStampDenied);
  check('rolled back key edits preserve reviewed revision',(await prisma.key.findUnique({where:{id:localKey.id}})).revision===currentRecoveryReview.keyRevision);
  for(const revision of [0,-1,1.5,2147483648,NaN]){let denied=false;try{await prisma.$transaction(tx=>lockDeletionRecovery(tx,{...recoveryScope,expectedKeyRevision:revision}),{isolationLevel:'Serializable'});}catch(e){denied=e.name==='RepositoryLocalError'&&e.kind==='unsupported';}check('locked recovery denies invalid key revision '+String(revision),denied);}
  const guardedRecovery=await prisma.$transaction(tx=>lockDeletionRecovery(tx,recoveryScope),{isolationLevel:'Serializable'});
  check('locked recovery revalidates current owner and candidate without write authority',guardedRecovery.eligible&&guardedRecovery.adminValidated&&guardedRecovery.canRestore===false);
  check('locked recovery accepts current project admin',(await prisma.$transaction(tx=>lockDeletionRecovery(tx,{...recoveryScope,actorId:admin.user.id}),{isolationLevel:'Serializable'})).adminValidated);
  const recoveryAdminGroup=await prisma.group.create({data:{teamId:project.teamId,name:'locked-recovery-admin',role:'ADMIN'}});
  await prisma.groupMember.create({data:{groupId:recoveryAdminGroup.id,userId:member.user.id}});
  const groupRecoveryScope={...recoveryScope,actorId:member.user.id};
  check('locked recovery accepts effective group admin',(await prisma.$transaction(tx=>lockDeletionRecovery(tx,groupRecoveryScope),{isolationLevel:'Serializable'})).adminValidated);
  for(const change of ['role','grant','team-member']){
    let denied=false;try{await prisma.$transaction(async tx=>{
      if(change==='role')await tx.group.update({where:{id:recoveryAdminGroup.id},data:{role:'MEMBER'}});
      if(change==='grant')await tx.groupMember.delete({where:{groupId_userId:{groupId:recoveryAdminGroup.id,userId:member.user.id}}});
      if(change==='team-member')await tx.teamMember.delete({where:{teamId_userId:{teamId:project.teamId,userId:member.user.id}}});
      await lockDeletionRecovery(tx,groupRecoveryScope);
    },{isolationLevel:'Serializable'});}catch(e){denied=e.name==='RepositoryLocalError'&&e.kind==='conflict';}
    check('locked recovery denies revoked group admin '+change,denied);
  }
  for(const resource of ['group-role','group-grant']){
    let ready,release;const held=new Promise(r=>ready=r),gate=new Promise(r=>release=r);
    const holding=prisma.$transaction(async tx=>{
      if(resource==='group-role')await tx.$queryRaw`SELECT id FROM groups WHERE id=${recoveryAdminGroup.id}::uuid FOR UPDATE`;
      else await tx.$queryRaw`SELECT "groupId" FROM group_members WHERE "groupId"=${recoveryAdminGroup.id}::uuid AND "userId"=${member.user.id}::uuid FOR UPDATE`;
      ready();await gate;
    },{timeout:10000});await held;
    let timedOut=false;try{await prisma.$transaction(tx=>lockDeletionRecovery(tx,groupRecoveryScope),{isolationLevel:'Serializable',timeout:5000});}catch(e){timedOut=e.code==='P2010'&&e.meta?.code==='55P03';}finally{release();await holding;}
    check('locked recovery actual '+resource+' contention fails closed',timedOut);
  }
  check('locked recovery group admin recovers after grant locks released',(await prisma.$transaction(tx=>lockDeletionRecovery(tx,groupRecoveryScope),{isolationLevel:'Serializable'})).eligible);
  let groupWriterRow,groupWriterActivity;
  try{await prisma.$transaction(async tx=>{
    await writeDeletionRecovery(tx,groupRecoveryScope);
    groupWriterRow=await tx.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}});
    groupWriterActivity=await tx.activityEvent.findFirst({where:{projectId:project.id,keyName:'local',actorId:member.user.id},orderBy:{createdAt:'desc'}});
    throw new Error('rollback group recovery writer');
  },{isolationLevel:'Serializable'});}catch(e){if(e.message!=='rollback group recovery writer')throw e;}
  check('effective group admin writer records correct actor and unverified value',groupWriterRow.value==='writer draft'&&groupWriterRow.status==='UNVERIFIED'&&groupWriterActivity.actorId===member.user.id&&groupWriterActivity.detail.auditId===audit.id);
  check('group admin writer rollback keeps absent value and deletion generation',!await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})&&await prisma.repositoryRemovalGeneration.count({where:{projectId:project.id,keyId:localKey.id,locale:'en',auditId:audit.id}})===1);
  await prisma.group.delete({where:{id:recoveryAdminGroup.id}});
  let generationChanged=false;try{await prisma.$transaction(async tx=>{await tx.repositoryRemovalGeneration.update({where:{projectId_keyId_locale:{projectId:project.id,keyId:localKey.id,locale:'en'}},data:{auditId:owner.user.id}});await lockDeletionRecovery(tx,recoveryScope);},{isolationLevel:'Serializable'});}catch(e){generationChanged=e.name==='RepositoryLocalError';}
  check('locked recovery rejects in-transaction generation replacement',generationChanged);
  let nonserialDenied=false;try{await prisma.$transaction(tx=>lockDeletionRecovery(tx,recoveryScope));}catch(e){nonserialDenied=e.message==='Deletion recovery requires serializable transaction';}
  check('locked recovery rejects default isolation',nonserialDenied);
  for(const [label,overrides] of [['member',{actorId:member.user.id}],['outsider',{actorId:outsider.user.id}],['wrong-project',{projectId:summaryOtherProject.id}],['stale-digest',{expectedValueDigest:'a'.repeat(64)}],['bad-digest',{expectedValueDigest:'bad'}]]){
    let denied=false;try{await prisma.$transaction(tx=>lockDeletionRecovery(tx,{...recoveryScope,...overrides}),{isolationLevel:'Serializable'});}catch(e){denied=e.name==='RepositoryLocalError';}
    check('locked recovery denies '+label,denied);
  }
  let revoked=false;try{await prisma.$transaction(async tx=>{await tx.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'MEMBER'}});await lockDeletionRecovery(tx,{...recoveryScope,actorId:admin.user.id});},{isolationLevel:'Serializable'});}catch(e){revoked=e.name==='RepositoryLocalError';}
  check('locked recovery denies current in-transaction admin revocation',revoked);
  for(const resource of ['project','audit','branch','key','locale','generation']){
    let acquired,release;const held=new Promise(r=>acquired=r),gate=new Promise(r=>release=r);
    const holding=prisma.$transaction(async tx=>{
      if(resource==='project')await tx.$queryRaw`SELECT id FROM projects WHERE id=${project.id}::uuid FOR UPDATE`;
      if(resource==='audit')await tx.$queryRaw`SELECT id FROM translation_deletion_audits WHERE id=${audit.id}::uuid FOR UPDATE`;
      if(resource==='branch')await tx.$queryRaw`SELECT id FROM branches WHERE id=${recovery.branchId}::uuid FOR UPDATE`;
      if(resource==='key')await tx.$queryRaw`SELECT id FROM keys WHERE id=${localKey.id}::uuid FOR UPDATE`;
      if(resource==='locale')await tx.$queryRaw`SELECT code FROM project_locales WHERE "projectId"=${project.id}::uuid AND code='en' FOR UPDATE`;
      if(resource==='generation')await tx.$queryRaw`SELECT "auditId" FROM repository_removal_generations WHERE "projectId"=${project.id}::uuid AND "keyId"=${localKey.id}::uuid AND locale='en' FOR UPDATE`;
      acquired();await gate;
    },{timeout:10000});await held;
    let timedOut=false;try{await prisma.$transaction(tx=>lockDeletionRecovery(tx,recoveryScope),{isolationLevel:'Serializable',timeout:5000});}catch(e){timedOut=e.code==='P2010'&&e.meta?.code==='55P03';}finally{release();await holding;}
    check('locked recovery actual '+resource+' blocker times out without success',timedOut);
  }
  check('locked recovery recovers after real locks released',(await prisma.$transaction(tx=>lockDeletionRecovery(tx,recoveryScope),{isolationLevel:'Serializable'})).eligible);
  check('locked recovery leaves actual audit and absent value unchanged',JSON.stringify(await prisma.translationDeletionAudit.findUnique({where:{id:audit.id}}))===recoveryBefore&&!await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}}));
  const recoveryCounts=async()=>({rows:await prisma.translation.count(),history:await prisma.translationHistory.count(),activity:await prisma.activityEvent.count(),tm:await prisma.tmEntry.count(),markers:await prisma.repositoryRemovalGeneration.count(),intents:await prisma.repositoryLocalEffectIntent.count()});
  const recoveryCountsBefore=await recoveryCounts();
  let rollbackWriterResult,rollbackRow,rollbackHistory,rollbackMarker;
  try{await prisma.$transaction(async tx=>{
    rollbackWriterResult=await writeDeletionRecovery(tx,recoveryScope);
    rollbackRow=await tx.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}});
    rollbackHistory=await tx.translationHistory.findMany({where:{keyId:localKey.id,localeCode:'en'}});
    rollbackMarker=await tx.repositoryRemovalGeneration.count({where:{projectId:project.id,keyId:localKey.id,locale:'en'}});
    throw new Error('rollback recovery writer fixture');
  },{isolationLevel:'Serializable'});}catch(e){if(e?.message!=='rollback recovery writer fixture')throw e;}
  check('isolated recovery writer creates fresh unverified row without stale provenance',rollbackRow.value==='writer draft'&&rollbackRow.rowId!==deletedRow.rowId&&rollbackRow.version===1&&rollbackRow.status==='UNVERIFIED'&&rollbackRow.mtScore===null&&rollbackRow.mtProvider===null&&rollbackRow.pluralForms===null);
  check('isolated recovery writes one new history event without replaying archive',rollbackHistory.length===1&&rollbackHistory[0].value==='writer draft'&&rollbackHistory[0].previousValue===null&&rollbackHistory[0].changedById===owner.user.id&&rollbackMarker===0&&rollbackWriterResult.historyReplayed===false&&rollbackWriterResult.repositoryEffectsCreated===false);
  check('recovery writer rollback restores absence marker counts and retained audit',JSON.stringify(await recoveryCounts())===JSON.stringify(recoveryCountsBefore)&&JSON.stringify(await prisma.translationDeletionAudit.findUnique({where:{id:audit.id}}))===recoveryBefore);
  // Dedicated non-base locale fixture proves a committed TM/history/activity path.
  const recoveryKey=await prisma.key.create({data:{projectId:project.id,branchId:localKey.branchId,name:'dedicated-recovery'}});
  await prisma.translation.create({data:{projectId:project.id,keyId:recoveryKey.id,localeCode:'en',value:'Recovery source'}});
  const recoveryArchive=await prisma.translationDeletionAudit.create({data:{projectId:project.id,keyId:recoveryKey.id,keyName:recoveryKey.name,localeCode:'he',snapshot:{row:{projectId:project.id,keyId:recoveryKey.id,localeCode:'he',value:'Recovered target',status:'REVIEWED',mtProvider:'old-provider',mtScore:99},history:[]}}});
  await prisma.repositoryRemovalGeneration.create({data:{projectId:project.id,keyId:recoveryKey.id,locale:'he',auditId:recoveryArchive.id}});
  const committedRecoveryScope={...recoveryScope,auditId:recoveryArchive.id,expectedKeyUpdatedAt:recoveryKey.updatedAt.toISOString(),expectedKeyRevision:recoveryKey.revision,expectedValueDigest:createHash('sha256').update('Recovered target').digest('hex')};
  // Actual lock waits let caller code mutate its scope after entry. Both guard and
  // writer must preserve their entry bindings across asynchronous boundaries.
  const mutableScopeClient=new PrismaClient({datasources:{db:{url:url+'?application_name=recovery-mutable-scope'}}});
  for(const operation of ['guard','writer']){
    let ready,release;const held=new Promise(r=>ready=r),gate=new Promise(r=>release=r);
    const holding=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM projects WHERE id=${project.id}::uuid FOR UPDATE`;ready();await gate;},{timeout:10000});await held;
    const mutableScope={...committedRecoveryScope};let capturedResult,capturedRow,capturedActivity;
    const pending=mutableScopeClient.$transaction(async tx=>{
      if(operation==='guard')capturedResult=await lockDeletionRecovery(tx,mutableScope);
      else{
        capturedResult=await writeDeletionRecovery(tx,mutableScope);
        capturedRow=await tx.translation.findUnique({where:{keyId_localeCode:{keyId:recoveryKey.id,localeCode:'he'}}});
        capturedActivity=await tx.activityEvent.findFirst({where:{projectId:project.id,keyName:recoveryKey.name},orderBy:{createdAt:'desc'}});
      }
      throw new Error('rollback immutable scope fixture');
    },{isolationLevel:'Serializable',timeout:7000}).then(()=>({ok:false}),e=>({ok:e.message==='rollback immutable scope fixture',error:e}));
    let observedWait=false;for(let n=0;n<60;n++){
      const wait=await prisma.$queryRaw`SELECT wait_event_type FROM pg_stat_activity WHERE application_name='recovery-mutable-scope' AND state='active' AND wait_event_type='Lock'`;
      if(wait.length){observedWait=true;break;}await new Promise(r=>setTimeout(r,20));
    }
    Object.assign(mutableScope,{projectId:summaryOtherProject.id,actorId:outsider.user.id,auditId:audit.id,expectedBranchId:owner.user.id,expectedKeyRevision:0,expectedKeyUpdatedAt:'2020-01-01T00:00:00.000Z',expectedValueDigest:'a'.repeat(64)});
    release();await holding;const outcome=await pending;
    check('actual recovery '+operation+' caller mutation waits on PostgreSQL lock',observedWait);
    check('recovery '+operation+' preserves entry scope across caller mutation',outcome.ok&&(operation==='guard'?capturedResult.auditId===recoveryArchive.id&&capturedResult.keyId===recoveryKey.id:capturedRow.projectId===project.id&&capturedRow.value==='Recovered target'&&capturedActivity.actorId===owner.user.id&&capturedActivity.detail.auditId===recoveryArchive.id));
    check('recovery '+operation+' scope-mutation rollback keeps absence and archive',!await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:recoveryKey.id,localeCode:'he'}}})&&await prisma.repositoryRemovalGeneration.count({where:{projectId:project.id,keyId:recoveryKey.id,locale:'he',auditId:recoveryArchive.id}})===1&&await prisma.translationDeletionAudit.count({where:{id:recoveryArchive.id}})===1);
  }
  await mutableScopeClient.$disconnect();
  const preFaultRecoveryCounts=await recoveryCounts();let recoveryFault=false;
  try{await prisma.$transaction(tx=>writeDeletionRecovery({...tx,activityEvent:{...tx.activityEvent,create:async()=>{throw new Error('injected recovery activity failure');}}},committedRecoveryScope),{isolationLevel:'Serializable'});}catch(e){recoveryFault=e.message==='injected recovery activity failure';}
  check('actual recovery storage fault rolls back row history TM and marker',recoveryFault&&JSON.stringify(await recoveryCounts())===JSON.stringify(preFaultRecoveryCounts)&&!await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:recoveryKey.id,localeCode:'he'}}})&&await prisma.repositoryRemovalGeneration.count({where:{projectId:project.id,keyId:recoveryKey.id,locale:'he',auditId:recoveryArchive.id}})===1);
  const committedRecovery=await prisma.$transaction(tx=>writeDeletionRecovery(tx,committedRecoveryScope),{isolationLevel:'Serializable'});
  check('committed recovery populates actual translation memory pair',(await prisma.tmEntry.findFirst({where:{projectId:project.id,sourceText:'Recovery source',localeCode:'he'}}))?.targetText==='Recovered target');
  const recoveredActivity=await prisma.activityEvent.findFirst({where:{projectId:project.id,keyName:recoveryKey.name},orderBy:{createdAt:'desc'}});
  check('committed recovery retains archive and writes safe new activity',await prisma.translationDeletionAudit.count({where:{id:recoveryArchive.id}})===1&&recoveredActivity.detail.source==='internal-deletion-recovery'&&recoveredActivity.detail.auditId===recoveryArchive.id&&!JSON.stringify(recoveredActivity.detail).includes('Recovered target')&&committedRecovery.remoteWritten===false&&committedRecovery.baselineAdvanced===false);
  let repeatedRecoveryDenied=false;try{await prisma.$transaction(tx=>writeDeletionRecovery(tx,committedRecoveryScope),{isolationLevel:'Serializable'});}catch(e){repeatedRecoveryDenied=e.name==='RepositoryLocalError';}
  check('recovery repeated attempt never overwrites committed row',repeatedRecoveryDenied&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:recoveryKey.id,localeCode:'he'}}})).rowId===committedRecovery.rowId&&await prisma.translationHistory.count({where:{keyId:recoveryKey.id,localeCode:'he'}})===1);
  await prisma.key.delete({where:{id:recoveryKey.id}});await prisma.translationDeletionAudit.delete({where:{id:recoveryArchive.id}});await prisma.activityEvent.deleteMany({where:{projectId:project.id,keyName:recoveryKey.name}});await prisma.tmEntry.deleteMany({where:{projectId:project.id,sourceText:'Recovery source'}});
  const raceClient=new PrismaClient({datasources:{db:{url:url+'?application_name=recovery-race-waiter'}}});
  for(const raceKind of ['two-recoveries','normal-create']){
    const raceKey=await prisma.key.create({data:{projectId:project.id,branchId:localKey.branchId,name:'recovery-race-'+raceKind}});
    const raceAudit=await prisma.translationDeletionAudit.create({data:{projectId:project.id,keyId:raceKey.id,keyName:raceKey.name,localeCode:'he',snapshot:{row:{projectId:project.id,keyId:raceKey.id,localeCode:'he',value:'Recovery race value'},history:[]}}});
    await prisma.repositoryRemovalGeneration.create({data:{projectId:project.id,keyId:raceKey.id,locale:'he',auditId:raceAudit.id}});
    const raceScope={...recoveryScope,auditId:raceAudit.id,expectedKeyUpdatedAt:raceKey.updatedAt.toISOString(),expectedKeyRevision:raceKey.revision,expectedValueDigest:createHash('sha256').update('Recovery race value').digest('hex')};
    let ready,release;const held=new Promise(r=>ready=r),gate=new Promise(r=>release=r);
    const first=prisma.$transaction(async tx=>{
      let result;
      if(raceKind==='two-recoveries')result=await writeDeletionRecovery(tx,raceScope);
      else result=await tx.translation.create({data:{projectId:project.id,keyId:raceKey.id,localeCode:'he',value:'Concurrent normal value'}});
      ready();await gate;return result;
    },{isolationLevel:'Serializable',timeout:10000});await held;
    const second=raceClient.$transaction(tx=>writeDeletionRecovery(tx,raceScope),{isolationLevel:'Serializable',timeout:7000}).then(v=>({ok:true,value:v}),e=>({ok:false,error:e}));
    let observedWait=false;for(let n=0;n<60;n++){
      const wait=await prisma.$queryRaw`SELECT wait_event_type FROM pg_stat_activity WHERE application_name='recovery-race-waiter' AND state='active' AND wait_event_type='Lock'`;
      if(wait.length){observedWait=true;break;}await new Promise(r=>setTimeout(r,20));
    }
    release();const firstResult=await first,secondResult=await second;
    const raceRow=await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:raceKey.id,localeCode:'he'}}});
    const raceHistory=await prisma.translationHistory.count({where:{keyId:raceKey.id,localeCode:'he'}});
    const raceActivities=await prisma.activityEvent.count({where:{projectId:project.id,keyName:raceKey.name}});
    check('actual '+raceKind+' contender waits on PostgreSQL lock',observedWait);
    check('actual '+raceKind+' stale transaction cannot report recovery success',!secondResult.ok&&(raceKind==='two-recoveries'?(secondResult.error.code==='P2034'||(secondResult.error.code==='P2010'&&secondResult.error.meta?.code==='40001')):(secondResult.error.code==='P2002'&&JSON.stringify(secondResult.error.meta?.target)===JSON.stringify(['keyId','localeCode']))));
    check('actual '+raceKind+' keeps winning value and one row identity',raceRow.value===(raceKind==='two-recoveries'?'Recovery race value':'Concurrent normal value')&&raceRow.rowId===firstResult.rowId&&raceHistory===(raceKind==='two-recoveries'?1:0)&&raceActivities===(raceKind==='two-recoveries'?1:0));
    check('actual '+raceKind+' preserves archive and expected marker state',await prisma.translationDeletionAudit.count({where:{id:raceAudit.id}})===1&&await prisma.repositoryRemovalGeneration.count({where:{projectId:project.id,keyId:raceKey.id,locale:'he'}})===(raceKind==='two-recoveries'?0:1));
    await prisma.key.delete({where:{id:raceKey.id}});await prisma.translationDeletionAudit.delete({where:{id:raceAudit.id}});await prisma.activityEvent.deleteMany({where:{projectId:project.id,keyName:raceKey.name}});
  }
  await raceClient.$disconnect();
  const auditMetadata=await call(deletionAuditsPath,{jwt});
  const listedAudit=auditMetadata.json.audits.find(a=>a.id===audit.id);
  check('actual removed locale audit metadata appears without snapshot or restoration claim',auditMetadata.status===200&&listedAudit?.keyId===localKey.id&&listedAudit.keyName==='local'&&listedAudit.localeCode==='en'&&listedAudit.actorId===owner.user.id&&Object.keys(listedAudit).sort().join(',')==='actorId,createdAt,id,keyId,keyName,localeCode'&&auditMetadata.json.snapshotIncluded===false&&auditMetadata.json.canRestore===false&&!JSON.stringify(auditMetadata.json).includes('writer draft'));
  const auditHeaders=await fetch(API+deletionAuditsPath,{headers:{Authorization:'Bearer '+jwt}});check('deletion audit metadata is no-store',auditHeaders.headers.get('cache-control')==='no-store');await auditHeaders.arrayBuffer();
  const foreignAudit=await prisma.translationDeletionAudit.create({data:{projectId:summaryOtherProject.id,keyId:localKey.id,keyName:'foreign-private',localeCode:'en',snapshot:{value:'foreign-private'}}});
  check('deletion audit metadata cannot cross project boundary',!(await call(deletionAuditsPath,{jwt})).json.audits.some(a=>a.id===foreignAudit.id));
  const auditFixture=await Promise.all(Array.from({length:55},(_,i)=>prisma.translationDeletionAudit.create({data:{projectId:project.id,keyId:localKey.id,keyName:'bounded-'+i,localeCode:'en',snapshot:{value:'never-list-private'},createdAt:new Date('2099-01-01')}})));
  const boundedAudits=(await call(deletionAuditsPath,{jwt})).json.audits;
  check('deletion audit metadata bounded50 with stable newest tie order',boundedAudits.length===50&&boundedAudits.every((a,i)=>a.createdAt==='2099-01-01T00:00:00.000Z'&&(!i||boundedAudits[i-1].id>a.id))&&!JSON.stringify(boundedAudits).includes('never-list-private'));
  const firstAuditPage=(await call(deletionAuditsPath,{jwt})).json;
  const secondAuditPage=(await call(deletionAuditsPath+'?cursor='+firstAuditPage.nextCursor,{jwt})).json;
  const allAuditIds=[...firstAuditPage.audits,...secondAuditPage.audits].map(a=>a.id);
  check('audit cursor covers tied timestamps and older rows without duplicates',firstAuditPage.nextCursor&&secondAuditPage.nextCursor===null&&secondAuditPage.audits.length>=6&&new Set(allAuditIds).size===allAuditIds.length&&auditFixture.every(a=>allAuditIds.includes(a.id))&&allAuditIds.includes(audit.id));
  check('older audit page preserves exact metadata privacy flags',secondAuditPage.snapshotIncluded===false&&secondAuditPage.canRestore===false&&secondAuditPage.audits.every(a=>Object.keys(a).sort().join(',')==='actorId,createdAt,id,keyId,keyName,localeCode')&&!JSON.stringify(secondAuditPage).includes('never-list-private'));
  const malformedAuditCursors=['','!!','A'.repeat(161),Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify(['bad','00000000-0000-0000-0000-000000000000'])).toString('base64url'),Buffer.from(JSON.stringify(['2099-01-01T00:00:00.000Z','not-uuid'])).toString('base64url'),firstAuditPage.nextCursor+'=',Buffer.from(JSON.stringify(['2099-01-01T00:00:00.000Z','00000000-0000-0000-0000-000000000000','extra'])).toString('base64url')];
  for(const [i,cursor] of malformedAuditCursors.entries())check('audit cursor malformed input denied '+i,(await call(deletionAuditsPath+'?cursor='+encodeURIComponent(cursor),{jwt})).status===400);
  check('audit cursor repeated parameter denied',(await call(deletionAuditsPath+'?cursor='+firstAuditPage.nextCursor+'&cursor='+firstAuditPage.nextCursor,{jwt})).status===400);
  check('audit cursor cannot grant another project membership',(await call(deletionAuditsPath+'?cursor='+firstAuditPage.nextCursor,{jwt:outsider.accessToken})).status===404);
  const otherAuditPage=(await call(`/projects/${summaryOtherProject.id}/sync/deletion-audits?cursor=${firstAuditPage.nextCursor}`,{jwt})).json;
  check('audit cursor remains scoped to requested project',otherAuditPage.audits.every(a=>a.id===foreignAudit.id)&&!otherAuditPage.audits.some(a=>auditFixture.some(f=>f.id===a.id)));
  const boundaryPair=JSON.parse(Buffer.from(firstAuditPage.nextCursor,'base64url').toString());
  await prisma.translationDeletionAudit.delete({where:{id:boundaryPair[1]}});
  const afterBoundaryDelete=(await call(deletionAuditsPath+'?cursor='+firstAuditPage.nextCursor,{jwt})).json;
  check('audit cursor continues when boundary row deleted',JSON.stringify(afterBoundaryDelete)===JSON.stringify(secondAuditPage));
  await prisma.translationDeletionAudit.create({data:auditFixture.find(a=>a.id===boundaryPair[1])});
  const newerAudit=await prisma.translationDeletionAudit.create({data:{projectId:project.id,keyId:localKey.id,keyName:'newer-page',localeCode:'en',snapshot:{value:'private-newer'},createdAt:new Date('2100-01-01')}});
  check('newer concurrent audit does not shift older cursor page',JSON.stringify((await call(deletionAuditsPath+'?cursor='+firstAuditPage.nextCursor,{jwt})).json)===JSON.stringify(secondAuditPage));
  await prisma.translationDeletionAudit.delete({where:{id:newerAudit.id}});
  const terminalCursor=Buffer.from(JSON.stringify(['1900-01-01T00:00:00.000Z','00000000-0000-0000-0000-000000000000'])).toString('base64url');
  const terminalPage=(await call(deletionAuditsPath+'?cursor='+terminalCursor,{jwt})).json;
  check('audit cursor beyond oldest returns empty terminal page',terminalPage.audits.length===0&&terminalPage.nextCursor===null);
  check('deletion audit metadata reads never mutate retained snapshots',await prisma.translationDeletionAudit.count({where:{id:{in:auditFixture.map(a=>a.id)}}})===55&&(await prisma.translationDeletionAudit.findUnique({where:{id:auditFixture[0].id}})).snapshot.value==='never-list-private');
  await prisma.translationDeletionAudit.deleteMany({where:{id:{in:[foreignAudit.id,...auditFixture.map(a=>a.id)]}}});

  // Capture the real Prisma-emitted metadata page SQL,not a hand-written analogue.
  const auditBundle=join(root,'.tmp-audit-page.cjs');
  execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/sync-preview.controller.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+auditBundle]);
  const {LocalSyncPreviewService:AuditPageService}=require(auditBundle);
  const authBundle=join(root,'.tmp-recovery-auth.cjs');
  execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/projects/projects.service.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+authBundle]);
  const {ProjectsService:RecoveryProjectsService}=require(authBundle);
  const recoveryProjects=new RecoveryProjectsService(prisma,{});
  const recoveryAuthService=new AuditPageService(prisma,recoveryProjects,{});
  const adminPrincipal={via:'jwt',userId:admin.user.id};
  check('snapshot recovery auth accepts direct admin',(await recoveryAuthService.previewDeletionRecovery(adminPrincipal,project.id,audit.id)).eligibleNow===true);
  for(const mode of ['demote','remove']){
    const interleavedProjects={
      requireAdmin:async(userId,projectId)=>{
        await recoveryProjects.requireAdmin(userId,projectId);
        if(mode==='demote')await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'MEMBER'}});
        else await prisma.teamMember.delete({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}}});
      },
      requireAdminInTransaction:(...args)=>recoveryProjects.requireAdminInTransaction(...args),
    };
    let denied=false;try{await new AuditPageService(prisma,interleavedProjects,{}).previewDeletionRecovery(adminPrincipal,project.id,audit.id);}catch(e){denied=e.getStatus?.()===(mode==='demote'?403:404);}
    check('recovery snapshot denies committed admin '+mode+' after successful preflight',denied);
    await prisma.teamMember.upsert({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},create:{teamId:project.teamId,userId:admin.user.id,role:'ADMIN'},update:{role:'ADMIN'}});
  }
  const groupGrant=await prisma.group.create({data:{teamId:project.teamId,name:'recovery-snapshot-admin',role:'ADMIN'}});
  await prisma.groupMember.create({data:{groupId:groupGrant.id,userId:member.user.id}});
  const groupPrincipal={via:'jwt',userId:member.user.id};
  check('snapshot recovery auth preserves effective group admin',(await recoveryAuthService.previewDeletionRecovery(groupPrincipal,project.id,audit.id)).eligibleNow===true);
  const revokedGroupProjects={requireAdmin:async(userId,projectId)=>{await recoveryProjects.requireAdmin(userId,projectId);await prisma.groupMember.delete({where:{groupId_userId:{groupId:groupGrant.id,userId:member.user.id}}});},requireAdminInTransaction:(...args)=>recoveryProjects.requireAdminInTransaction(...args)};
  let groupDenied=false;try{await new AuditPageService(prisma,revokedGroupProjects,{}).previewDeletionRecovery(groupPrincipal,project.id,audit.id);}catch(e){groupDenied=e.getStatus?.()===403;}
  check('recovery snapshot denies committed group grant removal after preflight',groupDenied);
  await prisma.group.delete({where:{id:groupGrant.id}});
  check('snapshot audit page auth accepts direct admin',(await recoveryAuthService.listDeletionAudits(adminPrincipal,project.id)).audits.some(a=>a.id===audit.id));
  for(const mode of ['demote','remove']){
    const interleavedProjects={requireAdmin:async(userId,projectId)=>{
      await recoveryProjects.requireAdmin(userId,projectId);
      if(mode==='demote')await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'MEMBER'}});
      else await prisma.teamMember.delete({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}}});
    },requireAdminInTransaction:(...args)=>recoveryProjects.requireAdminInTransaction(...args)};
    let denied=false;try{await new AuditPageService(prisma,interleavedProjects,{}).listDeletionAudits(adminPrincipal,project.id);}catch(e){denied=e.getStatus?.()===(mode==='demote'?403:404);}
    check('audit page snapshot denies committed admin '+mode+' after successful preflight',denied);
    await prisma.teamMember.upsert({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},create:{teamId:project.teamId,userId:admin.user.id,role:'ADMIN'},update:{role:'ADMIN'}});
  }
  const pageGroup=await prisma.group.create({data:{teamId:project.teamId,name:'audit-page-snapshot-admin',role:'ADMIN'}});
  await prisma.groupMember.create({data:{groupId:pageGroup.id,userId:member.user.id}});
  check('snapshot audit page auth preserves effective group admin',(await recoveryAuthService.listDeletionAudits(groupPrincipal,project.id)).audits.some(a=>a.id===audit.id));
  const revokedPageGroupProjects={requireAdmin:async(userId,projectId)=>{await recoveryProjects.requireAdmin(userId,projectId);await prisma.groupMember.delete({where:{groupId_userId:{groupId:pageGroup.id,userId:member.user.id}}});},requireAdminInTransaction:(...args)=>recoveryProjects.requireAdminInTransaction(...args)};
  let pageGroupDenied=false;try{await new AuditPageService(prisma,revokedPageGroupProjects,{}).listDeletionAudits(groupPrincipal,project.id);}catch(e){pageGroupDenied=e.getStatus?.()===403;}
  check('audit page snapshot denies committed group grant removal after preflight',pageGroupDenied);
  await prisma.group.delete({where:{id:pageGroup.id}});rmSync(authBundle,{force:true});
  const auditPlanClient=new PrismaClient({datasources:{db:{url}},log:[{emit:'event',level:'query'}]});
  const {default:auditPg}=await import('pg');
  const auditExplainClient=new auditPg.Client({connectionString:url});await auditExplainClient.connect();
  let actualPageQuery;
  auditPlanClient.$on('query',e=>{if(e.query.includes('translation_deletion_audits')&&e.query.startsWith('SELECT'))actualPageQuery=e;});
  const pageService=new AuditPageService(auditPlanClient,new RecoveryProjectsService(auditPlanClient,{}),{});
  await prisma.$executeRaw`INSERT INTO translation_deletion_audits (id,"projectId","keyId","keyName","localeCode",snapshot,"createdAt") SELECT md5('audit-page-'||i)::uuid,CASE WHEN i%2=0 THEN ${project.id}::uuid ELSE ${summaryOtherProject.id}::uuid END,${localKey.id}::uuid,'plan fixture','en','{"value":"plan-private"}'::jsonb,'2098-01-01'::timestamp+(i%3)*interval '1 second' FROM generate_series(1,20000) i`;
  await prisma.$executeRaw`ANALYZE translation_deletion_audits`;
  const explainActualPage=async(cursor)=>{
    await pageService.listDeletionAudits({via:'jwt',userId:owner.user.id},project.id,cursor);
    const emitted=actualPageQuery;
    return (await auditExplainClient.query('EXPLAIN (ANALYZE,FORMAT JSON) '+emitted.query,JSON.parse(emitted.params))).rows;
  };
  const firstPagePlan=await explainActualPage();
  const deepCursor=Buffer.from(JSON.stringify(['2098-01-01T00:00:00.000Z','80000000-0000-0000-0000-000000000000'])).toString('base64url');
  const olderPagePlan=await explainActualPage(deepCursor);
  for(const [label,plan] of [['first',firstPagePlan],['older',olderPagePlan]])check('actual Prisma audit '+label+' page uses project timestamp UUID index without sort',JSON.stringify(plan).includes('translation_deletion_audits_projectId_createdAt_id_idx')&&!JSON.stringify(plan).includes('"Node Type":"Sort"'));
  await auditExplainClient.end();await auditPlanClient.$disconnect();rmSync(auditBundle,{force:true});
  await prisma.translationDeletionAudit.deleteMany({where:{keyName:'plan fixture'}});

  const canonicalAudit=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
  check('locale removal archives exact row and full ordered history atomically',removed.removedValues===1&&canonicalAudit(audit.snapshot.row)===canonicalAudit(JSON.parse(JSON.stringify(deletedRow)))&&canonicalAudit(audit.snapshot.history)===canonicalAudit(JSON.parse(JSON.stringify(deletedHistory)))&&audit.actorId===owner.user.id&&audit.keyName==='local');
  check('locale removal deletes only selected translation not key or another locale',!await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})&&!!await prisma.key.findUnique({where:{id:localKey.id}})&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'he'}}})).value==='other locale preserved');
  await prisma.translation.create({data:{keyId:localKey.id,projectId:project.id,localeCode:'en',value:'writer draft',version:deletedRow.version+1}});
  check('public recovery preview rejects recreated value without exposing it',(await call(recoveryPreviewPath,{jwt})).json.reason==='value-exists');
  check('internal recovery denies overwriting recreated locale value',(await inspectDeletionRecovery(prisma,project.id,audit.id)).reason==='value-exists');
  check('deletion audit survives recreation with new row identity',await prisma.translationDeletionAudit.count({where:{id:audit.id}})===1&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}}})).rowId!==deletedRow.rowId);
  const boundedKey=await prisma.key.create({data:{projectId:project.id,branchId:storedLocalKey.branchId,name:'audit-bound'}});
  await prisma.translation.create({data:{keyId:boundedKey.id,projectId:project.id,localeCode:'en',value:'archive me'}});
  await prisma.translationHistory.createMany({data:Array.from({length:1001},()=>({keyId:boundedKey.id,localeCode:'en',value:'historic',status:'UNVERIFIED',changedById:owner.user.id}))});
  let boundSnapshot=(await repositoryPreview()).json.localPreconditions;
  const boundedRemove={key:'audit-bound',action:'remove-locale-value',expectedValue:'archive me',nextValue:null};
  let rejectedBound=false;try{await prisma.$transaction(tx=>writeExistingLocalValues(tx,boundSnapshot,[boundedRemove],owner.user.id),{isolationLevel:'Serializable'});}catch(e){rejectedBound=e.message.includes('history exceeds bounds');}
  check('over-bound removal preserves full live row history without partial audit',rejectedBound&&await prisma.translationHistory.count({where:{keyId:boundedKey.id,localeCode:'en'}})===1001&&!!await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:boundedKey.id,localeCode:'en'}}})&&await prisma.translationDeletionAudit.count({where:{keyId:boundedKey.id}})===0);
  await prisma.translationHistory.deleteMany({where:{keyId:boundedKey.id}});await prisma.translationHistory.create({data:{keyId:boundedKey.id,localeCode:'en',value:'x'.repeat(530000),status:'UNVERIFIED'}});boundSnapshot=(await repositoryPreview()).json.localPreconditions;
  let rejectedBytes=false;try{await prisma.$transaction(tx=>writeExistingLocalValues(tx,boundSnapshot,[boundedRemove],owner.user.id),{isolationLevel:'Serializable'});}catch(e){rejectedBytes=e.message.includes('bytes exceed bounds');}
  check('over-byte removal refuses truncation and preserves row',rejectedBytes&&!!await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:boundedKey.id,localeCode:'en'}}})&&await prisma.translationDeletionAudit.count({where:{keyId:boundedKey.id}})===0);
  await prisma.translationHistory.deleteMany({where:{keyId:boundedKey.id}});boundSnapshot=(await repositoryPreview()).json.localPreconditions;
  await prisma.$transaction(tx=>writeExistingLocalValues(tx,boundSnapshot,[boundedRemove],owner.user.id),{isolationLevel:'Serializable'});
  await prisma.key.delete({where:{id:boundedKey.id}});
  check('durable deletion audit survives deletion of original key',await prisma.translationDeletionAudit.count({where:{keyId:boundedKey.id}})===1);
  check('deleted key audit remains discoverable by metadata API',(await call(deletionAuditsPath,{jwt})).json.audits.some(a=>a.keyId===boundedKey.id&&a.keyName==='audit-bound'));
  await prisma.key.delete({where:{id:emptyKey.id}});
  await prisma.translation.update({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}},data:{value:'edited',version:{increment:1}}});
  resolvedRepositoryPlan.json=(await repositoryPreview()).json;
  check('repository resolution carries comparison provenance not apply authority',repositoryDraft.json.source==='explicit-repository-preview-resolution'&&repositoryDraft.json.baselineVersion===2&&repositoryDraft.json.targetId===target.id&&repositoryDraft.json.baselineVerified===true&&repositoryDraft.json.remoteVerified===true&&repositoryDraft.json.canApply===false&&repositoryDraft.json.localTranslationsChanged===false&&repositoryDraft.json.remoteWritten===false);
  const absentRepositoryDraft=await resolveRepository({choices:{...repositoryChoices,fromRepo:'local'}});
  check('explicit repository absence omits only draft key',absentRepositoryDraft.status===201&&!Object.hasOwn(JSON.parse(absentRepositoryDraft.json.json),'fromRepo')&&absentRepositoryDraft.json.absentKeys>0);
  check('repository resolution ignores forged caller file and actor values',(await resolveRepository({baselineJson:'{}',remoteJson:'{}',localJson:'{}',actorId:outsider.user.id})).json.json===repositoryDraft.json.json);
  check('repository resolution rejects missing extra invalid choices',(await resolveRepository({choices:{}})).status===400&&(await resolveRepository({choices:{...repositoryChoices,extra:'local'}})).status===400&&(await resolveRepository({choices:{...repositoryChoices,fromRepo:'auto'}})).status===400);
  check('repository resolution validates expected fingerprint and revision',(await resolveRepository({expectedFingerprint:'bad'})).status===400&&(await resolveRepository({expectedRevision:undefined})).status===400);
  repoText='{"fromRepo":"unreviewed change"}';check('repository resolution rejects fresh remote mismatch',(await resolveRepository()).status===409);repoText='{"fromRepo":"verified bytes"}';
  await prisma.translation.update({where:{keyId_localeCode:{keyId:localKey.id,localeCode:'en'}},data:{version:{increment:1}}});
  check('repository resolution rejects changed local row generation',(await resolveRepository()).status===409);
  const freshForResolve=await repositoryPreview();resolvedRepositoryPlan.json=freshForResolve.json;
  await prisma.repositorySyncBaseline.update({where:{targetId:target.id},data:{version:3}});
  check('repository resolution rejects changed accepted baseline',(await resolveRepository()).status===409);await prisma.repositorySyncBaseline.update({where:{targetId:target.id},data:{version:2}});
  const deniedResolveCalls=repoCalls;
  check('repository resolve member outsider stale target denied before network',(await resolveRepository({},member.accessToken)).status===403&&(await resolveRepository({},outsider.accessToken)).status===404&&(await resolveRepository({expectedRevision:1})).status===409&&repoCalls===deniedResolveCalls);
  check('repository resolve API token denied before network',(await call(`${T}/${target.id}/resolve-preview`,{apiKey:token.token,method:'POST',body:{expectedRevision:2,expectedFingerprint:freshForResolve.json.fingerprint,choices:repositoryChoices}})).status===403&&repoCalls===deniedResolveCalls);
  repoGate=new Promise(r=>releaseRepo=r);const resolveRequested=new Promise(r=>repoSeen=r);const heldResolve=resolveRepository();await resolveRequested;
  await prisma.repositorySyncBaseline.update({where:{targetId:target.id},data:{version:3}});releaseRepo();
  check('baseline replacement during resolve suppresses stale draft',(await heldResolve).status===409);repoGate=undefined;repoSeen=undefined;await prisma.repositorySyncBaseline.update({where:{targetId:target.id},data:{version:2}});
  repoGate=new Promise(r=>releaseRepo=r);const resolveTargetRequested=new Promise(r=>repoSeen=r);const heldResolveTarget=resolveRepository();await resolveTargetRequested;
  await prisma.repositorySyncTarget.update({where:{id:target.id},data:{revision:3}});releaseRepo();
  check('target replacement during resolve suppresses draft',(await heldResolveTarget).status===409);repoGate=undefined;repoSeen=undefined;await prisma.repositorySyncTarget.update({where:{id:target.id},data:{revision:2}});
  repoGate=new Promise(r=>releaseRepo=r);const resolveAdminRequested=new Promise(r=>repoSeen=r);const heldResolveAdmin=resolveRepository({},admin.accessToken);await resolveAdminRequested;
  await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'MEMBER'}});releaseRepo();
  check('lost admin during resolve suppresses draft disclosure',(await heldResolveAdmin).status===403);repoGate=undefined;repoSeen=undefined;await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'ADMIN'}});
  const resolveHeaders=await fetch(`${API}${T}/${target.id}/resolve-preview`,{method:'POST',headers:{Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:2,expectedFingerprint:freshForResolve.json.fingerprint,choices:repositoryChoices})});check('repository draft response is no-store',resolveHeaders.status===201&&resolveHeaders.headers.get('cache-control')==='no-store');await resolveHeaders.arrayBuffer();
  check('repository resolution never writes translations history or baseline',await prisma.syncPreviewRecord.count()===0&&JSON.stringify((await call(`${P}/export/en?flat=true`,{jwt})).json)===JSON.stringify(before)&&(await tc(baselinePath,'GET',undefined)).json.baseline.version===2&&(await tc(baselinePath,'GET',undefined)).json.baseline.text===repoText&&repoMethod==='GET');
  const beforeDenied=repoCalls;
  check('read rejects stale revision before network',(await readTarget({expectedRevision:1})).status===409&&repoCalls===beforeDenied);
  check('read denies member and outsider before network',(await readTarget({},member.accessToken)).status===403&&(await readTarget({},outsider.accessToken)).status===404&&repoCalls===beforeDenied);
  check('read denies API token before network',(await call(`${T}/${target.id}/read`,{apiKey:token.token,method:'POST',body:{expectedRevision:2}})).status===403&&repoCalls===beforeDenied);
  repoText='{"nested":{"x":"no"}}';check('repository read rejects nested JSON',(await readTarget()).status===502);repoText='{"fromRepo":"verified bytes"}';
  repoStatus=403;check('provider rejection sanitized without retries',(await readTarget()).status===502);repoStatus=200;
  const mismatched=await tc(T,'POST',{...coordinates,localBranch:'feature',repo:'unconfigured'});const countBeforeMissing=repoCalls;
  check('unconfigured repository scope returns503 without caller credential fallback',(await tc(`${T}/${mismatched.json.target.id}/read`,'POST',{expectedRevision:1,token:'caller-token'})).status===503&&repoCalls===countBeforeMissing);
  await tc(`${T}/${mismatched.json.target.id}`,'DELETE',{expectedRevision:1});
  repoGate=new Promise(r=>releaseRepo=r);const requested=new Promise(r=>repoSeen=r);const heldRead=readTarget();await requested;
  const original=await prisma.repositorySyncTarget.findUnique({where:{id:target.id}});await prisma.repositorySyncTarget.update({where:{id:target.id},data:{revision:3}});releaseRepo();
  check('target change during remote read discards returned bytes',(await heldRead).status===409);repoGate=undefined;repoSeen=undefined;
  await prisma.repositorySyncTarget.update({where:{id:target.id},data:{revision:original.revision}});
  repoGate=new Promise(r=>releaseRepo=r);const requestedAdmin=new Promise(r=>repoSeen=r);const heldAdminRead=readTarget({},admin.accessToken);await requestedAdmin;
  await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'MEMBER'}});releaseRepo();
  check('lost admin grant during read suppresses file disclosure',(await heldAdminRead).status===403);repoGate=undefined;repoSeen=undefined;
  await prisma.teamMember.update({where:{teamId_userId:{teamId:project.teamId,userId:admin.user.id}},data:{role:'ADMIN'}});
  check('stale target replacement fails without overwrite',(await tc(`${T}/${target.id}`,'PUT',{...coordinates,expectedRevision:1})).status===409&&(await prisma.repositorySyncTarget.findUnique({where:{id:target.id}})).path==='updated/en.json');
  check('stale target deletion does not remove config',(await tc(`${T}/${target.id}`,'DELETE',{expectedRevision:1})).status===409&&!!await prisma.repositorySyncTarget.findUnique({where:{id:target.id}}));
  const concurrency=await Promise.all([tc(`${T}/${target.id}`,'PUT',{...coordinates,path:'one.json',expectedRevision:2}),tc(`${T}/${target.id}`,'PUT',{...coordinates,path:'two.json',expectedRevision:2})]);
  check('concurrent target updates have one revision winner',concurrency.filter(r=>r.status===200).length===1&&concurrency.filter(r=>r.status===409).length===1&&(await prisma.repositorySyncTarget.findUnique({where:{id:target.id}})).revision===3);
  check('coordinate update invalidates accepted baseline',await prisma.repositorySyncBaseline.findUnique({where:{targetId:target.id}})===null&&(await tc(baselinePath,'GET',undefined)).json.baseline===null);
  check('target mutation requires explicit revision',(await tc(`${T}/${target.id}`,'PUT',coordinates)).status===400&&(await tc(`${T}/${target.id}`,'DELETE',{})).status===400);
  check('target mutation rejects invalid revisions',(await tc(`${T}/${target.id}`,'DELETE',{expectedRevision:0})).status===400&&(await tc(`${T}/${target.id}`,'DELETE',{expectedRevision:1.5})).status===400);
  check('target locale and local branch must exist',(await tc(T,'POST',{...coordinates,locale:'zz'})).status===400&&(await tc(T,'POST',{...coordinates,localBranch:'missing'})).status===404);
  check('target rejects unsafe repository coordinates',(await tc(T,'POST',{...coordinates,path:'../secret'})).status===400&&(await tc(T,'POST',{...coordinates,remoteBranch:'bad branch'})).status===400&&(await tc(T,'POST',{...coordinates,owner:'https://evil.example'})).status===400);
  check('target member and outsider cannot read configuration',(await tc(T,'GET',undefined,member.accessToken)).status===403&&(await tc(T,'GET',undefined,outsider.accessToken)).status===404);
  check('target member cannot mutate configuration',(await tc(T,'POST',coordinates,member.accessToken)).status===403&&(await tc(`${T}/${target.id}`,'DELETE',{expectedRevision:3},member.accessToken)).status===403);
  check('API token cannot read or create target configuration',(await call(T,{apiKey:token.token})).status===403&&(await call(T,{apiKey:token.token,method:'POST',body:coordinates})).status===403);
  check('target admin can read configuration',(await tc(T,'GET',undefined,admin.accessToken)).status===200);
  const otherConfigProject=(await call('/projects',{jwt,method:'POST',body:{name:'Other target',slug:'other-target',locales:['en']}})).json;
  check('target id cannot cross project boundary',(await tc(`/projects/${otherConfigProject.id}/sync/repository-targets/${target.id}`,'PUT',{...coordinates,expectedRevision:3})).status===404&&(await tc(`/projects/${otherConfigProject.id}/sync/repository-targets/${target.id}`,'DELETE',{expectedRevision:3})).status===404);
  check('effect summary target cannot cross project boundary',(await tc(`/projects/${otherConfigProject.id}/sync/repository-targets/${target.id}/effects-summary`,'GET',undefined)).status===404);
  check('target list scoped by project',(await tc(`/projects/${otherConfigProject.id}/sync/repository-targets`,'GET',undefined)).json.targets.length===0);
  check('target deletion with current revision removes only configuration',(await tc(`${T}/${target.id}`,'DELETE',{expectedRevision:3})).status===200&&!(await prisma.repositorySyncTarget.findUnique({where:{id:target.id}}))&&JSON.stringify((await call(`${P}/export/en?flat=true`,{jwt})).json)===JSON.stringify(before));
  const featureTarget=await tc(T,'POST',{...coordinates,localBranch:'feature'});
  const featureBranch=await prisma.branch.findUnique({where:{projectId_name:{projectId:project.id,name:'feature'}}});
  await prisma.repositorySyncBaseline.create({data:{targetId:featureTarget.json.target.id,version:1,targetRevision:1,remoteSha:'a'.repeat(40),contentDigest:'b'.repeat(64),text:'{}',actorId:owner.user.id}});
  await prisma.branch.delete({where:{id:featureBranch.id}});
  check('branch deletion cascades accepted baseline bytes',await prisma.repositorySyncBaseline.findUnique({where:{targetId:featureTarget.json.target.id}})===null);
  check('branch deletion cascades config preventing name reuse from inheriting target',featureTarget.status===201&&!(await prisma.repositorySyncTarget.findUnique({where:{id:featureTarget.json.target.id}})));
  await call(`${P}/branches`,{jwt,method:'POST',body:{name:'feature'}});
  check('recreated branch has no inherited target',!(await tc(T,'GET',undefined)).json.targets.some(t=>t.localBranch==='feature'));
  check('target delete replay returns not found',(await tc(`${T}/${target.id}`,'DELETE',{expectedRevision:3})).status===404);
  const configMain=await prisma.branch.findUnique({where:{projectId_name:{projectId:otherConfigProject.id,name:'main'}}});
  await prisma.repositorySyncTarget.createMany({data:Array.from({length:100},(_,n)=>({projectId:otherConfigProject.id,branchId:configMain.id,localBranch:'b'+n,locale:'en',owner:'owner',repo:'repo',path:'en.json',remoteBranch:'main'}))});
  check('target cap rejects extra configuration without exceeding hundred',(await tc(`/projects/${otherConfigProject.id}/sync/repository-targets`,'POST',coordinates)).status===400&&await prisma.repositorySyncTarget.count({where:{projectId:otherConfigProject.id}})===100);
  check('target list is bounded to hundred',(await tc(`/projects/${otherConfigProject.id}/sync/repository-targets`,'GET',undefined)).json.targets.length===100);
  await prisma.repositorySyncTarget.deleteMany({where:{projectId:otherConfigProject.id,localBranch:'b99'}});
  await prisma.projectLocale.create({data:{projectId:otherConfigProject.id,code:'he'}});
  const capRace=await Promise.all(['en','he'].map(locale=>tc(`/projects/${otherConfigProject.id}/sync/repository-targets`,'POST',{...coordinates,locale})));
  check('concurrent target creates enforce project cap',capRace.filter(r=>r.status===201).length===1&&capRace.filter(r=>r.status===400).length===1&&await prisma.repositorySyncTarget.count({where:{projectId:otherConfigProject.id}})===100);
  const cascadeTarget=await prisma.repositorySyncTarget.findFirst({where:{projectId:otherConfigProject.id}});
  await prisma.repositorySyncBaseline.create({data:{targetId:cascadeTarget.id,version:1,targetRevision:1,remoteSha:'a'.repeat(40),contentDigest:'b'.repeat(64),text:'{}',actorId:owner.user.id}});
  await prisma.project.delete({where:{id:otherConfigProject.id}});
  check('project deletion cascades accepted baseline bytes',await prisma.repositorySyncBaseline.findUnique({where:{targetId:cascadeTarget.id}})===null);
  check('project removal cascades target metadata',await prisma.repositorySyncTarget.count({where:{projectId:otherConfigProject.id}})===0);
  check('target configuration did not persist diagnostics or local translation changes',await prisma.syncPreviewRecord.count()===0&&JSON.stringify((await call(`${P}/export/en?flat=true`,{jwt})).json)===JSON.stringify(before));
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

  // Isolated project queue, real overlapping claims. Earlier intents removed
  // only in this fixture so selection has a deterministic bounded candidate set.
  await prisma.repositoryLocalEffectIntent.deleteMany();
  const leaseProject=await prisma.project.create({data:{teamId:project.teamId,name:'Lease fixture',slug:'lease-fixture'}});
  const leaseData={projectId:leaseProject.id,targetId:target.id,actorId:owner.user.id,keyId:localKey.id,keyName:'lease-key',branchId:writeScope.branchId,branch:'main',locale:'en',operation:'set-value',value:'queued',draftContentDigest:composeDigest,previewFingerprint:composeFingerprint};
  await prisma.repositoryLocalEffectIntent.createMany({data:[leaseData,leaseData]});
  let claimsReady,releaseClaims;const claimsGate=new Promise(r=>releaseClaims=r),claimsStarted=new Promise(r=>claimsReady=r);let arrived=0;
  const leased=await Promise.all([0,1].map(()=>prisma.$transaction(async tx=>{const row=await claimRepositoryEffect(tx);if(++arrived===2)claimsReady();await claimsGate;return row;},{timeout:10000})).concat([(async()=>{await claimsStarted;releaseClaims();return null;})()]));
  const leases=leased.filter(Boolean);
  check('concurrent queue claimers lock disjoint intents',leases.length===2&&leases[0].id!==leases[1].id&&leases.every(r=>r.state==='leased'&&r.attempts===1&&r.leaseToken&&r.leaseUntil));
  check('active leases cannot be claimed again',await prisma.$transaction(claimRepositoryEffect)===null);
  const firstLease=leases[0],secondLease=leases[1];
  check('wrong worker token cannot settle a live lease',!await prisma.$transaction(tx=>settleRepositoryEffect(tx,firstLease.id,secondLease.leaseToken,'completed')));
  const settlementWaiter=new PrismaClient({datasources:{db:{url:url+'?application_name=repository-settlement-waiter'}}});
  for(const mutation of ['token','deadline','timeout']) {
    await prisma.repositoryLocalEffectIntent.update({where:{id:firstLease.id},data:{leaseToken:firstLease.leaseToken,leaseUntil:new Date('2099-01-01')}});
    let locked,release;const ready=new Promise(r=>locked=r),gate=new Promise(r=>release=r);
    const blocker=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM repository_local_effect_intents WHERE id=${firstLease.id}::uuid FOR UPDATE`;locked();await gate;
      if(mutation==='token')await tx.repositoryLocalEffectIntent.update({where:{id:firstLease.id},data:{leaseToken:secondLease.leaseToken}});
      if(mutation==='deadline')await tx.repositoryLocalEffectIntent.update({where:{id:firstLease.id},data:{leaseUntil:new Date('2020-01-01')}});
    },{timeout:10000});await ready;
    let error;const start=Date.now();
    const attempt=settlementWaiter.$transaction(tx=>settleRepositoryEffect(tx,firstLease.id,firstLease.leaseToken,'completed'),{timeout:10000}).catch(e=>{error=e;return false;});
    let waiting=false;
    for(let n=0;n<100&&!waiting;n++){waiting=(await prisma.$queryRaw`SELECT pid FROM pg_stat_activity WHERE application_name='repository-settlement-waiter' AND wait_event_type='Lock'`).length>0;if(!waiting)await new Promise(r=>setTimeout(r,10));}
    let settled;
    if(mutation==='timeout'){settled=await attempt;release();await blocker;}else{release();await blocker;settled=await attempt;}
    const elapsed=Date.now()-start,row=await prisma.repositoryLocalEffectIntent.findUnique({where:{id:firstLease.id}});
    check('actual settlement '+mutation+' lock cannot record stale success',waiting&&!settled&&row.state==='leased'&&row.finishedAt===null&&(mutation!=='timeout'||(error?.code==='P2010'&&error?.meta?.code==='55P03'&&elapsed>=1800&&elapsed<4500)),JSON.stringify({elapsed,code:error?.code,meta:error?.meta}));
  }
  await settlementWaiter.$disconnect();
  await prisma.repositoryLocalEffectIntent.update({where:{id:firstLease.id},data:{leaseToken:firstLease.leaseToken,leaseUntil:new Date('2099-01-01')}});
  check('successful queue settlement is token fenced',await prisma.$transaction(tx=>settleRepositoryEffect(tx,firstLease.id,firstLease.leaseToken,'completed'))&&!await prisma.$transaction(tx=>settleRepositoryEffect(tx,firstLease.id,firstLease.leaseToken,'retry'))&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:firstLease.id}})).state==='completed');
  await prisma.repositoryLocalEffectIntent.update({where:{id:secondLease.id},data:{leaseUntil:new Date('2020-01-01')}});
  check('expired worker cannot settle even before reclaim',!await prisma.$transaction(tx=>settleRepositoryEffect(tx,secondLease.id,secondLease.leaseToken,'completed')));
  const reclaimed=await prisma.$transaction(claimRepositoryEffect);
  check('expired lease is reclaimed with new token and incremented attempt',reclaimed.id===secondLease.id&&reclaimed.leaseToken!==secondLease.leaseToken&&reclaimed.attempts===2);
  check('reclaimed stale worker cannot finish or requeue',!await prisma.$transaction(tx=>settleRepositoryEffect(tx,secondLease.id,secondLease.leaseToken,'retry')));
  check('retry releases token and sets bounded backoff',await prisma.$transaction(tx=>settleRepositoryEffect(tx,reclaimed.id,reclaimed.leaseToken,'retry'))&&await prisma.$transaction(claimRepositoryEffect)===null&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:reclaimed.id}})).state==='pending');
  await prisma.repositoryLocalEffectIntent.update({where:{id:reclaimed.id},data:{availableAt:new Date('2020-01-01')}});const lastAttempt=await prisma.$transaction(claimRepositoryEffect);
  check('third failure becomes terminal without fourth attempt',lastAttempt.attempts===3&&await prisma.$transaction(tx=>settleRepositoryEffect(tx,lastAttempt.id,lastAttempt.leaseToken,'retry'))&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:lastAttempt.id}})).state==='dead'&&await prisma.$transaction(claimRepositoryEffect)===null);
  const crashIntent=await prisma.repositoryLocalEffectIntent.create({data:{...leaseData,state:'leased',attempts:3,leaseToken:secondLease.leaseToken,leaseUntil:new Date('2020-01-01')}});
  const exhausted=await prisma.$transaction(claimRepositoryEffect);
  check('expired final attempt becomes dead without new lease',exhausted===null&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:crashIntent.id}})).state==='dead'&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:crashIntent.id}})).attempts===3&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:crashIntent.id}})).leaseToken===null&&await prisma.$transaction(claimRepositoryEffect)===null);
  const futureIntent=await prisma.repositoryLocalEffectIntent.create({data:{...leaseData,availableAt:new Date('2099-01-01')}});
  check('future availability is not claimed',await prisma.$transaction(claimRepositoryEffect)===null);
  await prisma.repositoryLocalEffectIntent.update({where:{id:futureIntent.id},data:{availableAt:new Date('2020-01-01')}});
  try{await prisma.$transaction(async tx=>{await claimRepositoryEffect(tx);throw new Error('rollback claim');});}catch{}
  check('claim rollback preserves pending attempts and no token',(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:futureIntent.id}})).attempts===0&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:futureIntent.id}})).leaseToken===null);
  const clockLease=await prisma.$transaction(claimRepositoryEffect);
  let expiredInTransaction=false;await prisma.$transaction(async tx=>{await tx.repositoryLocalEffectIntent.update({where:{id:clockLease.id},data:{leaseUntil:new Date(Date.now()+80)}});await new Promise(r=>setTimeout(r,150));expiredInTransaction=!await settleRepositoryEffect(tx,clockLease.id,clockLease.leaseToken,'completed');});
  check('lease expiry uses wall clock even within older transaction',expiredInTransaction);
  let invalidState=false;try{await prisma.repositoryLocalEffectIntent.update({where:{id:clockLease.id},data:{state:'completed',leaseToken:null,leaseUntil:null}});}catch{invalidState=true;}
  check('database rejects terminal state without finished timestamp',invalidState);
  await prisma.repositoryLocalEffectIntent.deleteMany();
  const oldTerminal={...leaseData,state:'completed',finishedAt:new Date('2020-01-01')};
  await prisma.repositoryLocalEffectIntent.createMany({data:Array.from({length:205},(_,i)=>({...oldTerminal,state:i%2?'dead':'completed'}))});
  const protectedPending=await prisma.repositoryLocalEffectIntent.create({data:{...leaseData,createdAt:new Date('2020-01-01'),availableAt:new Date('2020-01-01')}});
  const protectedLeased=await prisma.repositoryLocalEffectIntent.create({data:{...leaseData,state:'leased',attempts:3,leaseToken:owner.user.id,leaseUntil:new Date('2020-01-01'),createdAt:new Date('2020-01-01')}});
  const recentTerminal=await prisma.repositoryLocalEffectIntent.create({data:{...oldTerminal,finishedAt:new Date()}});
  const lockedTerminal=await prisma.repositoryLocalEffectIntent.findFirst({where:{state:'completed',finishedAt:new Date('2020-01-01')}});
  await prisma.repositoryLocalEffectIntent.createMany({data:Array.from({length:10000},()=>({...leaseData,availableAt:new Date('2099-01-01')}))});
  await prisma.repositoryLocalEffectIntent.createMany({data:Array.from({length:10000},()=>({...oldTerminal,finishedAt:new Date()}))});
  await prisma.$executeRaw`ANALYZE repository_local_effect_intents`;
  let retentionPlan;
  await pruneRepositoryEffects({$queryRaw:async(strings,...values)=>{retentionPlan=await prisma.$queryRaw(Prisma.sql`EXPLAIN (FORMAT JSON) ${Prisma.sql(strings,...values)}`);return [];}});
  check('actual PG retention plan uses ordered terminal timestamp index without sort',JSON.stringify(retentionPlan).includes('repository_local_effect_intents_finishedAt_id_idx')&&!JSON.stringify(retentionPlan).includes('"Node Type":"Sort"'));
  await prisma.repositoryLocalEffectIntent.deleteMany({where:{projectId:leaseProject.id,state:'pending',availableAt:new Date('2099-01-01')}});
  await prisma.repositoryLocalEffectIntent.deleteMany({where:{projectId:leaseProject.id,state:'completed',finishedAt:{gte:new Date(Date.now()-60000)},NOT:{id:recentTerminal.id}}});
  let retentionReady,releaseRetention;const retentionGate=new Promise(r=>releaseRetention=r),retentionHeld=new Promise(r=>retentionReady=r);
  const holdingTerminal=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM repository_local_effect_intents WHERE id=${lockedTerminal.id}::uuid FOR UPDATE`;retentionReady();await retentionGate;},{timeout:10000});await retentionHeld;
  const firstPrune=await prisma.$transaction(pruneRepositoryEffects);
  check('terminal retention deletes at most hundred old rows per call',firstPrune.removed===100&&await prisma.repositoryLocalEffectIntent.count()===108);
  check('terminal retention skips a concurrently locked old row',!!await prisma.repositoryLocalEffectIntent.findUnique({where:{id:lockedTerminal.id}}));
  releaseRetention();await holdingTerminal;
  const concurrentPrunes=await Promise.all([prisma.$transaction(pruneRepositoryEffects),prisma.$transaction(pruneRepositoryEffects)]);
  check('concurrent terminal pruners delete disjoint bounded batches',concurrentPrunes.reduce((n,r)=>n+r.removed,0)===105&&concurrentPrunes.every(r=>r.removed<=100)&&await prisma.repositoryLocalEffectIntent.count()===3);
  check('retention preserves old pending and expired exhausted leased work',!!await prisma.repositoryLocalEffectIntent.findUnique({where:{id:protectedPending.id}})&&!!await prisma.repositoryLocalEffectIntent.findUnique({where:{id:protectedLeased.id}}));
  check('retention preserves recent terminal bookkeeping',!!await prisma.repositoryLocalEffectIntent.findUnique({where:{id:recentTerminal.id}}));
  check('empty retention sweep is idempotent',(await prisma.$transaction(pruneRepositoryEffects)).removed===0);
  const rollbackTerminal=await prisma.repositoryLocalEffectIntent.create({data:oldTerminal});
  try{await prisma.$transaction(async tx=>{await pruneRepositoryEffects(tx);throw new Error('rollback retention');});}catch{}
  check('retention rollback preserves terminal payload',!!await prisma.repositoryLocalEffectIntent.findUnique({where:{id:rollbackTerminal.id}}));
  await prisma.repositoryLocalEffectIntent.update({where:{id:rollbackTerminal.id},data:{finishedAt:new Date(Date.now()-6*24*3600000)}});
  check('six day terminal row remains inside seven day retention',(await prisma.$transaction(pruneRepositoryEffects)).removed===0);
  await prisma.project.delete({where:{id:leaseProject.id}});
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
  // Internal fresh-source boundary using real service authorization, repository
  // HTTP reader and DB snapshot service, without adding an HTTP apply route.
  const serviceBundle=join(root,'.tmp-fresh-services.cjs');
  const serviceEntry=join(root,'.tmp-fresh-services.ts');
  const {writeFileSync}=await import('node:fs');
  writeFileSync(serviceEntry,`export {ProjectsService} from './apps/api/src/app/projects/projects.service';
export {BranchesService} from './apps/api/src/app/branches/branches.service';
export {LocalSyncPreviewService} from './apps/api/src/app/github/sync-preview.controller';
export {WebhooksService} from './apps/api/src/app/webhooks/webhooks.service';
export {AutomationsService} from './apps/api/src/app/automations/automations.service';
export {runRepositoryEffectStep} from './apps/api/src/app/github/repository-effect-step';`);
  execFileSync('node_modules/.bin/esbuild',[serviceEntry,'--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+serviceBundle]);
  const {ProjectsService,BranchesService,LocalSyncPreviewService}=require(serviceBundle);
  const realProjects=new ProjectsService(prisma,{}),realBranches=new BranchesService(prisma,realProjects,{},{},{},{});
  const realPreviews=new LocalSyncPreviewService(prisma,realProjects,realBranches);
  const freshService=new RepositoryTargetsService(prisma,realProjects,realBranches,realPreviews);
  const freshProject=(await call('/projects',{jwt,method:'POST',body:{name:'Fresh execution',slug:'fresh-execution',locales:['en','he']}})).json;
  const freshPath=`/projects/${freshProject.id}`;const actor={userId:owner.user.id,via:'jwt'};
  await call(freshPath+'/import/en',{jwt,method:'POST',body:{entries:{existing:'before'}}});
  await call(freshPath+'/import/he',{jwt,method:'POST',body:{entries:{existing:'before'}}});
  const freshTarget=(await call(freshPath+'/sync/repository-targets',{jwt,method:'POST',body:{localBranch:'main',locale:'he',owner:'owner',repo:'repo',remoteBranch:'main',path:'updated/en.json'}})).json.target;
  const priorEnv=Object.fromEntries(['GITHUB_READ_OWNER','GITHUB_READ_REPO','GITHUB_READ_TOKEN','GITHUB_READ_FIXTURE_ORIGIN','NODE_ENV'].map(k=>[k,process.env[k]]));
  Object.assign(process.env,{GITHUB_READ_OWNER:'owner',GITHUB_READ_REPO:'repo',GITHUB_READ_TOKEN:'fixture-read-only-token',GITHUB_READ_FIXTURE_ORIGIN:repoOrigin,NODE_ENV:'test'});
  repoText=JSON.stringify({existing:'after'});
  const freshRead=await freshService.read(actor,freshProject.id,freshTarget.id,1);
  await freshService.acceptBaseline(actor,freshProject.id,freshTarget.id,{expectedRevision:1,expectedRemoteSha:freshRead.remoteSha,expectedContentDigest:freshRead.contentDigest,expectedBaselineVersion:0});
  const freshPlan=await freshService.preview(actor,freshProject.id,freshTarget.id,1);
  const freshChoices={existing:'remote'};const freshInput={expectedRevision:1,expectedFingerprint:freshPlan.fingerprint,choices:freshChoices};
  const freshDraft=await freshService.resolve(actor,freshProject.id,freshTarget.id,freshInput);
  const freshRequest={...freshInput,expectedDraftDigest:freshDraft.contentDigest};
  let freshLastStatus;
  const freshReject=async(input=freshRequest,who=actor)=>{freshLastStatus=undefined;try{await freshService.executeReviewedLocal(who,freshProject.id,freshTarget.id,input);return false;}catch(e){freshLastStatus=e.getStatus?.();return true;}};
  const freshBefore=await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}});
  check('fresh execution rejects changed choice exact digest and fingerprint before writes',await freshReject({...freshRequest,choices:{existing:'local'}})&&await freshReject({...freshRequest,expectedDraftDigest:'f'.repeat(64)})&&await freshReject({...freshRequest,expectedFingerprint:'f'.repeat(64)})&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='before');
  const beforeUnauthorizedCalls=repoCalls;
  check('fresh execution rejects outsider and API token before remote request',await freshReject(freshRequest,{userId:outsider.user.id,via:'jwt'})&&await freshReject(freshRequest,{...actor,via:'api-token'})&&repoCalls===beforeUnauthorizedCalls);
  repoText=JSON.stringify({existing:'changed again'});
  check('fresh execution rereads actual repository and rejects changed remote bytes',await freshReject()&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='before');
  repoText=JSON.stringify({existing:'after'});
  repoGate=new Promise(r=>releaseRepo=r);let seenFresh;const freshRemoteSeen=new Promise(r=>seenFresh=r);repoSeen=seenFresh;
  const racedFresh=freshReject();await freshRemoteSeen;
  await prisma.translation.update({where:{keyId_localeCode:{keyId:freshBefore.keyId,localeCode:'he'}},data:{version:{increment:1}}});releaseRepo();
  check('fresh execution rejects actual local generation change during remote read',await racedFresh&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===0);
  repoGate=undefined;repoSeen=undefined;
  // Review again after legitimate generation change, then inject failure exactly
  // at durable intent insertion to prove the fresh service owns atomic writes.
  const revisedFresh=await freshService.preview(actor,freshProject.id,freshTarget.id,1);
  freshRequest.expectedFingerprint=revisedFresh.fingerprint;
  freshRequest.expectedDraftDigest=(await freshService.resolve(actor,freshProject.id,freshTarget.id,{...freshRequest})).contentDigest;
  const freshActivityCount=await prisma.activityEvent.count({where:{projectId:freshProject.id,action:'translation.value',localeCode:'he'}});
  const freshHistoryCount=await prisma.translationHistory.count({where:{keyId:freshBefore.keyId,localeCode:'he'}});
  await prisma.$executeRawUnsafe(`CREATE FUNCTION fresh_fail_intent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fresh intent fixture'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER fresh_fail_intent BEFORE INSERT ON repository_local_effect_intents FOR EACH ROW EXECUTE FUNCTION fresh_fail_intent()`);
  let freshStorageError='';try{await freshService.executeReviewedLocal(actor,freshProject.id,freshTarget.id,freshRequest);}catch(e){freshStorageError=e.message;}
  check('fresh execution intent storage failure rolls back value history TM and activity',freshStorageError.includes('fresh intent fixture')&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='before'&&await prisma.translationHistory.count({where:{keyId:freshBefore.keyId,localeCode:'he'}})===freshHistoryCount&&await prisma.tmEntry.count({where:{projectId:freshProject.id,localeCode:'he',targetText:'after'}})===0&&await prisma.activityEvent.count({where:{projectId:freshProject.id,action:'translation.value',localeCode:'he'}})===freshActivityCount&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===0);
  await prisma.$executeRawUnsafe(`DROP TRIGGER fresh_fail_intent ON repository_local_effect_intents`);await prisma.$executeRawUnsafe(`DROP FUNCTION fresh_fail_intent()`);
  const originalFreshResolve=freshService.resolve.bind(freshService);
  const freshSavedBaseline=await prisma.repositorySyncBaseline.findUnique({where:{targetId:freshTarget.id}});
  let freshBaselineSeam=false,freshRoleSeam=false;
  freshService.resolve=async(...args)=>{const result=await originalFreshResolve(...args);freshBaselineSeam=true;await prisma.repositorySyncBaseline.update({where:{targetId:freshTarget.id},data:{version:{increment:1}}});return result;};
  check('fresh execution post-resolution baseline replacement fails locked commit without effects',await freshReject()&&freshLastStatus===409&&freshBaselineSeam&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===0&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='before');
  await prisma.repositorySyncBaseline.update({where:{targetId:freshTarget.id},data:{version:freshSavedBaseline.version}});
  const adminActor={userId:admin.user.id,via:'jwt'};
  freshService.resolve=async(...args)=>{const result=await originalFreshResolve(...args);freshRoleSeam=true;await prisma.teamMember.update({where:{teamId_userId:{teamId:freshProject.teamId,userId:admin.user.id}},data:{role:'MEMBER'}});return result;};
  check('fresh execution post-resolution admin revocation fails locked commit',await freshReject(freshRequest,adminActor)&&freshLastStatus===409&&freshRoleSeam&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===0&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='before');
  await prisma.teamMember.update({where:{teamId_userId:{teamId:freshProject.teamId,userId:admin.user.id}},data:{role:'ADMIN'}});
  freshService.resolve=originalFreshResolve;
  const freshBaselineBefore=await prisma.repositorySyncBaseline.findUnique({where:{targetId:freshTarget.id}});
  const freshApplied=await freshService.executeReviewedLocal(actor,freshProject.id,freshTarget.id,freshRequest);
  const freshAfter=await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}});
  check('fresh internal execution commits actual local value history activity TM and intent',freshApplied.pendingEffectIntents===1&&freshAfter.value==='after'&&freshAfter.version===freshBefore.version+2&&await prisma.translationHistory.count({where:{keyId:freshAfter.keyId,localeCode:'he'}})===freshHistoryCount+1&&await prisma.activityEvent.count({where:{projectId:freshProject.id,action:'translation.value',localeCode:'he'}})===freshActivityCount+1&&await prisma.tmEntry.count({where:{projectId:freshProject.id,localeCode:'he',sourceText:'before',targetText:'after'}})===1&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id,state:'pending'}})===1);
  check('fresh execution does not advance baseline write remote or claim accepted sync',freshApplied.remoteWritten===false&&freshApplied.baselineAdvanced===false&&freshApplied.repositorySyncAccepted===false&&JSON.stringify(await prisma.repositorySyncBaseline.findUnique({where:{targetId:freshTarget.id}}))===JSON.stringify(freshBaselineBefore)&&repoMethod==='GET');
  check('fresh execution replay rejects stale local generations without duplicate intent',await freshReject()&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===1);
  check('fresh internal service has no exposed HTTP execute route',(await call(freshPath+'/sync/repository-targets/'+freshTarget.id+'/execute-reviewed-local',{jwt,method:'POST',body:freshRequest})).status===404);
  const freshNoopPlan=await freshService.preview(actor,freshProject.id,freshTarget.id,1);
  const freshNoopDraft=await freshService.resolve(actor,freshProject.id,freshTarget.id,{expectedRevision:1,expectedFingerprint:freshNoopPlan.fingerprint,choices:{}});
  const freshNoop=await freshService.executeReviewedLocal(actor,freshProject.id,freshTarget.id,{expectedRevision:1,expectedFingerprint:freshNoopPlan.fingerprint,expectedDraftDigest:freshNoopDraft.contentDigest,choices:{}});
  check('fresh no-op execution emits no additional value history TM activity or intents',freshNoop.pendingEffectIntents===0&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===1&&await prisma.translationHistory.count({where:{keyId:freshAfter.keyId,localeCode:'he'}})===freshHistoryCount+1&&await prisma.activityEvent.count({where:{projectId:freshProject.id,action:'translation.value',localeCode:'he'}})===freshActivityCount+1);
  repoText=JSON.stringify({existing:'after',newRemote:'not supported'});
  const newKeyPlan=await freshService.preview(actor,freshProject.id,freshTarget.id,1);
  const newKeyInput={expectedRevision:1,expectedFingerprint:newKeyPlan.fingerprint,choices:{newRemote:'remote'}};
  const newKeyDraft=await freshService.resolve(actor,freshProject.id,freshTarget.id,newKeyInput);
  check('fresh execution unsupported remote-only new key fails before any writes',await freshReject({...newKeyInput,expectedDraftDigest:newKeyDraft.contentDigest})&&await prisma.key.count({where:{projectId:freshProject.id,name:'newRemote'}})===0&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===1);
  repoText=JSON.stringify({existing:'third'});
  const localRacePlan=await freshService.preview(actor,freshProject.id,freshTarget.id,1);
  const localRaceInput={expectedRevision:1,expectedFingerprint:localRacePlan.fingerprint,choices:{existing:'remote'}};
  const localRaceDraft=await freshService.resolve(actor,freshProject.id,freshTarget.id,localRaceInput);
  let localRaceSeam=false;
  freshService.resolve=async(...args)=>{const result=await originalFreshResolve(...args);localRaceSeam=true;await prisma.translation.update({where:{keyId_localeCode:{keyId:freshAfter.keyId,localeCode:'he'}},data:{version:{increment:1}}});return result;};
  check('fresh post-resolution local generation change denies commit before new effect',await freshReject({...localRaceInput,expectedDraftDigest:localRaceDraft.contentDigest})&&freshLastStatus===409&&localRaceSeam&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='after'&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===1);
  freshService.resolve=originalFreshResolve;
  // Public local-only apply boundary: all reviewed bytes still recomputed.
  const localApplyPath=freshPath+'/sync/repository-targets/'+freshTarget.id+'/apply-local';
  const applyHttp=(body,auth=jwt,apiKey)=>call(localApplyPath,{jwt:auth,apiKey,method:'POST',body});
  const httpPlan=await freshService.preview(actor,freshProject.id,freshTarget.id,1);
  const httpInput={expectedRevision:1,expectedFingerprint:httpPlan.fingerprint,choices:{existing:'remote'}};
  const httpDraft=await freshService.resolve(actor,freshProject.id,freshTarget.id,httpInput);
  const httpRequest={...httpInput,expectedDraftDigest:httpDraft.contentDigest};
  const httpBefore=await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}});
  const httpBeforeCount=repoCalls;
  check('HTTP local apply rejects member outsider API token before remote',(await applyHttp(httpRequest,member.accessToken)).status===403&&(await applyHttp(httpRequest,outsider.accessToken)).status===404&&(await applyHttp(httpRequest,null,token.token)).status===403&&repoCalls===httpBeforeCount);
  const invalidHttp=[{...httpRequest,expectedDraftDigest:undefined},{...httpRequest,expectedDraftDigest:'bad'},{...httpRequest,expectedRevision:0},{...httpRequest,choices:[]}];
  check('HTTP local apply validates mandatory reviewed fields before remote',(await Promise.all(invalidHttp.map(body=>applyHttp(body)))).every(r=>r.status===400)&&repoCalls===httpBeforeCount);
  check('HTTP local apply changed digest and fingerprint deny without writes',(await applyHttp({...httpRequest,expectedDraftDigest:'f'.repeat(64)})).status===409&&(await applyHttp({...httpRequest,expectedFingerprint:'f'.repeat(64)})).status===409&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).version===httpBefore.version);
  repoText=JSON.stringify({existing:'changed HTTP bytes'});
  check('HTTP local apply rereads changed remote and leaves reviewed local untouched',(await applyHttp(httpRequest)).status===409&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).version===httpBefore.version);
  repoText=JSON.stringify({existing:'third'});repoStatus=503;
  check('HTTP remote read failure cannot change values or enqueue effects',(await applyHttp(httpRequest)).status===502&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='after'&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===1);
  repoStatus=200;
  let actualConflict,conflictTransactions=0,conflictBoundaryReached=false;
  const conflictDb=new Proxy(prisma,{get(db,key){if(key==='$transaction')return async(fn,options)=>{
    if(options?.isolationLevel!=='Serializable')return db.$transaction(fn,options);
    conflictTransactions++;
    return db.$transaction(async tx=>{
      // Establish actual Serializable snapshot, then commit a conflicting write
      // on another connection before production SELECT FOR UPDATE sees it.
      await tx.project.findUniqueOrThrow({where:{id:freshProject.id}});
      await prisma.project.update({where:{id:freshProject.id},data:{name:'Concurrent project update'}});
      conflictBoundaryReached=true;
      try{return await fn(tx);}catch(e){actualConflict={code:e.code,meta:e.meta};throw e;}
    },options);
  };const value=Reflect.get(db,key);return typeof value==='function'?value.bind(db):value;}});
  const conflictedService=new RepositoryTargetsService(conflictDb,realProjects,realBranches,realPreviews);
  const conflictBefore={value:await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}}),history:await prisma.translationHistory.count({where:{keyId:httpBefore.keyId}}),activity:await prisma.activityEvent.count({where:{projectId:freshProject.id}}),intents:await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}}),tm:await prisma.tmEntry.count({where:{projectId:freshProject.id}})};
  let conflictStatus;try{await conflictedService.executeReviewedLocal(actor,freshProject.id,freshTarget.id,httpRequest);}catch(e){conflictStatus=e.getStatus?.();}
  check('actual PG serialization failure maps409 with no automatic apply retry',conflictBoundaryReached&&conflictTransactions===1&&conflictStatus===409,JSON.stringify({conflictStatus,actualConflict,conflictTransactions}));
  check('actual serialization failure leaves value history TM activity and effects unchanged',JSON.stringify(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}}))===JSON.stringify(conflictBefore.value)&&await prisma.translationHistory.count({where:{keyId:httpBefore.keyId}})===conflictBefore.history&&await prisma.activityEvent.count({where:{projectId:freshProject.id}})===conflictBefore.activity&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===conflictBefore.intents&&await prisma.tmEntry.count({where:{projectId:freshProject.id}})===conflictBefore.tm);
  let busyReady,releaseBusy;const busyGate=new Promise(r=>releaseBusy=r),busyHeld=new Promise(r=>busyReady=r);
  const busyBlocker=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM projects WHERE id=${freshProject.id}::uuid FOR UPDATE`;busyReady();await busyGate;},{timeout:15000});await busyHeld;
  const busyStart=Date.now();let busyHttp;
  try{busyHttp=await applyHttp(httpRequest);}finally{releaseBusy();await busyBlocker;}
  const busyElapsed=Date.now()-busyStart;
  check('actual HTTP project lock wait bounded to safe409 without retry',busyHttp.status===409&&busyHttp.json.message==='Local apply is busy; compare and review again'&&busyElapsed>=1900&&busyElapsed<4500,JSON.stringify({status:busyHttp.status,elapsed:busyElapsed,message:busyHttp.json.message}));
  check('actual lock timeout leaves value history TM activity and effects unchanged',JSON.stringify(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}}))===JSON.stringify(conflictBefore.value)&&await prisma.translationHistory.count({where:{keyId:httpBefore.keyId}})===conflictBefore.history&&await prisma.activityEvent.count({where:{projectId:freshProject.id}})===conflictBefore.activity&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===conflictBefore.intents&&await prisma.tmEntry.count({where:{projectId:freshProject.id}})===conflictBefore.tm);
  let rowBusyReady,releaseRowBusy;const rowBusyGate=new Promise(r=>releaseRowBusy=r),rowBusyHeld=new Promise(r=>rowBusyReady=r);
  const rowBusyBlocker=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT "rowId" FROM translations WHERE "keyId"=${httpBefore.keyId}::uuid AND "localeCode"='he' FOR UPDATE`;rowBusyReady();await rowBusyGate;},{timeout:15000});await rowBusyHeld;
  let rowBusyHttp;const rowBusyStart=Date.now();try{rowBusyHttp=await applyHttp(httpRequest);}finally{releaseRowBusy();await rowBusyBlocker;}
  check('actual HTTP translation row lock uses same bounded safe409',rowBusyHttp.status===409&&rowBusyHttp.json.message==='Local apply is busy; compare and review again'&&Date.now()-rowBusyStart>=1900&&Date.now()-rowBusyStart<4500);
  check('translation lock timeout rolls back any transaction state before later success',JSON.stringify(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}}))===JSON.stringify(conflictBefore.value)&&await prisma.translationHistory.count({where:{keyId:httpBefore.keyId}})===conflictBefore.history&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===conflictBefore.intents);
  const httpExistingKey=await prisma.key.findFirst({where:{projectId:freshProject.id,name:'existing'}});
  await prisma.key.update({where:{id:httpExistingKey.id},data:{maxLength:2}});
  const lengthPlan=await freshService.preview(actor,freshProject.id,freshTarget.id,1),lengthInput={expectedRevision:1,expectedFingerprint:lengthPlan.fingerprint,choices:{existing:'remote'}};
  const lengthDraft=await freshService.resolve(actor,freshProject.id,freshTarget.id,lengthInput);
  const lengthHttp=await applyHttp({...lengthInput,expectedDraftDigest:lengthDraft.contentDigest});
  check('HTTP typed length-limit denial returns safe400 without value or intent writes',lengthHttp.status===400&&lengthHttp.json.message==='Reviewed local operation is unsupported or exceeds local limits'&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='after'&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===1);
  await prisma.key.update({where:{id:httpExistingKey.id},data:{maxLength:null}});
  // Metadata update changes reviewed fingerprint even when length restored.
  const reReviewedHttp=await freshService.preview(actor,freshProject.id,freshTarget.id,1);httpRequest.expectedFingerprint=reReviewedHttp.fingerprint;
  httpRequest.expectedDraftDigest=(await freshService.resolve(actor,freshProject.id,freshTarget.id,httpRequest)).contentDigest;
  repoText=JSON.stringify({existing:'third',unsupportedNew:'new'});
  const unsupportedPlan=await freshService.preview(actor,freshProject.id,freshTarget.id,1),unsupportedInput={expectedRevision:1,expectedFingerprint:unsupportedPlan.fingerprint,choices:{existing:'remote',unsupportedNew:'remote'}};
  const unsupportedDraft=await freshService.resolve(actor,freshProject.id,freshTarget.id,unsupportedInput);
  const unsupportedHttp=await applyHttp({...unsupportedInput,expectedDraftDigest:unsupportedDraft.contentDigest});
  check('HTTP remote-only key denial returns safe400 without partial existing-key write',unsupportedHttp.status===400&&unsupportedHttp.json.message==='Reviewed local operation is unsupported or exceeds local limits'&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='after'&&await prisma.key.count({where:{projectId:freshProject.id,name:'unsupportedNew'}})===0&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===1);
  repoText=JSON.stringify({existing:'third'});
  const queueShape=await prisma.repositoryLocalEffectIntent.findFirst({where:{projectId:freshProject.id}});
  const {id:queueId,createdAt:queueCreated,...queueFields}=queueShape;
  await prisma.repositoryLocalEffectIntent.createMany({data:Array.from({length:9999},()=>({...queueFields,automationRuleIds:undefined}))});
  const backlogHttp=await applyHttp(httpRequest);
  check('HTTP typed backlog admission denial returns safe409 before local writes',backlogHttp.status===409&&backlogHttp.json.message==='Local effect backlog is full; try after queued work is handled'&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='after'&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===10000);
  await prisma.repositoryLocalEffectIntent.deleteMany({where:{projectId:freshProject.id,id:{not:queueId}}});
  check('HTTP unauthenticated local apply is rejected before remote',(await applyHttp(httpRequest,null)).status===401);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION http_fail_intent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'http intent fixture'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER http_fail_intent BEFORE INSERT ON repository_local_effect_intents FOR EACH ROW EXECUTE FUNCTION http_fail_intent()`);
  const httpRollbackHistory=await prisma.translationHistory.count({where:{keyId:httpBefore.keyId,localeCode:'he'}}),httpRollbackActivity=await prisma.activityEvent.count({where:{projectId:freshProject.id}});
  const failedHttp=await applyHttp(httpRequest);
  check('HTTP intent storage failure atomically rolls back value history TM activity and intent',failedHttp.status===500&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='after'&&await prisma.translationHistory.count({where:{keyId:httpBefore.keyId,localeCode:'he'}})===httpRollbackHistory&&await prisma.activityEvent.count({where:{projectId:freshProject.id}})===httpRollbackActivity&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===1&&await prisma.tmEntry.count({where:{projectId:freshProject.id,targetText:'third'}})===0);
  await prisma.$executeRawUnsafe(`DROP TRIGGER http_fail_intent ON repository_local_effect_intents`);await prisma.$executeRawUnsafe(`DROP FUNCTION http_fail_intent()`);
  const actualHttp=await fetch(API+localApplyPath,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({...httpRequest,actorId:outsider.user.id,json:'{}',localJson:'{}',remoteJson:'{}'})});const actualHttpJson=await actualHttp.json();
  check('HTTP reviewed apply commits actual locale value with session actor and no-store',actualHttp.status===201&&actualHttp.headers.get('cache-control')==='no-store'&&actualHttpJson.updatedValues===1&&actualHttpJson.pendingEffectIntents===1&&(await prisma.translation.findFirst({where:{projectId:freshProject.id,localeCode:'he'}})).value==='third'&&(await prisma.repositoryLocalEffectIntent.findFirst({where:{projectId:freshProject.id,value:'third'}})).actorId===owner.user.id);
  check('HTTP local apply replay conflicts without duplicate effects',(await applyHttp(httpRequest)).status===409&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id}})===2);
  repoText='{}';
  const removeHttpPlan=await freshService.preview(actor,freshProject.id,freshTarget.id,1);
  const removeHttpInput={expectedRevision:1,expectedFingerprint:removeHttpPlan.fingerprint,choices:{existing:'remote'}};
  const removeHttpDraft=await freshService.resolve(actor,freshProject.id,freshTarget.id,removeHttpInput);
  const removeHttpRequest={...removeHttpInput,expectedDraftDigest:removeHttpDraft.contentDigest};
  const httpRemove=await applyHttp(removeHttpRequest);
  check('HTTP explicit absent choice removes locale only preserving key base locale and deletion audit',httpRemove.status===201&&httpRemove.json.removedValues===1&&httpRemove.json.pendingEffectIntents===1&&await prisma.translation.count({where:{keyId:freshAfter.keyId,localeCode:'he'}})===0&&await prisma.key.count({where:{id:freshAfter.keyId}})===1&&(await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:freshAfter.keyId,localeCode:'en'}}})).value==='before'&&await prisma.translationDeletionAudit.count({where:{projectId:freshProject.id,keyId:freshAfter.keyId}})===1&&await prisma.repositoryLocalEffectIntent.count({where:{projectId:freshProject.id,operation:'remove-locale-value',value:null}})===1);
  check('HTTP apply never writes remote advances baseline or claims sync',actualHttpJson.remoteWritten===false&&actualHttpJson.baselineAdvanced===false&&actualHttpJson.repositorySyncAccepted===false&&httpRemove.json.remoteWritten===false&&httpRemove.json.baselineAdvanced===false&&JSON.stringify(await prisma.repositorySyncBaseline.findUnique({where:{targetId:freshTarget.id}}))===JSON.stringify(freshBaselineBefore)&&repoMethod==='GET');
  const effectReceipts=[];const effectReceiver=createServer((req,res)=>{let body='';req.on('data',b=>body+=b);req.on('end',()=>{effectReceipts.push({event:req.headers['x-openlocale-event'],signature:req.headers['x-openlocale-signature'],body});res.writeHead(200).end();});});
  await new Promise(r=>effectReceiver.listen(0,'127.0.0.1',r));
  const {WebhooksService,AutomationsService,runRepositoryEffectStep}=require(serviceBundle);
  const effectSecret='fixture-http-apply-secret';
  await prisma.webhook.create({data:{projectId:freshProject.id,url:`http://127.0.0.1:${effectReceiver.address().port}/hook`,events:['translation.removed'],secret:effectSecret}});
  const priorPrivate=process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS;process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS='true';
  try {
    // Older set-value intents are genuinely superseded by deletion. They must
    // fail eligibility, not send outdated values before the removal receipt.
    const realHooks=new WebhooksService(prisma,realProjects),realAutomations=new AutomationsService(prisma,realProjects,{},{},{},realHooks);
    const steps=[];for(let n=0;n<3;n++)steps.push(await runRepositoryEffectStep(prisma,realHooks,realAutomations));
    const removalEffect=await prisma.repositoryLocalEffectIntent.findFirst({where:{projectId:freshProject.id,operation:'remove-locale-value'}});
    const receipt=effectReceipts[0],payload=receipt&&JSON.parse(receipt.body);
    check('HTTP-generated intent delivers actual signed removal and both checkpoints',steps.filter(x=>x.status==='completed').length===1&&effectReceipts.length===1&&receipt.event==='translation.removed'&&receipt.signature==='sha256='+createHmac('sha256',effectSecret).update(receipt.body).digest('hex')&&payload.effectId===removalEffect.id&&payload.value===null&&payload.locale==='he'&&removalEffect.state==='completed'&&!!removalEffect.webhookHandledAt&&!!removalEffect.automationHandledAt);
    check('HTTP-generated superseded set intents never deliver older value',steps.filter(x=>x.status==='ineligible').length===2&&effectReceipts.every(r=>JSON.parse(r.body).operation==='remove-locale-value'));
  } finally {await new Promise(r=>effectReceiver.close(r));if(priorPrivate===undefined)delete process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS;else process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS=priorPrivate;}

  for(const [k,v] of Object.entries(priorEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  rmSync(serviceEntry,{force:true});rmSync(serviceBundle,{force:true});
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
 for(const file of [freshBundle,join(root,'.tmp-fresh-services.cjs'),join(root,'.tmp-fresh-services.ts')])rmSync(file,{force:true});
 if(api) { const stopped=new Promise(resolve=>api.once('close',resolve));api.kill('SIGTERM');await stopped; }
 await new Promise(r=>repositoryFixture.close(r));await prisma?.$disconnect();await pg.stop();rmSync(dataDir,{recursive:true,force:true});
}
console.log(failures ? `sync-preview: ${failures} FAILURES` : 'sync-preview pass complete');
process.exit(failures?1:0);
