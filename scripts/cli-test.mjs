// CLI end-to-end: real PostgreSQL + real built API + the real CLI as a child process.
// Run: node scripts/cli-test.mjs   (requires dist/apps/api built)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55451, API_PORT = 3018;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
const CLI = join(root, 'apps', 'cli', 'src', 'main.mjs');
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const cli = (args, cwd) => {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { status: 0, out };
  } catch (e) {
    return { status: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
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

  // read-only enforcement through the CLI
  const roTok = await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'cli-ro', scopes: ['read'] } });
  writeFileSync(join(workDir, 'open-locale.json'), JSON.stringify({ url: `http://127.0.0.1:${API_PORT}`, token: roTok.json.token, project: proj.json.id }));
  const roPush = cli(['push', 'he.json', '--locale', 'he'], workDir);
  check('cli push with read-only token fails with 403 message', roPush.status === 1 && roPush.out.includes('403'), roPush.out.trim());
  const badTok = cli(['keys'], mkdtempSync(join(tmpdir(), 'ol-cli-nocfg-')));
  check('cli without config fails with guidance', badTok.status === 1 && badTok.out.includes('OPENLOCALE_TOKEN'));
} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(workDir, { recursive: true, force: true });
}
console.log(failures ? `cli: ${failures} FAILURES` : 'cli pass complete');
process.exit(failures ? 1 : 0);
