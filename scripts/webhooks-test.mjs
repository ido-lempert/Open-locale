// Webhooks: real PostgreSQL + real HTTP API + a real local receiver.
// Run: node scripts/webhooks-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55447, API_PORT = 3014, HOOK_PORT = 3915;
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

const received = [];
let afterReceipt;
let failNext = 0; // when >0 the receiver answers 500 (retry testing)
const receiver = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    received.push({ event: req.headers['x-openlocale-event'], sig: req.headers['x-openlocale-signature'], body });
    if(afterReceipt) await afterReceipt();
    if (failNext > 0) { failNext--; res.writeHead(500); res.end('boom'); return; }
    res.writeHead(200); res.end('ok');
  });
});
await new Promise((r) => receiver.listen(HOOK_PORT, '127.0.0.1', r));

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-wh-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api,prisma;
const require=createRequire(import.meta.url);
const bundlePath=join(root,'.tmp-repository-webhook-test.cjs');
execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/webhooks/webhooks.service.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+bundlePath]);
const {WebhooksService}=require(bundlePath);
const adapterPath=join(root,'.tmp-repository-webhook-adapter.cjs');
execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-webhook-handler.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+adapterPath]);
const {deliverRepositoryWebhook}=require(adapterPath);
const stepPath=join(root,'.tmp-repository-webhook-step.cjs');
execFileSync('node_modules/.bin/esbuild',['apps/api/src/app/github/repository-webhook-step.ts','--bundle','--platform=node','--format=cjs','--packages=external','--outfile='+stepPath]);
const {runRepositoryWebhookStep}=require(stepPath);

