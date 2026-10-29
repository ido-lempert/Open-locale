// CLI end-to-end: real PostgreSQL + real built API + the real CLI as a child process.
// Run: node scripts/cli-test.mjs   (requires dist/apps/api built)
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
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
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_cli');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_cli`;
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
  check('cli push bundle reports an unmatched entry as skipped, exit 0', pushMix.status === 0 && pushMix.out.includes('skipped fr.json') && pushMix.out.includes('en:'), pushMix.out.trim().slice(0, 200));

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
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(workDir, { recursive: true, force: true });
}
console.log(failures ? `cli: ${failures} FAILURES` : 'cli pass complete');
process.exit(failures ? 1 : 0);
