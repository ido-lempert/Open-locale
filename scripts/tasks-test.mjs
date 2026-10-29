// Tasks: real PostgreSQL + real HTTP API. Run: node scripts/tasks-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55441, API_PORT = 3008;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { token, apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tk-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_tk');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_tk`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'tk-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@tk.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@tk.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'TK', slug: 'tk', locales: ['en', 'he'] } })).json;
  const base = `/projects/${proj.id}/tasks`;

  const members = (await call(`/projects/${proj.id}/members`, { token: at })).json;
  check('members endpoint lists team with role', members.length === 1 && members[0].displayName === 'Alice A' && members[0].role === 'OWNER', JSON.stringify(members));

  const t1 = (await call(base, { token: at, method: 'POST', body: { title: 'Translate checkout to Hebrew', dueDate: '2026-11-05', description: 'All cart.* keys' } })).json;
  check('task created with defaults', t1.status === 'OPEN' && t1.creator?.displayName === 'Alice A' && t1.dueDate?.startsWith('2026-11-05'));

  const badTitle = await call(base, { token: at, method: 'POST', body: { title: '   ' } });
  const badDate = await call(base, { token: at, method: 'POST', body: { title: 'x', dueDate: 'not-a-date' } });
  const badStatus = await call(`${base}/${t1.id}`, { token: at, method: 'PATCH', body: { status: 'MAYBE' } });
  check('invalid title/date/status rejected (400)', badTitle.status === 400 && badDate.status === 400 && badStatus.status === 400,
    `${badTitle.status}/${badDate.status}/${badStatus.status}`);

  const assignOutsider = await call(`${base}/${t1.id}`, { token: at, method: 'PATCH', body: { assigneeId: b.user.id } });
  check('assignee outside team rejected (400)', assignOutsider.status === 400, `got ${assignOutsider.status}`);

  // Fixture: join B to the team
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.teamMember.create({ data: { teamId: (await prisma.project.findUnique({ where: { id: proj.id } })).teamId, userId: b.user.id, role: 'MEMBER' } });
  await prisma.$disconnect();

  const assigned = (await call(`${base}/${t1.id}`, { token: at, method: 'PATCH', body: { assigneeId: b.user.id, status: 'IN_PROGRESS' } })).json;
  check('assign teammate + start work', assigned.assignee?.displayName === 'Bob B' && assigned.status === 'IN_PROGRESS');

  const beforeNoop = (await call(`/projects/${proj.id}/activity?action=task.updated`, { token: at })).json.items.length;
  await call(`${base}/${t1.id}`, { token: at, method: 'PATCH', body: { status: 'IN_PROGRESS' } });
  const afterNoop = (await call(`/projects/${proj.id}/activity?action=task.updated`, { token: at })).json.items.length;
  check('no-op update writes no activity row', afterNoop === beforeNoop, `${beforeNoop} -> ${afterNoop}`);

  const unassigned = (await call(`${base}/${t1.id}`, { token: at, method: 'PATCH', body: { assigneeId: null } })).json;
  check('null unassigns', unassigned.assignee === null);

  const open = (await call(`${base}?status=OPEN`, { token: at })).json;
  const inprog = (await call(`${base}?status=IN_PROGRESS`, { token: at })).json;
  check('status filter splits correctly', open.length === 0 && inprog.length === 1 && inprog[0].id === t1.id);

  // Group assignment
  const gr = (await call(`/projects/${proj.id}/groups`, { token: at, method: 'POST', body: { name: 'qa-reviewers', role: 'MEMBER', allowedLocales: [] } })).json;
  const t2 = (await call(base, { token: at, method: 'POST', body: { title: 'Review glossary terms', assigneeGroupId: gr.id } })).json;
  check('task created with group assignee', t2.assigneeGroup?.name === 'qa-reviewers' && t2.assignee === null, JSON.stringify(t2.assigneeGroup));

  const both = await call(base, { token: at, method: 'POST', body: { title: 'x', assigneeId: b.user.id, assigneeGroupId: gr.id } });
  const bothUpd = await call(`${base}/${t2.id}`, { token: at, method: 'PATCH', body: { assigneeId: b.user.id, assigneeGroupId: gr.id } });
  check('member+group together rejected (400)', both.status === 400 && bothUpd.status === 400, `${both.status}/${bothUpd.status}`);

  const foreignGroup = await call(base, { token: at, method: 'POST', body: { title: 'x', assigneeGroupId: '00000000-0000-4000-8000-000000000000' } });
  check('group outside team rejected (400)', foreignGroup.status === 400, `got ${foreignGroup.status}`);

  const toMember = (await call(`${base}/${t2.id}`, { token: at, method: 'PATCH', body: { assigneeId: b.user.id } })).json;
  check('assigning a member clears the group', toMember.assignee?.id === b.user.id && toMember.assigneeGroup === null, JSON.stringify(toMember.assigneeGroup));

  const backToGroup = (await call(`${base}/${t2.id}`, { token: at, method: 'PATCH', body: { assigneeGroupId: gr.id } })).json;
  check('assigning a group clears the member', backToGroup.assigneeGroup?.id === gr.id && backToGroup.assignee === null);

  const listed = (await call(base, { token: at })).json;
  check('list includes group assignee', listed.some((t) => t.id === t2.id && t.assigneeGroup?.name === 'qa-reviewers'));

  const grpUpd = (await call(`/projects/${proj.id}/activity?action=task.updated`, { token: at })).json.items
    .find((e) => e.detail?.changes?.assigneeGroup);
  check('audit records group assignment change', grpUpd?.detail?.changes?.assigneeGroup?.from === 'qa-reviewers' || grpUpd?.detail?.changes?.assigneeGroup?.to === 'qa-reviewers', JSON.stringify(grpUpd?.detail?.changes));

  await call(`${base}/${t2.id}`, { token: at, method: 'DELETE' });

  const ro = (await call('/auth/tokens', { token: at, method: 'POST', body: { name: 'ro', scopes: ['read'] } })).json;
  const roRead = await call(base, { apiKey: ro.token });
  const roWrite = await call(base, { apiKey: ro.token, method: 'POST', body: { title: 'x' } });
  check('read-only token: list 200 / create 403', roRead.status === 200 && roWrite.status === 403, `${roRead.status}/${roWrite.status}`);

  const cross = await call(base, { token: bt === at ? '' : bt });
  const crossCreate = await call(base, { token: (await call('/auth/signup', { method: 'POST', body: { email: 'c@tk.io', password: 'password-c', displayName: 'Cat C' } })).json.accessToken, method: 'POST', body: { title: 'x' } });
  check('cross-team create denied (404)', crossCreate.status === 404, `got ${crossCreate.status}`);

  const done = (await call(`${base}/${t1.id}`, { token: bt, method: 'PATCH', body: { status: 'DONE' } })).json;
  check('assignee team member can mark done', done.status === 'DONE');

  const del = await call(`${base}/${t1.id}`, { token: at, method: 'DELETE' });
  check('delete works', del.status === 200);
  const after = (await call(base, { token: at })).json;
  check('deleted task gone', after.length === 0);

  const feed = (await call(`/projects/${proj.id}/activity`, { token: at })).json;
  const acts = feed.items.map((e) => e.action);
  check('activity has task.created/updated/deleted', acts.includes('task.created') && acts.includes('task.updated') && acts.includes('task.deleted'));
  const upd = feed.items.find((e) => e.action === 'task.updated');
  check('update event names what changed', !!upd?.detail?.changes, JSON.stringify(upd?.detail));
} finally {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('All tasks checks passed');
