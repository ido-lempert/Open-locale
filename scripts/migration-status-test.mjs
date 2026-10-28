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
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mig-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('ol_mig');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/ol_mig`;
  const env = { ...process.env, DATABASE_URL: url };

  // Stage 1: apply every migration EXCEPT the enum->text one, on the old schema.
  const migDir = join(root, 'prisma', 'migrations');
  const staged = mkdtempSync(join(tmpdir(), 'ol-mig-stage-'));
  for (const m of readdirSync(migDir).filter((m) => m !== '20261028224500_review_workflow' && !m.endsWith('.toml'))) {
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

  // Stage 2: the real migration set converts enum -> text on top of that data.
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], { env, stdio: 'pipe' });
  const afterRows = await db.query(`SELECT status FROM "translations" WHERE "localeCode" = 'he'`);
  check('old enum value preserved as text after migration', afterRows.rows[0]?.status === 'REVIEWED');
  const colType = await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'translations' AND column_name = 'status'`);
  check('status column is now text', colType.rows[0]?.data_type === 'text');
  const enumGone = await db.query(`SELECT 1 FROM pg_type WHERE typname = 'TranslationStatus'`);
  check('enum type dropped', enumGone.rows.length === 0);

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
} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `migration-status: ${failures} FAILURES` : 'migration-status pass complete');
process.exit(failures ? 1 : 0);
