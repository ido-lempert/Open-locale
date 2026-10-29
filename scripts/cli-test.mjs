// CLI end-to-end: real PostgreSQL + real built API + the real CLI as a child process.
// Run: node scripts/cli-test.mjs   (requires dist/apps/api built)
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55451, API_PORT = 3018;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
const CLI = join(root, 'apps', 'cli', 'src', 'main.mjs');
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
const cli = (args, cwd) => {
  // stdout and stderr are always merged: skip/failure detail goes to stderr
  // even on a zero exit, and assertions read the full picture.
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
  return { status: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-cli-'));
const workDir = mkdtempSync(join(tmpdir(), 'ol-cli-work-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
let prisma;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_cli');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_cli`;
  prisma = new PrismaClient({ datasources: { db: { url } } });
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'cli-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const email = `cli${Date.now()}@t.dev`;
  const jwt = (await call('/auth/signup', { method: 'POST', body: { email, password: 'pass1234', displayName: 'Cli' } })).json.accessToken;
  const proj = await call('/projects', { jwt, method: 'POST', body: { name: 'Cli Proj', slug: `cli-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } });
  const tok = await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'cli', scopes: ['read', 'write'] } });
  writeFileSync(join(workDir, 'open-locale.json'), JSON.stringify({ url: `http://127.0.0.1:${API_PORT}`, token: tok.json.token, project: proj.json.id }));

  // push
  writeFileSync(join(workDir, 'he.json'), JSON.stringify({ 'app.title': 'כותרת', 'app.sub': 'תת' }));
  const push = cli(['push', 'he.json', '--locale', 'he'], workDir);
  check('cli push imports a JSON file', push.status === 0 && /upserted/.test(push.out) && push.out.includes('2 upserted'), push.out.trim());
  const viaApi = await call(`/projects/${proj.json.id}/export/he?flat=true`, { jwt });
  check('pushed values visible via API export', viaApi.json?.['app.title'] === 'כותרת');

  // keys
  const keys = cli(['keys'], workDir);
  check('cli keys lists pushed keys', keys.status === 0 && keys.out.includes('app.title') && keys.out.includes('app.sub'));

  // pull json to file
  const pull = cli(['pull', '--locale', 'he', '-o', 'out.json'], workDir);
  const pulled = existsSync(join(workDir, 'out.json')) ? JSON.parse(readFileSync(join(workDir, 'out.json'), 'utf8')) : null; // nested export
  check('cli pull writes the export file', pull.status === 0 && pulled?.app?.sub === 'תת', pull.out.trim());

  // pull android to stdout
  const pullA = cli(['pull', '--locale', 'he', '--format', 'android'], workDir);
  check('cli pull android prints strings.xml', pullA.status === 0 && pullA.out.includes('<string'), pullA.out.trim().slice(0, 120));

  // additional formats
  writeFileSync(join(workDir, 'he.po'), 'msgid "app.title"\nmsgstr "כותרת פו"\n');
  const pushPo = cli(['push', 'he.po', '--locale', 'he'], workDir);
  check('cli push imports a PO file', pushPo.status === 0 && pushPo.out.includes('1 upserted'), pushPo.out.trim());
  const pullYaml = cli(['pull', '--locale', 'he', '--format', 'yaml'], workDir);
  check('cli pull yaml prints the locale root', pullYaml.status === 0 && pullYaml.out.includes('he:'), pullYaml.out.trim().slice(0, 80));
  const pullArb = cli(['pull', '--locale', 'he', '--format', 'arb'], workDir);
  check('cli pull arb carries the locale marker', pullArb.status === 0 && pullArb.out.includes('"@@locale": "he"'), pullArb.out.trim().slice(0, 80));
  const badFmt = cli(['pull', '--locale', 'he', '--format', 'toml'], workDir);
  check('cli pull rejects an unknown format', badFmt.status === 1 && badFmt.out.includes('unknown format'), badFmt.out.trim());

  // bundle round-trip through the CLI
  const pullAll = cli(['pull', '--all', '--format', 'json', '-o', 'bundle.zip'], workDir);
  const bundleBuf = existsSync(join(workDir, 'bundle.zip')) ? readFileSync(join(workDir, 'bundle.zip')) : Buffer.alloc(0);
  const entryCount = bundleBuf.length > 22 && bundleBuf.readUInt32LE(bundleBuf.length - 22) === 0x06054b50 ? bundleBuf.readUInt16LE(bundleBuf.length - 12) : 0;
  check('cli pull --all writes a store-only zip with one entry per locale', pullAll.status === 0 && entryCount === 2, pullAll.out.trim());
  const pushZip = cli(['push', 'bundle.zip'], workDir);
  check('cli push bundle imports every locale with a per-locale summary', pushZip.status === 0 && pushZip.out.includes('en:') && pushZip.out.includes('he:') && pushZip.out.includes('store-only'), pushZip.out.trim().slice(0, 200));
  const tamperedZip = Buffer.from(bundleBuf);
  tamperedZip[30 + 'en.json'.length] ^= 0xff;
  writeFileSync(join(workDir, 'bad.zip'), tamperedZip);
  const pushBad = cli(['push', 'bad.zip'], workDir);
  check('cli push of a CRC-tampered bundle fails nonzero with the reason', pushBad.status === 1 && pushBad.out.includes('CRC mismatch'), pushBad.out.trim().slice(0, 160));
  const mixZip = Buffer.from(bundleBuf);
  const cdBase = mixZip.length - 22 - 2 * (46 + 'en.json'.length);
  const heRec = cdBase + 46 + 'en.json'.length;
  mixZip.fill(0x66, heRec + 46, heRec + 47); // 'h' -> 'f'
  mixZip.fill(0x72, heRec + 47, heRec + 48); // 'e' -> 'r'
  const heLocal = mixZip.readUInt32LE(heRec + 42);
  mixZip.fill(0x66, heLocal + 30, heLocal + 31);
  mixZip.fill(0x72, heLocal + 31, heLocal + 32);
  writeFileSync(join(workDir, 'mix.zip'), mixZip);
  const pushMix = cli(['push', 'mix.zip'], workDir);
  check('cli push bundle reports an unmatched entry as skipped, exit 0', pushMix.status === 0 && pushMix.out.includes('skipped entry fr.json') && pushMix.out.includes('exit stays 0') && pushMix.out.includes('en:'), pushMix.out.trim().slice(0, 200));

  // Partial key failure through the CLI: a task-locked key fails inside an
  // HTTP-200 locale import, and the CLI must still exit 1. Lock skips apply to
  // MEMBERs (ADMIN/OWNER override), so this leg runs as a member token.
  const memEmail = `clim${Date.now()}@t.dev`;
  const memSignup = (await call('/auth/signup', { method: 'POST', body: { email: memEmail, password: 'pass1234', displayName: 'Cli Member' } })).json;
  const memJwt = memSignup.accessToken;
  const memUserId = memSignup.user.id;
  await call(`/projects/${proj.json.id}/members`, { jwt, method: 'POST', body: { email: memEmail, role: 'MEMBER', allowedLocales: ['en', 'he'] } });
  const memTok = (await call('/auth/tokens', { jwt: memJwt, method: 'POST', body: { name: 'cli-member', scopes: ['read', 'write'] } })).json.token;
  // Diverge the live value so the bundle's older value would be a real write,
  // then lock the key before the member pushes the bundle.
  await call(`/projects/${proj.json.id}/import/he`, { jwt, method: 'POST', body: { entries: { 'app.title': 'שונה' } } });
  const cliKeys = (await call(`/projects/${proj.json.id}/keys`, { jwt })).json;
  const lockTask = (await call(`/projects/${proj.json.id}/tasks`, { jwt, method: 'POST', body: { title: 'lock app.title', lockKeys: true, keyIds: [cliKeys.find((k) => k.name === 'app.title').id] } })).json;
  writeFileSync(join(workDir, 'open-locale.json'), JSON.stringify({ url: `http://127.0.0.1:${API_PORT}`, token: memTok, project: proj.json.id }));
  const pushLocked = cli(['push', 'bundle.zip'], workDir);
  check('cli push bundle exits nonzero when a key is locked, locale HTTP still succeeds', pushLocked.status === 1 && pushLocked.out.includes('he:') && pushLocked.out.includes('1 failed') && !pushLocked.out.includes('(403)'), pushLocked.out.trim().slice(0, 200));
  await call(`/projects/${proj.json.id}/tasks/${lockTask.id}`, { jwt, method: 'PATCH', body: { status: 'DONE' } });

  // Grant-denied locale through the CLI: member loses en, so en lands in
  // failedLocales (403) and the CLI must exit 1 while he still imports.
  await call(`/projects/${proj.json.id}/members/${memUserId}`, { jwt, method: 'PATCH', body: { allowedLocales: ['he'] } });
  const pushDenied = cli(['push', 'bundle.zip'], workDir);
  check('cli push bundle exits nonzero when a locale is grant-denied', pushDenied.status === 1 && pushDenied.out.includes('en failed (403)') && pushDenied.out.includes('he:'), pushDenied.out.trim().slice(0, 200));

  // Branch scoping through the CLI: --branch writes and reads only the branch.
  // Pin main to a distinct marker first so branch writes can never pass by
  // accidentally matching main's current value.
  await call(`/projects/${proj.json.id}/branches`, { jwt, method: 'POST', body: { name: 'cli-br' } });
  await call(`/projects/${proj.json.id}/import/he`, { jwt, method: 'POST', body: { entries: { 'app.title': 'ראשי' } } });
  writeFileSync(join(workDir, 'open-locale.json'), JSON.stringify({ url: `http://127.0.0.1:${API_PORT}`, token: tok.json.token, project: proj.json.id }));
  writeFileSync(join(workDir, 'br.json'), JSON.stringify({ 'app.title': 'ענף' }));
  const pushBr = cli(['push', 'br.json', '--locale', 'he', '--branch', 'cli-br'], workDir);
  const pullBr = cli(['pull', '--locale', 'he', '--branch', 'cli-br'], workDir);
  const pullMain = cli(['pull', '--locale', 'he'], workDir);
  check('cli push/pull --branch writes and reads only the branch', pushBr.status === 0 && pullBr.out.includes('ענף') && !pullMain.out.includes('ענף') && pullMain.out.includes('ראשי'), `${pushBr.status}|${pullBr.status}|${pullMain.status}`);
  // Bundle push --branch routes every locale import to the named branch.
  const pushZipBr = cli(['push', 'bundle.zip', '--branch', 'cli-br'], workDir);
  const brHe = (await call(`/projects/${proj.json.id}/export/he?flat=true&branch=cli-br`, { jwt })).json;
  const mainHe = (await call(`/projects/${proj.json.id}/export/he?flat=true`, { jwt })).json;
  check('cli bundle push --branch lands on the branch, main untouched', pushZipBr.status === 0 && brHe['app.title'] === 'כותרת פו' && mainHe['app.title'] === 'ראשי', JSON.stringify({ br: brHe['app.title'], main: mainHe['app.title'] }));

  // Dry-run through the CLI: previews counts, writes nothing, bundle rejected.
  writeFileSync(join(workDir, 'dr.json'), JSON.stringify({ 'app.title': 'טיוטה', 'app.new': 'חדש' }));
  const preDr = (await call(`/projects/${proj.json.id}/export/he?flat=true`, { jwt })).json;
  const pushDr = cli(['push', 'dr.json', '--locale', 'he', '--dry-run'], workDir);
  const postDr = (await call(`/projects/${proj.json.id}/export/he?flat=true`, { jwt })).json;
  check('cli push --dry-run previews counts and writes nothing', pushDr.status === 0 && pushDr.out.includes('dry run') && pushDr.out.includes('1 key(s) created') && pushDr.out.includes('snapshot') && JSON.stringify(preDr) === JSON.stringify(postDr) && postDr['app.new'] === undefined, pushDr.out.trim().slice(0, 200));
  const pushDrZip = cli(['push', 'bundle.zip', '--dry-run'], workDir);
  check('cli push --dry-run on a bundle zip is rejected before upload', pushDrZip.status === 1 && pushDrZip.out.includes('no preview mode'), pushDrZip.out.trim().slice(0, 160));

  // Import-run audit through the CLI: earlier pushes left runs behind.
  const imp = cli(['imports'], workDir);
  const runLines = imp.out.split('\n').filter((l) => l.includes(' upserted, '));
  check('cli imports lists the runs made by earlier pushes', imp.status === 0 && runLines.length >= 3 && imp.out.includes('COMPLETED') && imp.out.includes('he'), `${runLines.length} runs`);
  const imp1 = cli(['imports', '--limit', '1'], workDir);
  const runLines1 = imp1.out.split('\n').filter((l) => l.includes(' upserted, '));
  check('cli imports --limit caps the list', imp1.status === 0 && runLines1.length === 1 && imp1.out.includes('1 of'), `${runLines1.length} shown`);

  // Terminal safety: server-supplied names with control characters are escaped.
  await call(`/projects/${proj.json.id}/import/he`, { jwt, method: 'POST', body: { entries: { 'evil\nkey': 'x', 'esc\u001b[2Jclear': 'y' } } });
  const keysHostile = cli(['keys'], workDir);
  check('cli keys escapes control characters in server-supplied names', keysHostile.status === 0 && keysHostile.out.includes('\\x0a') && keysHostile.out.includes('\\x1b') && !keysHostile.out.includes('\u001b'), keysHostile.out.trim().slice(0, 160));

  // Null actorId (actor row gone via SetNull) renders as unknown actor.
  const latestRun = await prisma.importRun.findFirst({ where: { projectId: proj.json.id }, orderBy: { createdAt: 'desc' } });
  await prisma.importRun.update({ where: { id: latestRun.id }, data: { actorId: null } });
  const impNull = cli(['imports', '--limit', '50'], workDir);
  const nullLine = impNull.out.split('\n').find((l) => l.includes(latestRun.id)) ?? '';
  check('cli imports renders a null actor as unknown actor', impNull.status === 0 && nullLine.includes('unknown actor') && !impNull.out.includes('api token'), nullLine.trim().slice(0, 160));

  const impBr = cli(['imports', '--branch', 'cli-br'], workDir);
  check('cli imports rejects --branch with guidance', impBr.status === 1 && impBr.out.includes('not branch-scoped'), impBr.out.trim().slice(0, 120));

  // read-only enforcement through the CLI
  const roTok = await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'cli-ro', scopes: ['read'] } });
  writeFileSync(join(workDir, 'open-locale.json'), JSON.stringify({ url: `http://127.0.0.1:${API_PORT}`, token: roTok.json.token, project: proj.json.id }));
  const roPush = cli(['push', 'he.json', '--locale', 'he'], workDir);
  check('cli push with read-only token fails with 403 message', roPush.status === 1 && roPush.out.includes('403'), roPush.out.trim());
  const badTok = cli(['keys'], mkdtempSync(join(tmpdir(), 'ol-cli-nocfg-')));
  check('cli without config fails with guidance', badTok.status === 1 && badTok.out.includes('OPENLOCALE_TOKEN'));
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  if (prisma) await prisma.$disconnect().catch(() => {});
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(workDir, { recursive: true, force: true });
}
console.log(failures ? `cli: ${failures} FAILURES` : 'cli pass complete');
process.exit(failures ? 1 : 0);