try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_wh');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_wh`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'wh-secret', PORT: String(API_PORT), WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true' }, stdio: 'pipe' }); // fixture-only opt-in for the loopback receiver
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@wh.io', password: 'password-a', displayName: 'A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@wh.io', password: 'password-b', displayName: 'B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'WH', slug: 'wh', locales: ['en', 'he'] } })).json;
  const P = `/projects/${proj.id}`;

  // CRUD + one-time secret reveal
  const created = await call(`${P}/webhooks`, { token: at, method: 'POST', body: { url: `http://127.0.0.1:${HOOK_PORT}/hook`, events: ['translation.updated'] } });
  check('webhook created with one-time secret', created.status === 201 && typeof created.json.secret === 'string' && created.json.secret.length >= 24, JSON.stringify(created.json));
  const hook = created.json;
  const listed = await call(`${P}/webhooks`, { token: at });
  check('list omits the secret', listed.status === 200 && listed.json.length === 1 && !('secret' in listed.json[0]), JSON.stringify(listed.json));
  const badEvent = await call(`${P}/webhooks`, { token: at, method: 'POST', body: { url: 'http://127.0.0.1:9/x', events: ['project.deleted'] } });
  check('unknown event name rejected (400)', badEvent.status === 400, String(badEvent.status));
  const cross = await call(`${P}/webhooks`, { token: bt });
  check('cross-team webhook list is 404', cross.status === 404, String(cross.status));
  const crossDel = await call(`${P}/webhooks/${hook.id}`, { token: bt, method: 'DELETE' });
  check('cross-team webhook delete is 404', crossDel.status === 404, String(crossDel.status));

  // Delivery on translation upsert
  const key = (await call(`${P}/keys`, { token: at, method: 'POST', body: { name: 'app.title' } })).json;
  await call(`${P}/keys/${key.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Hello' } });
  let hit;
  for (let i = 0; i < 20 && !hit; i++) { await new Promise((r) => setTimeout(r, 250)); hit = received[0]; }
  check('translation upsert delivered to receiver', !!hit, JSON.stringify(received.length));
  if (hit) {
    const expected = 'sha256=' + createHmac('sha256', hook.secret).update(hit.body).digest('hex');
    check('event header is translation.updated', hit.event === 'translation.updated', String(hit.event));
    check('HMAC signature verifies against one-time secret', hit.sig === expected, String(hit.sig));
    const parsed = JSON.parse(hit.body);
    check('payload carries key/locale/value', parsed.key === 'app.title' && parsed.locale === 'en' && parsed.value === 'Hello', hit.body);
  }

  // Inactive webhook receives nothing
  await call(`${P}/webhooks/${hook.id}`, { token: at, method: 'PATCH', body: { active: false } });
  await call(`${P}/keys/${key.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Hello v2' } });
  const before = received.length;
  await new Promise((r) => setTimeout(r, 1500));
  check('inactive webhook receives no delivery', received.length === before, `${before} -> ${received.length}`);

  // --- Delivery journal (slice 17) ---
  // Reactivate, then read the journal: the two earlier deliveries (one active
  // hit, none while inactive) must appear with exact shape.
  await call(`${P}/webhooks/${hook.id}`, { token: at, method: 'PATCH', body: { active: true } });
  let journal = [];
  for (let i = 0; i < 20 && journal.length < 1; i++) {
    await new Promise((r) => setTimeout(r, 250));
    journal = (await call(`${P}/webhooks/${hook.id}/deliveries`, { token: at })).json ?? [];
  }
  check('delivery journal records the successful delivery', journal.length === 1, JSON.stringify(journal.length));
  if (journal[0]) {
    const d = journal[0];
    check('journal row: success, status 200, one attempt, timed', d.success === true && d.httpStatus === 200 && d.attempts === 1 && d.durationMs >= 0 && d.event === 'translation.updated' && d.error === null, JSON.stringify(d));
    check('journal row carries no secret or payload', !('secret' in d) && !('payload' in d) && !('body' in d), Object.keys(d).join(','));
  }
  const memberJournal = await call(`${P}/webhooks/${hook.id}/deliveries`, { token: bt });
  check('cross-team journal read is 404', memberJournal.status === 404, String(memberJournal.status));

  // Retry: receiver 500s the first attempt, succeeds on the retry.
  failNext = 1;
  await call(`${P}/keys/${key.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Hello v3' } });
  let retried = null;
  for (let i = 0; i < 30 && !retried; i++) {
    await new Promise((r) => setTimeout(r, 300));
    journal = (await call(`${P}/webhooks/${hook.id}/deliveries`, { token: at })).json ?? [];
    retried = journal.find((d) => d.attempts === 2);
  }
  check('failed first attempt is retried and succeeds', !!retried && retried.success === true && retried.httpStatus === 200, JSON.stringify(retried));

  // Persistent failure: closed port (fixture mode allows private targets).
  const deadHook = (await call(`${P}/webhooks`, { token: at, method: 'POST', body: { url: 'http://127.0.0.1:9/dead', events: ['translation.updated'] } })).json;
  await call(`${P}/keys/${key.id}/translations`, { token: at, method: 'PUT', body: { locale: 'en', value: 'Hello v4' } });
  let deadRow = null;
  for (let i = 0; i < 30 && !deadRow; i++) {
    await new Promise((r) => setTimeout(r, 300));
    deadRow = ((await call(`${P}/webhooks/${deadHook.id}/deliveries`, { token: at })).json ?? [])[0];
  }
  check('unreachable target journaled as failure after both attempts', !!deadRow && deadRow.success === false && deadRow.attempts === 2 && deadRow.httpStatus === null && typeof deadRow.error === 'string' && deadRow.error.length > 0, JSON.stringify(deadRow));

  // The emitted-but-unsubscribable event class is fixed: mt.pretranslated passes validation.
  const mtHook = await call(`${P}/webhooks`, { token: at, method: 'POST', body: { url: `http://127.0.0.1:${HOOK_PORT}/mt`, events: ['mt.pretranslated'] } });
  check('mt.pretranslated subscription accepted (event list matches emissions)', mtHook.status === 201, `got ${mtHook.status}`);

  prisma=new PrismaClient({datasources:{db:{url}}});
  process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS='true';
  const service=new WebhooksService(prisma,{});
  await prisma.webhook.updateMany({where:{projectId:proj.id},data:{active:false}});
  const removalSubscription=await call(`${P}/webhooks`,{token:at,method:'POST',body:{url:`http://127.0.0.1:${HOOK_PORT}/removal-subscription`,events:['translation.removed']}});
  check('repository removal event can be subscribed through authenticated API',removalSubscription.status===201);
  await prisma.webhook.delete({where:{id:removalSubscription.json.id}});
  const repositoryHook=await prisma.webhook.create({data:{projectId:proj.id,url:`http://127.0.0.1:${HOOK_PORT}/repository`,events:['translation.updated','translation.removed'],secret:'repository-fixture-signing-key'}});
  const branch=await prisma.branch.findUnique({where:{projectId_name:{projectId:proj.id,name:'main'}}});
  const target=await prisma.repositorySyncTarget.create({data:{projectId:proj.id,branchId:branch.id,localBranch:'main',locale:'en',owner:'fixture',repo:'fixture',path:'en.json',remoteBranch:'main'}});
  const translation=await prisma.translation.findUnique({where:{keyId_localeCode:{keyId:key.id,localeCode:'en'}}});
  const intentData={projectId:proj.id,targetId:target.id,targetRevision:target.revision,actorId:a.user.id,keyId:key.id,keyName:key.name,branchId:branch.id,branch:'main',locale:'en',operation:'set-value',value:translation.value,translationRowId:translation.rowId,translationVersion:translation.version,draftContentDigest:'a'.repeat(64),previewFingerprint:'b'.repeat(64),state:'leased',attempts:1,leaseToken:a.user.id,leaseUntil:new Date(Date.now()+3600000)};
  const intent=await prisma.repositoryLocalEffectIntent.create({data:intentData});
  await prisma.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()+INTERVAL '60 seconds' WHERE id=${intent.id}::uuid`;
  let receivedBefore=received.length;const adapterResult=await deliverRepositoryWebhook(prisma,service,intent);const emitted=received.at(-1),payload=JSON.parse(emitted.body);
  check('repository handler uses real signed receiver with effect ID',adapterResult.matched===1&&adapterResult.succeeded===1&&adapterResult.failed===0&&received.length===receivedBefore+1&&payload.effectId===intent.id&&payload.value===translation.value&&payload.operation==='set-value'&&emitted.sig==='sha256='+createHmac('sha256',repositoryHook.secret).update(emitted.body).digest('hex'));
  failNext=2;let failedAdapter=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{failedAdapter=true;}
  check('repository handler surfaces exhausted receiver failure for queue retry',failedAdapter&&received.length===receivedBefore+3);
  receivedBefore=received.length;failNext=1;afterReceipt=async()=>{afterReceipt=null;await prisma.repositorySyncTarget.update({where:{id:target.id},data:{revision:{increment:1}}});};
  let changedDuringRetry=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{changedDuringRetry=true;}
  check('target changed after first failure suppresses retry socket',changedDuringRetry&&received.length===receivedBefore+1);
  await prisma.repositorySyncTarget.update({where:{id:target.id},data:{revision:target.revision}});
  receivedBefore=received.length;failNext=1;afterReceipt=async()=>{afterReceipt=null;await prisma.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()-INTERVAL '1 second' WHERE id=${intent.id}::uuid`;};
  let expiredDuringRetry=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{expiredDuringRetry=true;}
  check('lease expired after first failure suppresses retry socket',expiredDuringRetry&&received.length===receivedBefore+1);
  await prisma.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()+INTERVAL '60 seconds' WHERE id=${intent.id}::uuid`;
  const guardedJournal=await prisma.webhookDelivery.findFirst({where:{webhookId:repositoryHook.id,success:false,attempts:1}});
  check('suppressed retry journals one actual socket attempt not two',!!guardedJournal);
  receivedBefore=received.length;failNext=1;afterReceipt=async()=>{afterReceipt=null;await prisma.webhook.update({where:{id:repositoryHook.id},data:{active:false}});};
  let disabledDuringRetry=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{disabledDuringRetry=true;}
  check('subscription disabled after first failure suppresses retry socket',disabledDuringRetry&&received.length===receivedBefore+1);
  await prisma.webhook.update({where:{id:repositoryHook.id},data:{active:true}});
  receivedBefore=received.length;failNext=1;afterReceipt=async()=>{afterReceipt=null;await prisma.webhook.update({where:{id:repositoryHook.id},data:{url:`http://127.0.0.1:${HOOK_PORT}/changed`}});};
  let reroutedDuringRetry=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{reroutedDuringRetry=true;}
  check('destination edit after first failure sends neither old nor new retry',reroutedDuringRetry&&received.length===receivedBefore+1);
  await prisma.webhook.update({where:{id:repositoryHook.id},data:{url:repositoryHook.url}});
  receivedBefore=received.length;failNext=1;afterReceipt=async()=>{afterReceipt=null;await prisma.webhook.update({where:{id:repositoryHook.id},data:{events:['translation.removed']}});};
  let unsubscribedDuringRetry=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{unsubscribedDuringRetry=true;}
  check('event unsubscribed after first failure suppresses retry socket',unsubscribedDuringRetry&&received.length===receivedBefore+1);
  await prisma.webhook.update({where:{id:repositoryHook.id},data:{events:repositoryHook.events}});
  receivedBefore=received.length;failNext=1;afterReceipt=async()=>{afterReceipt=null;await prisma.webhook.update({where:{id:repositoryHook.id},data:{secret:'changed-fixture-secret'}});};
  let secretDuringRetry=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{secretDuringRetry=true;}
  check('secret rotation after first failure suppresses stale signature retry',secretDuringRetry&&received.length===receivedBefore+1);
  await prisma.webhook.update({where:{id:repositoryHook.id},data:{secret:repositoryHook.secret}});
  receivedBefore=received.length;failNext=1;afterReceipt=async()=>{afterReceipt=null;await prisma.webhook.delete({where:{id:repositoryHook.id}});};
  let deletedDuringRetry=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{deletedDuringRetry=true;}
  check('subscription deletion after first failure suppresses retry socket',deletedDuringRetry&&received.length===receivedBefore+1);
  await prisma.webhook.create({data:repositoryHook});
  receivedBefore=received.length;failNext=1;let disableAbaUpdates=false;
  afterReceipt=async()=>{afterReceipt=null;const disabled=await call(`${P}/webhooks/${repositoryHook.id}`,{token:at,method:'PATCH',body:{active:false}});const enabled=await call(`${P}/webhooks/${repositoryHook.id}`,{token:at,method:'PATCH',body:{active:true}});disableAbaUpdates=disabled.status===200&&enabled.status===200;};
  let disableAba=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{disableAba=true;}
  check('disable restore ABA via API aborts captured retry generation',disableAba&&disableAbaUpdates&&received.length===receivedBefore+1&&(await prisma.webhook.findUnique({where:{id:repositoryHook.id}})).active===true);
  receivedBefore=received.length;failNext=1;let routingAbaUpdates=false;
  afterReceipt=async()=>{afterReceipt=null;const changed=await call(`${P}/webhooks/${repositoryHook.id}`,{token:at,method:'PATCH',body:{url:`http://127.0.0.1:${HOOK_PORT}/temporary`}});const restored=await call(`${P}/webhooks/${repositoryHook.id}`,{token:at,method:'PATCH',body:{url:repositoryHook.url}});routingAbaUpdates=changed.status===200&&restored.status===200;};
  let routingAba=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{routingAba=true;}
  check('destination restore ABA via API aborts captured retry generation',routingAba&&routingAbaUpdates&&received.length===receivedBefore+1&&(await prisma.webhook.findUnique({where:{id:repositoryHook.id}})).url===repositoryHook.url);
  check('authenticated webhook updates monotonically advance revision',(await prisma.webhook.findUnique({where:{id:repositoryHook.id}})).revision===repositoryHook.revision+4);
  const resetStep=()=>prisma.repositoryLocalEffectIntent.update({where:{id:intent.id},data:{state:'pending',attempts:0,leaseToken:null,leaseUntil:null,finishedAt:null,webhookHandledAt:null,availableAt:new Date('2020-01-01')}});
  await resetStep();receivedBefore=received.length;const stepped=await runRepositoryWebhookStep(prisma,service);const steppedRow=await prisma.repositoryLocalEffectIntent.findUnique({where:{id:intent.id}});
  check('internal webhook step claims signs delivers and settles completed',stepped.status==='completed'&&steppedRow.state==='completed'&&steppedRow.attempts===1&&steppedRow.leaseToken===null&&steppedRow.finishedAt&&received.length===receivedBefore+1&&JSON.parse(received.at(-1).body).effectId===intent.id);
  check('successful webhook step persists independent channel checkpoint',!!steppedRow.webhookHandledAt);
  await prisma.repositoryLocalEffectIntent.update({where:{id:intent.id},data:{state:'pending',finishedAt:null,availableAt:new Date('2020-01-01')}});receivedBefore=received.length;
  const checkpointReplay=await runRepositoryWebhookStep(prisma,service);
  check('requeued checkpointed webhook channel skips receiver redelivery',checkpointReplay.status==='completed'&&received.length===receivedBefore&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:intent.id}})).webhookHandledAt.getTime()===steppedRow.webhookHandledAt.getTime());
  receivedBefore=received.length;check('completed webhook step does not redeliver',(await runRepositoryWebhookStep(prisma,service)).status==='idle'&&received.length===receivedBefore);
  await resetStep();failNext=2;const retryStep=await runRepositoryWebhookStep(prisma,service);const retryRow=await prisma.repositoryLocalEffectIntent.findUnique({where:{id:intent.id}});
  check('real receiver failure requeues step with backoff',retryStep.status==='retry'&&retryRow.state==='pending'&&retryRow.attempts===1&&retryRow.leaseToken===null&&retryRow.finishedAt===null&&received.length===receivedBefore+2);
  check('failed receiver step never writes webhook channel checkpoint',retryRow.webhookHandledAt===null);
  receivedBefore=received.length;check('webhook retry backoff makes immediate next step idle',(await runRepositoryWebhookStep(prisma,service)).status==='idle'&&received.length===receivedBefore);
  await prisma.repositoryLocalEffectIntent.update({where:{id:intent.id},data:{availableAt:new Date('2020-01-01')}});const recoveredStep=await runRepositoryWebhookStep(prisma,service);
  check('due webhook retry preserves effect ID and settles after success',recoveredStep.status==='completed'&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:intent.id}})).attempts===2&&received.length===receivedBefore+1&&JSON.parse(received.at(-1).body).effectId===intent.id);
  await resetStep();receivedBefore=received.length;
  afterReceipt=async()=>{afterReceipt=null;await prisma.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()-INTERVAL '1 second' WHERE id=${intent.id}::uuid`;};
  const lostCheckpoint=await runRepositoryWebhookStep(prisma,service);
  check('expired post-delivery lease cannot write checkpoint or claim completion',lostCheckpoint.status==='stale'&&received.length===receivedBefore+1&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:intent.id}})).webhookHandledAt===null);
  await prisma.repositoryLocalEffectIntent.update({where:{id:intent.id},data:{state:'leased',attempts:1,leaseToken:a.user.id,leaseUntil:new Date(Date.now()+3600000),finishedAt:null}});
  await prisma.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()+INTERVAL '60 seconds' WHERE id=${intent.id}::uuid`;
  await prisma.repositorySyncTarget.update({where:{id:target.id},data:{revision:{increment:1}}});receivedBefore=received.length;let staleAdapter=false;try{await deliverRepositoryWebhook(prisma,service,intent);}catch{staleAdapter=true;}
  check('repository handler rechecks changed context before any socket delivery',staleAdapter&&received.length===receivedBefore);
  await resetStep();receivedBefore=received.length;const invalidStep=await runRepositoryWebhookStep(prisma,service);
  check('changed target step is ineligible without any receiver socket',invalidStep.status==='ineligible'&&received.length===receivedBefore&&(await prisma.repositoryLocalEffectIntent.findUnique({where:{id:intent.id}})).state==='pending');
  await prisma.repositoryLocalEffectIntent.update({where:{id:intent.id},data:{state:'completed',finishedAt:new Date(),leaseToken:null,leaseUntil:null}});
  await prisma.repositorySyncTarget.update({where:{id:target.id},data:{revision:target.revision}});
  await prisma.translation.delete({where:{keyId_localeCode:{keyId:key.id,localeCode:'en'}}});
  const removalAuditId=key.id;
  await prisma.repositoryRemovalGeneration.create({data:{projectId:intentData.projectId,keyId:key.id,locale:'en',auditId:removalAuditId}});
  const removalIntent=await prisma.repositoryLocalEffectIntent.create({data:{...intentData,operation:'remove-locale-value',value:null,translationRowId:null,translationVersion:null,removalAuditId}});
  await prisma.$executeRaw`UPDATE repository_local_effect_intents SET "leaseUntil"=clock_timestamp()+INTERVAL '60 seconds' WHERE id=${removalIntent.id}::uuid`;
  await deliverRepositoryWebhook(prisma,service,removalIntent);const removedPayload=JSON.parse(received.at(-1).body);
  check('repository removal emits distinct event and null value',received.at(-1).event==='translation.removed'&&removedPayload.effectId===removalIntent.id&&removedPayload.value===null&&removedPayload.operation==='remove-locale-value');
  await prisma.webhook.update({where:{id:repositoryHook.id},data:{active:false}});receivedBefore=received.length;const disabledResult=await deliverRepositoryWebhook(prisma,service,removalIntent);
  check('repository delivery respects current disabled subscriptions',disabledResult.matched===0&&disabledResult.failed===0&&received.length===receivedBefore);
  await prisma.webhook.delete({where:{id:repositoryHook.id}});
  const del = await call(`${P}/webhooks/${hook.id}`, { token: at, method: 'DELETE' });
  check('webhook deleted', del.status === 200 && (await call(`${P}/webhooks`, { token: at })).json.length === 2);
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  rmSync(bundlePath,{force:true});rmSync(adapterPath,{force:true});rmSync(stepPath,{force:true});await prisma?.$disconnect();
  api?.kill('SIGTERM');
  receiver.close();
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `${failures} FAIL` : 'All webhook checks passed');
process.exit(failures ? 1 : 0);
