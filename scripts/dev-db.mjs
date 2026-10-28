// Local dev bootstrap: starts a temporary PostgreSQL (embedded-postgres), applies
// migrations, then serves the API against it. No Docker needed. Ctrl+C stops both.
// Usage: npm run dev:api
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = Number(process.env.DEV_PG_PORT || 55432);
const API_PORT = process.env.PORT || '3000';
const root = process.cwd();
const dataDir = mkdtempSync(join(tmpdir(), 'ol-dev-pg-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });

const cleanup = async () => {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

await pg.initialise();
await pg.start();
await pg.createDatabase('openlocale_dev');
const url = `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/openlocale_dev`;
execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
  env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
console.log(`[dev-db] PostgreSQL ready at ${url} (temporary; data is deleted on exit)`);

const api = spawn(join(root, 'node_modules', '.bin', 'nx'), ['serve', 'api'], {
  cwd: root,
  env: {
    ...process.env,
    DATABASE_URL: url,
    JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret',
    PORT: API_PORT,
  },
  stdio: 'inherit',
});
api.on('exit', (code) => { console.log(`[dev-db] API exited (${code})`); cleanup(); });
