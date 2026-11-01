// Migration safety: a database written by the OLD enum schema keeps its data
// through the enum->text conversion, and the API then accepts custom statuses.
// Run: node scripts/migration-status-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55459, API_PORT = 3024;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mig-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('ol_mig');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/ol_mig`;
  const env = { ...process.env, DATABASE_URL: url };

  // Stage 1: only the historical prefix before enum-to-text. Later migrations
  // may depend on branches or other deliberately absent tables.
  const migDir = join(root, 'prisma', 'migrations');
  const staged = mkdtempSync(join(tmpdir(), 'ol-mig-stage-'));
  for (const m of readdirSync(migDir).filter((m) => m < '20261028224500_review_workflow' && !m.endsWith('.toml'))) {
    cpSync(join(migDir, m), join(staged, m), { recursive: true });
  }
  const shadow = mkdtempSync(join(tmpdir(), 'ol-mig-shadow-'));
  mkdirSync(join(shadow, 'prisma'), { recursive: true });
  cpSync(join(root, 'prisma', 'schema.prisma'), join(shadow, 'prisma', 'schema.prisma'));
  cpSync(staged, join(shadow, 'prisma', 'migrations'), { recursive: true });
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], { cwd: shadow, env, stdio: 'pipe' });

  // Seed old-schema rows: statuses written as enum values.
  const { default: pgDriver } = await import('pg');
  const db = new pgDriver.Client({ connectionString: url });
  await db.connect();
  await db.query(`
    INSERT INTO "users" (id, email, "displayName", "passwordHash", "createdAt", "updatedAt")
      VALUES ('11111111-1111-1111-1111-111111111111', 'mig@t.dev', 'Mig', 'x', now(), now());
    INSERT INTO "teams" (id, name, "createdAt", "updatedAt") VALUES ('22222222-2222-2222-2222-222222222222', 'MigTeam', now(), now());
    INSERT INTO "team_members" ("teamId", "userId", role) VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'OWNER');
    INSERT INTO "projects" (id, "teamId", name, slug, "baseLocale", "createdAt", "updatedAt")
      VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Mig', 'mig', 'en', now(), now());
    INSERT INTO "project_locales" ("projectId", code) VALUES ('33333333-3333-3333-3333-333333333333', 'en'), ('33333333-3333-3333-3333-333333333333', 'he');
    INSERT INTO "keys" (id, "projectId", name, "createdAt", "updatedAt")
      VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'mig.key', now(), now());
    INSERT INTO "translations" ("keyId", "projectId", "localeCode", value, status, "updatedAt")
      VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'he', 'שלום', 'REVIEWED', now());
  `);
  const beforeRows = await db.query(`SELECT status::text AS s FROM "translations" WHERE "localeCode" = 'he'`);
  check('seeded old-enum row exists before migration', beforeRows.rows[0]?.s === 'REVIEWED');

  // Apply the real prefix up to the new revision migration, then preserve an
  // existing automation rule through the additive revision upgrade.
  const revisionPrefix = mkdtempSync(join(tmpdir(), 'ol-rule-revision-prefix-'));
  mkdirSync(join(revisionPrefix, 'prisma'), { recursive: true });
  cpSync(join(root, 'prisma', 'schema.prisma'), join(revisionPrefix, 'prisma', 'schema.prisma'));
  mkdirSync(join(revisionPrefix, 'prisma', 'migrations'), { recursive: true });
  for (const m of readdirSync(migDir).filter((m) => m < '20261101014300_automation_rule_revision' && !m.endsWith('.toml')))
    cpSync(join(migDir, m), join(revisionPrefix, 'prisma', 'migrations', m), { recursive: true });
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], { cwd: revisionPrefix, env, stdio: 'pipe' });
  await db.query(`INSERT INTO automation_rules (id,"projectId",name,trigger,action,config,"creatorId") VALUES ('55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','Existing rule','translation.value','task.create','{"title":"Keep me"}','11111111-1111-1111-1111-111111111111')`);
  rmSync(revisionPrefix, { recursive: true, force: true });
  const retentionPrefix=mkdtempSync(join(tmpdir(),'ol-retention-prefix-'));
  mkdirSync(join(retentionPrefix,'prisma','migrations'),{recursive:true});cpSync(join(root,'prisma','schema.prisma'),join(retentionPrefix,'prisma','schema.prisma'));
  for(const m of readdirSync(migDir).filter(m=>m<'20261101113000_repository_retention_index'&&!m.endsWith('.toml')))cpSync(join(migDir,m),join(retentionPrefix,'prisma','migrations',m),{recursive:true});
  execFileSync(join(root,'node_modules','.bin','prisma'),['migrate','deploy'],{cwd:retentionPrefix,env,stdio:'pipe'});
  const retentionIntentId='66666666-6666-6666-6666-666666666666';
  await db.query(`INSERT INTO repository_local_effect_intents (id,"projectId","targetId","actorId","keyId","keyName","branchId",branch,locale,operation,value,"draftContentDigest","previewFingerprint",state,"finishedAt") SELECT $1,'33333333-3333-3333-3333-333333333333','77777777-7777-7777-7777-777777777777','11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444','retention migration',id,'main','he','set-value','preserved','digest','fingerprint','completed','2020-01-01' FROM branches WHERE "projectId"='33333333-3333-3333-3333-333333333333' AND name='main'`,[retentionIntentId]);
  await db.query(`INSERT INTO repository_automation_rule_checkpoints ("intentId","ruleId","ruleRevision") VALUES ($1,'55555555-5555-5555-5555-555555555555',1)`,[retentionIntentId]);
  rmSync(retentionPrefix,{recursive:true,force:true});
  await db.query(`INSERT INTO translation_deletion_audits (id,"projectId","keyId","keyName","localeCode","actorId",snapshot,"createdAt") VALUES ('88888888-8888-8888-8888-888888888888','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','preserved audit','he','11111111-1111-1111-1111-111111111111','{"value":"preserved","history":[{"value":"old"}]}','2020-01-01')`);
  // Stage 2: the real migration set converts enum -> text on top of that data.
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], { env, stdio: 'pipe' });
  const migratedKey=(await db.query(`SELECT name,description,"isPlural","maxLength",tags,revision,"updatedAt" FROM keys WHERE id='44444444-4444-4444-4444-444444444444'`)).rows[0];
  check('key revision migration preserves existing key metadata with initial revision one',migratedKey?.name==='mig.key'&&migratedKey.description===''&&migratedKey.isPlural===false&&migratedKey.maxLength===null&&migratedKey.tags.length===0&&migratedKey.revision===1);
  await db.query(`UPDATE keys SET description='edited',revision=1 WHERE id='44444444-4444-4444-4444-444444444444'`);
  await db.query(`UPDATE keys SET description='',revision=1 WHERE id='44444444-4444-4444-4444-444444444444'`);
  const revisedKey=(await db.query(`SELECT description,revision,"updatedAt" FROM keys WHERE id='44444444-4444-4444-4444-444444444444'`)).rows[0];
  check('migrated key trigger increments raw updates ignoring revision reset with unchanged timestamp',revisedKey.revision===3&&revisedKey.description===''&&revisedKey.updatedAt.getTime()===migratedKey.updatedAt.getTime());
  await db.query('BEGIN');await db.query(`UPDATE keys SET description='rolled back' WHERE id='44444444-4444-4444-4444-444444444444'`);await db.query('ROLLBACK');
  check('key revision and metadata rollback together',(await db.query(`SELECT revision,description FROM keys WHERE id='44444444-4444-4444-4444-444444444444'`)).rows[0].revision===3&&(await db.query(`SELECT description FROM keys WHERE id='44444444-4444-4444-4444-444444444444'`)).rows[0].description==='');
  await db.query('BEGIN');
  await db.query(`UPDATE keys SET description=description WHERE id='44444444-4444-4444-4444-444444444444'`);
  check('no-op key update also invalidates prior revision',(await db.query(`SELECT revision FROM keys WHERE id='44444444-4444-4444-4444-444444444444'`)).rows[0].revision===4);
  await db.query('ROLLBACK');
  await db.query('BEGIN');
  await db.query(`INSERT INTO keys (id,"projectId","branchId",name,"updatedAt",revision) SELECT '99999999-9999-9999-9999-999999999999',"projectId","branchId",'overflow.key',"updatedAt",2147483647 FROM keys WHERE id='44444444-4444-4444-4444-444444444444'`);
  let overflowDenied=false;try{await db.query(`UPDATE keys SET description='must not wrap' WHERE id='99999999-9999-9999-9999-999999999999'`);}catch(e){overflowDenied=e.code==='22003';}
  await db.query('ROLLBACK');
  check('key revision overflow fails closed with PostgreSQL numeric overflow',overflowDenied&&(await db.query(`SELECT id FROM keys WHERE id='99999999-9999-9999-9999-999999999999'`)).rows.length===0);
  const pageIndex=(await db.query(`SELECT indexdef FROM pg_indexes WHERE indexname='translation_deletion_audits_projectId_createdAt_id_idx'`)).rows[0]?.indexdef;
  check('audit page migration installs ordered project timestamp UUID index',pageIndex?.includes('("projectId", "createdAt", id)'));
  check('audit page migration removes redundant prefix index',(await db.query(`SELECT indexname FROM pg_indexes WHERE indexname='translation_deletion_audits_projectId_createdAt_idx'`)).rows.length===0);
  const preservedAudit=(await db.query(`SELECT *,"createdAt"::text AS stamp FROM translation_deletion_audits WHERE id='88888888-8888-8888-8888-888888888888'`)).rows[0];
  check('audit index migration preserves metadata actor timestamp and snapshot',preservedAudit?.keyName==='preserved audit'&&preservedAudit.localeCode==='he'&&preservedAudit.actorId==='11111111-1111-1111-1111-111111111111'&&preservedAudit.stamp==='2020-01-01 00:00:00'&&preservedAudit.snapshot.value==='preserved'&&preservedAudit.snapshot.history[0].value==='old');
  const retentionPreserved=(await db.query(`SELECT value,state,"finishedAt"::text AS "finishedAt" FROM repository_local_effect_intents WHERE id=$1`,[retentionIntentId])).rows[0];
  check('existing terminal intent payload and state preserved through retention index migration',retentionPreserved?.value==='preserved'&&retentionPreserved?.state==='completed'&&retentionPreserved?.finishedAt==='2020-01-01 00:00:00');
  const legacyRemovalGeneration=(await db.query(`SELECT "removalAuditId" FROM repository_local_effect_intents WHERE id=$1`,[retentionIntentId])).rows[0];
  check('removal generation migration does not invent legacy deletion identity',legacyRemovalGeneration?.removalAuditId===null&&(await db.query('SELECT count(*) AS n FROM repository_removal_generations')).rows[0].n==='0');
  const retainedCheckpoint=(await db.query(`SELECT "ruleRevision" FROM repository_automation_rule_checkpoints WHERE "intentId"=$1`,[retentionIntentId])).rows[0];
  check('existing successful rule checkpoint preserved through retention index migration',retainedCheckpoint?.ruleRevision===1);
  const retentionIndex=(await db.query(`SELECT indexdef FROM pg_indexes WHERE indexname='repository_local_effect_intents_finishedAt_id_idx'`)).rows[0]?.indexdef;
  check('retention migration installs ordered finishedAt id index',retentionIndex?.includes('("finishedAt", id)')&&retentionIndex.includes('WHERE')&&retentionIndex.includes('completed')&&retentionIndex.includes('dead'));
  const migratedRule = (await db.query(`SELECT name,config,revision FROM automation_rules WHERE id='55555555-5555-5555-5555-555555555555'`)).rows[0];
  check('existing automation rule content preserved through revision migration', migratedRule?.name === 'Existing rule' && migratedRule?.config.title === 'Keep me');
  check('existing automation rule receives initial revision one', migratedRule?.revision === 1);
  const afterRows = await db.query(`SELECT status FROM "translations" WHERE "localeCode" = 'he'`);
  check('old enum value preserved as text after migration', afterRows.rows[0]?.status === 'REVIEWED');
  const colType = await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'translations' AND column_name = 'status'`);
  check('status column is now text', colType.rows[0]?.data_type === 'text');
  const enumGone = await db.query(`SELECT 1 FROM pg_type WHERE typname = 'TranslationStatus'`);
  check('enum type dropped', enumGone.rows.length === 0);

  // Branch backfill: the pre-branches key must land on a new 'main' branch.
  const br = await db.query(`SELECT b.name FROM "keys" k JOIN "branches" b ON b.id = k."branchId" WHERE k.name = 'mig.key'`);
  check('existing key backfilled onto main branch', br.rows[0]?.name === 'main');
  const brCount = await db.query(`SELECT count(*) AS c FROM "branches" WHERE "projectId" = '33333333-3333-3333-3333-333333333333'`);
  check('exactly one default branch created per project', brCount.rows[0]?.c === '1');

  // Verify through the real API: old value preserved, custom status now works.
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...env, JWT_SECRET: 'mig-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');
  const call = async (path, { jwt, method = 'GET', body } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  // Log in as the seeded user is impossible (fake hash), so sign up a new user
  // and verify the migrated schema accepts custom statuses through the API.
  const jwt = (await call('/auth/signup', { method: 'POST', body: { email: `mig${Date.now()}@t.dev`, password: 'pass1234', displayName: 'm' } })).json.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'M2', slug: `m2-${Date.now()}`, baseLocale: 'en', locales: ['en'] } })).json.id;
  check('migrated DB serves API and new projects', !!pid);
  await call(`/projects/${pid}`, { jwt, method: 'PATCH', body: { customStatuses: ['NEEDS_WORK'] } });
  const k = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'm.k' } })).json.id;
  await call(`/projects/${pid}/keys/${k}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'x' } });
  check('custom status works on migrated DB',
    (await call(`/projects/${pid}/keys/${k}/translations/en/status`, { jwt, method: 'PATCH', body: { status: 'NEEDS_WORK' } })).status === 200);
  await db.end();
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `migration-status: ${failures} FAILURES` : 'migration-status pass complete');
process.exit(failures ? 1 : 0);
