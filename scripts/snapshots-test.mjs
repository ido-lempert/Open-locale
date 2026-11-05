// Snapshots: real PostgreSQL + real HTTP API.
// Manual capture/restore with exact state recovery, automatic pre-import
// snapshots, and scope checks. Run: node scripts/snapshots-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55452, API_PORT = 3019, HOOK_PORT = 3916;
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

const received = [];
const receiver = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { received.push({ event: req.headers['x-openlocale-event'], signature: req.headers['x-openlocale-signature'], body }); res.writeHead(200); res.end(); });
});
await new Promise((r) => receiver.listen(HOOK_PORT, '127.0.0.1', r));

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-snap-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api, prisma;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_snap');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_snap`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'snap-secret', PORT: String(API_PORT), WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true' }, stdio: 'pipe' }); // fixture-only opt-in
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const jwt = (await call('/auth/signup', { method: 'POST', body: { email: `s${Date.now()}@t.dev`, password: 'pass1234', displayName: 'S' } })).json.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Snap', slug: `snap-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;

  prisma = new PrismaClient({datasources:{db:{url}}});
  const failedLabel='audit-rollback-capture';
  const snapshotsBeforeAuditFailure=await prisma.snapshot.count({where:{projectId:pid}});
  const auditsBeforeFailure=await prisma.activityEvent.count({where:{projectId:pid,action:'snapshot.created'}});
  await prisma.$executeRawUnsafe(`CREATE FUNCTION reject_snapshot_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'snapshot.created' THEN RAISE EXCEPTION 'fixture snapshot audit failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_snapshot_audit BEFORE INSERT ON activity_events FOR EACH ROW EXECUTE FUNCTION reject_snapshot_audit()`);
  let failedCapture;
  try {failedCapture=await call(`/projects/${pid}/snapshots`,{jwt,method:'POST',body:{label:failedLabel}});}
  finally {await prisma.$executeRawUnsafe('DROP TRIGGER reject_snapshot_audit ON activity_events');await prisma.$executeRawUnsafe('DROP FUNCTION reject_snapshot_audit()');}
  check('injected capture audit failure returns HTTP500',failedCapture.status===500);
  check('failed capture audit rolls back snapshot and audit rows',await prisma.snapshot.count({where:{projectId:pid}})===snapshotsBeforeAuditFailure&&await prisma.activityEvent.count({where:{projectId:pid,action:'snapshot.created'}})===auditsBeforeFailure&&await prisma.snapshot.count({where:{projectId:pid,label:failedLabel}})===0);

  const insertFailureLabel='snapshot-insert-retry';
  const beforeInsertSnapshots=await prisma.snapshot.count({where:{projectId:pid}});
  const beforeInsertAudits=await prisma.activityEvent.count({where:{projectId:pid,action:'snapshot.created'}});
  await prisma.$executeRawUnsafe(`CREATE FUNCTION reject_snapshot_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.label = 'snapshot-insert-retry' THEN RAISE EXCEPTION 'fixture snapshot insert failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_snapshot_insert BEFORE INSERT ON snapshots FOR EACH ROW EXECUTE FUNCTION reject_snapshot_insert()`);
  let failedInsert;
  try {failedInsert=await call(`/projects/${pid}/snapshots`,{jwt,method:'POST',body:{label:insertFailureLabel}});}
  finally {await prisma.$executeRawUnsafe('DROP TRIGGER reject_snapshot_insert ON snapshots');await prisma.$executeRawUnsafe('DROP FUNCTION reject_snapshot_insert()');}
  check('snapshot insert rejection returns500 without snapshot or audit residue',failedInsert.status===500&&await prisma.snapshot.count({where:{projectId:pid}})===beforeInsertSnapshots&&await prisma.activityEvent.count({where:{projectId:pid,action:'snapshot.created'}})===beforeInsertAudits);
  const insertRetry=await call(`/projects/${pid}/snapshots`,{jwt,method:'POST',body:{label:insertFailureLabel}});
  const retryRows=await prisma.snapshot.findMany({where:{projectId:pid,label:insertFailureLabel}});
  const retryAudits=await prisma.activityEvent.findMany({where:{projectId:pid,action:'snapshot.created'}});
  check('same-label retry after insert failure commits exactly one snapshot with matching audit identity',insertRetry.status===201&&retryRows.length===1&&retryRows[0].id===insertRetry.json.id&&retryAudits.length===beforeInsertAudits+1&&retryAudits.filter(row=>row.detail?.snapshotId===insertRetry.json.id&&row.detail?.label===insertFailureLabel).length===1);

  // Valid branch/key pairs must never alias when their concatenations match.
  const collisionProject=await call('/projects',{jwt,method:'POST',body:{name:'Tuple identity',slug:`tuple-${Date.now()}`,baseLocale:'en',locales:['en']}});
  const cp=collisionProject.json.id;
  const branchA=await call(`/projects/${cp}/branches`,{jwt,method:'POST',body:{name:'a'}});
  const branchAB=await call(`/projects/${cp}/branches`,{jwt,method:'POST',body:{name:'ab'}});
  const keyA=await call(`/projects/${cp}/keys`,{jwt,method:'POST',body:{branch:'a',name:'bc'}});
  const valueA=await call(`/projects/${cp}/keys/${keyA.json.id}/translations`,{jwt,method:'PUT',body:{locale:'en',value:'first-original'}});
  const single=await call(`/projects/${cp}/snapshots`,{jwt,method:'POST',body:{label:'single tuple'}});
  const keyAB=await call(`/projects/${cp}/keys`,{jwt,method:'POST',body:{branch:'ab',name:'c'}});
  const valueAB=await call(`/projects/${cp}/keys/${keyAB.json.id}/translations`,{jwt,method:'PUT',body:{locale:'en',value:'second-original'}});
  check('colliding tuple fixture writes succeed with distinct branch/key ids',collisionProject.status===201&&branchA.status===201&&branchAB.status===201&&keyA.status===201&&keyAB.status===201&&keyA.json.id!==keyAB.json.id&&valueA.status===200&&valueAB.status===200&&single.status===201);
  const singleRestore=await call(`/projects/${cp}/snapshots/${single.json.id}/restore`,{jwt,method:'POST'});
  const remainingAB=await call(`/projects/${cp}/keys?branch=ab`,{jwt});
  check('restore removes post-snapshot key despite concatenated branch/key collision',singleRestore.status===201&&singleRestore.json.keysRemoved===1&&remainingAB.status===200&&remainingAB.json.length===0);
  // Isolate the paired-value assertion even if the preceding deletion check fails.
  for(const leftover of remainingAB.json) await call(`/projects/${cp}/keys/${leftover.id}`,{jwt,method:'DELETE'});
  const secondKey=await call(`/projects/${cp}/keys`,{jwt,method:'POST',body:{branch:'ab',name:'c'}});
  const secondValue=secondKey.status===201?await call(`/projects/${cp}/keys/${secondKey.json.id}/translations`,{jwt,method:'PUT',body:{locale:'en',value:'second-original'}}):{status:0};
  const paired=await call(`/projects/${cp}/snapshots`,{jwt,method:'POST',body:{label:'paired tuples'}});
  const changeA=await call(`/projects/${cp}/keys/${keyA.json.id}/translations`,{jwt,method:'PUT',body:{locale:'en',value:'first-changed'}});
  const activeSecond=secondKey.status===201?secondKey.json.id:keyAB.json.id;
  const changeAB=await call(`/projects/${cp}/keys/${activeSecond}/translations`,{jwt,method:'PUT',body:{locale:'en',value:'second-changed'}});
  const changedA=await call(`/projects/${cp}/export/en?flat=true&branch=a`,{jwt});
  const changedAB=await call(`/projects/${cp}/export/en?flat=true&branch=ab`,{jwt});
  const pairedRestore=await call(`/projects/${cp}/snapshots/${paired.json.id}/restore`,{jwt,method:'POST'});
  const restoredA=await call(`/projects/${cp}/export/en?flat=true&branch=a`,{jwt});
  const restoredAB=await call(`/projects/${cp}/export/en?flat=true&branch=ab`,{jwt});
  check('paired tuple snapshot and discriminating mutations succeed',secondKey.status===201&&secondValue.status===200&&paired.status===201&&paired.json.keyCount===2&&changeA.status===200&&changeAB.status===200&&changedA.status===200&&changedAB.status===200&&changedA.json.bc==='first-changed'&&changedAB.json.c==='second-changed');
  check('restore keeps both colliding tuple translations distinct',pairedRestore.status===201&&pairedRestore.json.valuesChanged===2&&restoredA.status===200&&restoredAB.status===200&&restoredA.json.bc==='first-original'&&restoredAB.json.c==='second-original');

  const tupleHistoryA=await call(`/projects/${cp}/keys/${keyA.json.id}/translations/en/history`,{jwt});
  const tupleHistoryAB=await call(`/projects/${cp}/keys/${activeSecond}/translations/en/history`,{jwt});
  check('colliding tuple restore history records each branch previous value',tupleHistoryA.status===200&&tupleHistoryAB.status===200&&tupleHistoryA.json.filter(h=>h.value==='first-original'&&h.previousValue==='first-changed').length===1&&tupleHistoryAB.json.filter(h=>h.value==='second-original'&&h.previousValue==='second-changed').length===1&&!tupleHistoryA.json.some(h=>h.previousValue==='second-changed')&&!tupleHistoryAB.json.some(h=>h.previousValue==='first-changed'));
  const tupleVersionsBefore=await prisma.translation.findMany({where:{projectId:cp},orderBy:{keyId:'asc'},select:{keyId:true,localeCode:true,version:true,value:true}});
  const historyCountBefore=await prisma.translationHistory.count({where:{keyId:{in:[keyA.json.id,activeSecond]}}});
  const repeatPaired=await call(`/projects/${cp}/snapshots/${paired.json.id}/restore`,{jwt,method:'POST'});
  const tupleVersionsAfter=await prisma.translation.findMany({where:{projectId:cp},orderBy:{keyId:'asc'},select:{keyId:true,localeCode:true,version:true,value:true}});
  check('unchanged colliding tuple restore adds no translation history or version changes',repeatPaired.status===201&&repeatPaired.json.valuesChanged===0&&repeatPaired.json.keysRemoved===0&&historyCountBefore===await prisma.translationHistory.count({where:{keyId:{in:[keyA.json.id,activeSecond]}}})&&tupleVersionsBefore.length===2&&JSON.stringify(tupleVersionsBefore)===JSON.stringify(tupleVersionsAfter));

  // Seed two keys with translations.
  await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { 'a.one': 'one', 'a.two': 'two' } } });
  await call(`/projects/${pid}/import/he`, { jwt, method: 'POST', body: { entries: { 'a.one': 'אחד', 'a.two': 'שניים' } } });
  const flat = async () => (await call(`/projects/${pid}/export/en?flat=true`, { jwt })).json;
  const flatHe = async () => (await call(`/projects/${pid}/export/he?flat=true`, { jwt })).json;

  const emptyLabel = await call(`/projects/${pid}/snapshots`, { jwt, method: 'POST', body: { label: '  ' } });
  check('blank label rejected 400', emptyLabel.status === 400);

  const snap = await call(`/projects/${pid}/snapshots`, { jwt, method: 'POST', body: { label: 'v1 baseline' } });
  check('manual snapshot created with counts', snap.status === 201 && snap.json.keyCount === 2 && snap.json.translationCount === 4, JSON.stringify(snap.json));
  const snapId = snap.json.id;

  // Auto snapshots exist from the two imports above.
  const listed = await call(`/projects/${pid}/snapshots`, { jwt });
  const autos = listed.json.filter((s) => s.automatic);
  check('imports captured automatic pre-import snapshots', autos.length === 2 && autos.every((s) => s.label.startsWith('before import')), JSON.stringify(autos.map((a) => a.label)));

  // Mutate: change a value, delete a key, add a key.
  const keyTwo = (await call(`/projects/${pid}/keys`, { jwt })).json.find((k) => k.name === 'a.two');
  const changed = await call(`/projects/${pid}/keys/${keyTwo.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'TWO-CHANGED' } });
  const beforeDelete = await flat();
  const deleted = await call(`/projects/${pid}/keys/${keyTwo.id}`, { jwt, method: 'DELETE' });
  const added = await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'b.new' } });
  const addedValue = await call(`/projects/${pid}/keys/${added.json.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: '' } });
  check('added key blank translation persisted before restore', addedValue.status === 200);
  const beforeRestore = await flat();
  const mutationsApplied = (changeStatus, deleteStatus, addStatus, changedState, finalState) =>
    changeStatus === 200 && deleteStatus === 200 && addStatus === 201 &&
    changedState['a.two'] === 'TWO-CHANGED' && finalState['a.one'] === 'one' &&
    !('a.two' in finalState) && Object.hasOwn(finalState, 'b.new') && finalState['b.new'] === '' &&
    Object.keys(finalState).length === 2;
  check('mutation precondition rejects unchanged fixture state', !mutationsApplied(200,200,201,{'a.one':'one','a.two':'two'},{'a.one':'one','a.two':'two'}));
  check('mutations applied before restore with successful HTTP writes', mutationsApplied(changed.status,deleted.status,added.status,beforeDelete,beforeRestore), JSON.stringify({statuses:[changed.status,deleted.status,added.status],beforeDelete,beforeRestore}));

  const restoreRows=async()=>({
    keys:await prisma.key.findMany({where:{projectId:pid},orderBy:{id:'asc'}}),
    translations:await prisma.translation.findMany({where:{projectId:pid},orderBy:[{keyId:'asc'},{localeCode:'asc'}]}),
    history:await prisma.translationHistory.findMany({where:{translation:{projectId:pid}},orderBy:{id:'asc'}}),
    audits:await prisma.activityEvent.findMany({where:{projectId:pid,action:'snapshot.restored'},orderBy:{id:'asc'}}),
  });
  const rowsBeforeSafetyFailure=await restoreRows();
  const snapshotsBeforeSafetyFailure=await prisma.snapshot.findMany({where:{projectId:pid},orderBy:{id:'asc'}});
  await prisma.$executeRawUnsafe(`CREATE FUNCTION reject_restore_safety() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.automatic AND NEW.label = 'before restore of v1 baseline' THEN RAISE EXCEPTION 'fixture restore safety capture failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_restore_safety BEFORE INSERT ON snapshots FOR EACH ROW EXECUTE FUNCTION reject_restore_safety()`);
  let failedSafety;
  try {failedSafety=await call(`/projects/${pid}/snapshots/${snapId}/restore`,{jwt,method:'POST'});}
  finally {await prisma.$executeRawUnsafe('DROP TRIGGER reject_restore_safety ON snapshots');await prisma.$executeRawUnsafe('DROP FUNCTION reject_restore_safety()');}
  check('safety capture rejection aborts restore without changing persisted data or snapshots',failedSafety.status===500&&JSON.stringify(rowsBeforeSafetyFailure)===JSON.stringify(await restoreRows())&&JSON.stringify(snapshotsBeforeSafetyFailure)===JSON.stringify(await prisma.snapshot.findMany({where:{projectId:pid},orderBy:{id:'asc'}}))&&JSON.stringify(await flat())===JSON.stringify(beforeRestore));

  const beforeRestoreFailure=await restoreRows();
  const snapshotsBeforeRestoreFailure=await prisma.snapshot.findMany({where:{projectId:pid},select:{id:true}});
  await prisma.$executeRawUnsafe(`CREATE FUNCTION reject_restore_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'snapshot.restored' THEN RAISE EXCEPTION 'fixture restore audit failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_restore_audit BEFORE INSERT ON activity_events FOR EACH ROW EXECUTE FUNCTION reject_restore_audit()`);
  let failedRestore;
  try {failedRestore=await call(`/projects/${pid}/snapshots/${snapId}/restore`,{jwt,method:'POST'});}
  finally {await prisma.$executeRawUnsafe('DROP TRIGGER reject_restore_audit ON activity_events');await prisma.$executeRawUnsafe('DROP FUNCTION reject_restore_audit()');}
  check('restore audit rejection returns500 and rolls back key translation history and audit writes',failedRestore.status===500&&JSON.stringify(beforeRestoreFailure)===JSON.stringify(await restoreRows())&&JSON.stringify(await flat())===JSON.stringify(beforeRestore));
  const newSafety=await prisma.snapshot.findMany({where:{projectId:pid,id:{notIn:snapshotsBeforeRestoreFailure.map(s=>s.id)}}});
  check('failed restore retains its separately committed pre-restore safety snapshot',newSafety.length===1&&newSafety[0].automatic&&newSafety[0].label==='before restore of v1 baseline'&&newSafety[0].keys.length===2&&newSafety[0].keys.some(k=>k.name==='b.new')&&!newSafety[0].keys.some(k=>k.name==='a.two'));

  // Restore the baseline.
  const restore = await call(`/projects/${pid}/snapshots/${snapId}/restore`, { jwt, method: 'POST' });
  check('restore returns recovery summary', restore.status === 201 && restore.json.restored === true, JSON.stringify(restore.json));
  const enAfter = await flat();
  const heAfter = await flatHe();
  check('restore recovers exact en state', enAfter['a.one'] === 'one' && enAfter['a.two'] === 'two');
  check('restore recovers exact he state', heAfter['a.one'] === 'אחד' && heAfter['a.two'] === 'שניים');
  check('restore removes keys added after the snapshot', !('b.new' in enAfter));
  check('restore brings back deleted keys', 'a.two' in enAfter);

  // History and activity reflect the restore.
  const keysNow = (await call(`/projects/${pid}/keys`, { jwt })).json;
  const kTwo = keysNow.find((k) => k.name === 'a.two');
  const hist = await call(`/projects/${pid}/keys/${kTwo.id}/translations/en/history`, { jwt });
  check('restore writes translation-history rows', hist.json.some((h) => h.value === 'two'));
  const act = await call(`/projects/${pid}/activity`, { jwt });
  check('activity records snapshot.created and snapshot.restored',
    act.json.items.some((e) => e.action === 'snapshot.created') && act.json.items.some((e) => e.action === 'snapshot.restored'));

  // Auto snapshot restores pre-import state: first auto snapshot was taken
  // before the very first import, so the project was empty then.
  const firstAuto = autos[autos.length - 1];
  const restoreAuto = await call(`/projects/${pid}/snapshots/${firstAuto.id}/restore`, { jwt, method: 'POST' });
  const enAfterAuto = await flat();
  check('restoring the first pre-import snapshot empties the project',
    restoreAuto.status === 201 && Object.keys(enAfterAuto).length === 0, JSON.stringify(enAfterAuto));

  // Restore emits a project.restored webhook (after commit, fire-and-forget).
  const restoreHook=await call(`/projects/${pid}/webhooks`, { jwt, method: 'POST', body: { url: `http://127.0.0.1:${HOOK_PORT}/hook`, events: ['project.restored'] } });
  const webhookRestore=await call(`/projects/${pid}/snapshots/${snapId}/restore`, { jwt, method: 'POST' });
  let hookHit;
  for (let i = 0; i < 20 && !hookHit; i++) {
    await new Promise((r) => setTimeout(r, 250));
    hookHit = received.find((e) => e.event === 'project.restored');
  }
  const verifiesRestoreSignature=(body,secret,signature)=>typeof secret==='string'&&signature==='sha256='+createHmac('sha256',secret).update(body).digest('hex');
  check('restore delivers a signed project.restored webhook', restoreHook.status===201&&webhookRestore.status===201&&!!hookHit&&JSON.parse(hookHit.body).snapshotId===snapId&&verifiesRestoreSignature(hookHit.body,restoreHook.json.secret,hookHit.signature));
  check('restore signature verification rejects altered bytes and wrong secret',!!hookHit&&!verifiesRestoreSignature(hookHit.body+' ',restoreHook.json.secret,hookHit.signature)&&!verifiesRestoreSignature(hookHit.body,restoreHook.json.secret+'wrong',hookHit.signature));
  const restorePayload=hookHit?JSON.parse(hookHit.body):{};
  check('signed restore payload counters match committed HTTP result',restorePayload.event==='project.restored'&&restorePayload.keysRemoved===webhookRestore.json.keysRemoved&&restorePayload.valuesChanged===webhookRestore.json.valuesChanged&&webhookRestore.json.valuesChanged===4&&Object.keys(await flat()).length===2);


  // Pre-restore safety capture: a mistaken restore is itself recoverable.
  // Current state is empty (first-auto restore above). Mutate, restore the
  // baseline, then restore the pre-restore capture to get the mutation back.
  await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { 'safety.key': 'keep-me' } } });
  const preRestoreState = await flat();
  await call(`/projects/${pid}/snapshots/${snapId}/restore`, { jwt, method: 'POST' });
  check('restore wiped the post-snapshot mutation', !('safety.key' in (await flat())));
  const allSnaps = (await call(`/projects/${pid}/snapshots`, { jwt })).json;
  const safety = allSnaps.find((x) => x.label === 'before restore of v1 baseline');
  check('restore captured a pre-restore safety snapshot', !!safety && safety.automatic === true);
  const recover = await call(`/projects/${pid}/snapshots/${safety.id}/restore`, { jwt, method: 'POST' });
  const recovered = await flat();
  check('pre-restore state fully recoverable', recover.status === 201 && recovered['safety.key'] === 'keep-me'
    && Object.keys(recovered).length === Object.keys(preRestoreState).length);

  // Concurrency: restore and import serialize; both complete, no 500s.
  const [impRes, resRes] = await Promise.all([
    call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { 'race.key': 'raced' } } }),
    call(`/projects/${pid}/snapshots/${snapId}/restore`, { jwt, method: 'POST' }),
  ]);
  check('concurrent import+restore both succeed', impRes.status === 201 && resRes.status === 201,
    `${impRes.status}/${resRes.status}`);
  const raceAfter = await flat();
  const raceHeAfter=await flatHe();
  const exactFlat=(actual,expected)=>Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([key,value])=>Object.hasOwn(actual,key)&&actual[key]===value);
  const serialRaceState=(en,he)=>exactFlat(he,{'a.one':'אחד','a.two':'שניים'})&&(exactFlat(en,{'a.one':'one','a.two':'two'})||exactFlat(en,{'a.one':'one','a.two':'two','race.key':'raced'}));
  check('serial race predicate rejects unrelated missing and wrong-value fixtures',!serialRaceState({'a.one':'one','a.two':'two','unrelated':'residue'},{'a.one':'אחד','a.two':'שניים'})&&!serialRaceState({'a.one':'one'},{'a.one':'אחד','a.two':'שניים'})&&!serialRaceState({'a.one':'one','a.two':'wrong','race.key':'raced'},{'a.one':'אחד','a.two':'שניים'})&&!serialRaceState({'a.one':'one','a.two':'two'},{'a.one':'אחד','a.two':'wrong'}));
  check('post-race state matches one serial order', serialRaceState(raceAfter,raceHeAfter),JSON.stringify({en:raceAfter,he:raceHeAfter}));

  // Unknown snapshot -> 404.
  const missing = await call(`/projects/${pid}/snapshots/00000000-0000-0000-0000-000000000000/restore`, { jwt, method: 'POST' });
  check('unknown snapshot restore is 404', missing.status === 404);

  // Cross-team isolation: a different user gets 404, never the data.
  const jwt2 = (await call('/auth/signup', { method: 'POST', body: { email: `s2${Date.now()}@t.dev`, password: 'pass1234', displayName: 'S2' } })).json.accessToken;
  check('cross-team snapshot list is 404', (await call(`/projects/${pid}/snapshots`, { jwt: jwt2 })).status === 404);
  check('cross-team snapshot restore is 404', (await call(`/projects/${pid}/snapshots/${snapId}/restore`, { jwt: jwt2, method: 'POST' })).status === 404);

  // Retention: automatic snapshots prune to 25 per project, manual preserved.
  for (let i = 0; i < 26; i++) {
    await call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { [`bulk.k${i}`]: `v${i}` } } });
  }
  const afterBulk = (await call(`/projects/${pid}/snapshots`, { jwt })).json;
  const autoCount = afterBulk.filter((x) => x.automatic).length;
  check('automatic snapshots pruned to 25', autoCount === 25, `count=${autoCount}`);
  check('manual snapshot survives pruning', afterBulk.some((x) => x.id === snapId));

  // Concurrency: serialized imports -> each auto snapshot is an authoritative,
  // strictly-growing pre-import state (sorted by creation, counts increase).
  const before = (await flat());
  const concRes = await Promise.all([0, 1, 2].map((i) =>
    call(`/projects/${pid}/import/en`, { jwt, method: 'POST', body: { entries: { [`conc.k${i}`]: `c${i}` } } })));
  const after = await flat();
  const expectedConcurrent={...before,'conc.k0':'c0','conc.k1':'c1','conc.k2':'c2'};
  check('concurrent import predicate rejects wrong missing and extra values',!exactFlat({...expectedConcurrent,'conc.k0':'wrong'},expectedConcurrent)&&!exactFlat(before,expectedConcurrent)&&!exactFlat({...expectedConcurrent,extra:'residue'},expectedConcurrent));
  check('concurrent imports all applied', concRes.every(r=>r.status===201)&&exactFlat(after,expectedConcurrent));
  const concSnaps = (await call(`/projects/${pid}/snapshots`, { jwt })).json
    .filter((x) => x.automatic)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const base = Object.keys(before).length;
  const counts = concSnaps.slice(-3).map((x) => x.keyCount);
  const exactCaptureCounts=(values,start)=>values.length===3&&values.every((value,index)=>value===start+index);
  check('concurrent snapshot predicate rejects skipped initial state',!exactCaptureCounts([base+1,base+2,base+3],base)&&!exactCaptureCounts([base,base+1],base));
  check('concurrent auto snapshots capture strictly-growing states',
    exactCaptureCounts(counts,base),
    `counts=${counts.join(',')} base=${base}`);

  // Scope: read-only token reads but cannot create/restore.
  const roTok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'ro', scopes: ['read'] } })).json.token;
  check('read-only token lists snapshots', (await call(`/projects/${pid}/snapshots`, { apiKey: roTok })).status === 200);
  check('read-only token cannot create snapshots', (await call(`/projects/${pid}/snapshots`, { apiKey: roTok, method: 'POST', body: { label: 'x' } })).status === 403);
  check('read-only token cannot restore', (await call(`/projects/${pid}/snapshots/${snapId}/restore`, { apiKey: roTok, method: 'POST' })).status === 403);
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  receiver.close();
  if (api) api.kill('SIGTERM');
  await prisma?.$disconnect();
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `snapshots: ${failures} FAILURES` : 'snapshots pass complete');
process.exit(failures ? 1 : 0);
