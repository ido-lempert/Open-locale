// Phase 0 integration test: real PostgreSQL via embedded-postgres + prisma migrate deploy.
// Run: node scripts/phase0-db-test.mjs
import { execFileSync } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 55432;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
function check(name, cond) {
  if (cond) { console.log(`PASS ${name}`); }
  else { failures += 1; console.log(`FAIL ${name}`); }
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-'));
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: false,
});

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('openlocale_test');
  const url = `postgresql://postgres:postgres@localhost:${PORT}/openlocale_test`;

  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  console.log('PASS prisma migrate deploy on real PostgreSQL');

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  const user = await prisma.user.create({
    data: {
      email: 'dev@open-locale.dev',
      passwordHash: 'x',
      displayName: 'Dev',
      memberships: { create: { role: 'OWNER', team: { create: { name: "Dev's team" } } } },
    },
    include: { memberships: true },
  });
  check('signup creates user with owned team', user.memberships.length === 1);

  const project = await prisma.project.create({
    data: {
      teamId: user.memberships[0].teamId,
      name: 'Shop', slug: 'shop', baseLocale: 'en',
      locales: { create: [{ code: 'en' }, { code: 'he' }] },
    },
    include: { locales: true },
  });
  check('project created with two locales', project.locales.length === 2);

  const mainBranch = await prisma.branch.create({ data: { projectId: project.id, name: 'main' } });
  const entries = { 'checkout.pay_button': 'Pay', 'checkout.cart.title': 'Cart' };
  for (const [name, value] of Object.entries(entries)) {
    const key = await prisma.key.upsert({
      where: { branchId_name: { branchId: mainBranch.id, name } },
      create: { projectId: project.id, branchId: mainBranch.id, name }, update: {},
    });
    await prisma.translation.upsert({
      where: { keyId_localeCode: { keyId: key.id, localeCode: 'en' } },
      create: { keyId: key.id, projectId: project.id, localeCode: 'en', value },
      update: { value },
    });
  }
  const exported = await prisma.translation.findMany({
    where: { projectId: project.id, localeCode: 'en' }, include: { key: true },
  });
  check('export returns both translations', exported.length === 2);

  const key = await prisma.key.findFirstOrThrow({ where: { projectId: project.id, name: 'checkout.pay_button' } });
  await prisma.translation.create({
    data: { keyId: key.id, projectId: project.id, localeCode: 'he', value: 'שלם' },
  });
  const he = await prisma.translation.findUniqueOrThrow({
    where: { keyId_localeCode: { keyId: key.id, localeCode: 'he' } },
  });
  check('hebrew (unicode) translation round-trips', he.value === 'שלם');

  let dupFailed = false;
  try {
    await prisma.key.create({ data: { projectId: project.id, name: 'checkout.pay_button' } });
  } catch { dupFailed = true; }
  check('duplicate key name rejected', dupFailed);

  await prisma.project.delete({ where: { id: project.id } });
  const orphanKeys = await prisma.key.count({ where: { projectId: project.id } });
  const orphanTr = await prisma.translation.count({ where: { projectId: project.id } });
  check('project delete cascades to keys and translations', orphanKeys === 0 && orphanTr === 0);

  await prisma.$disconnect();
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}

if (failures > 0) { console.log(`${failures} check(s) FAILED`); process.exit(1); }
console.log('All integration checks passed');
process.exitCode = 0;
