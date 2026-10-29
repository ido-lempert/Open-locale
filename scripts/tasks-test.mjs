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

  // assignee=me includes tasks assigned to my groups
  await call(`/projects/${proj.id}/groups/${gr.id}/members/${b.user.id}`, { token: at, method: 'PUT' });
  const t3 = (await call(base, { token: at, method: 'POST', body: { title: 'Group task for reviewers', assigneeGroupId: gr.id } })).json;
  const t4 = (await call(base, { token: at, method: 'POST', body: { title: 'Alice solo task', assigneeId: a.user.id } })).json;
  const t5 = (await call(base, { token: at, method: 'POST', body: { title: 'Unassigned task' } })).json;

  const bobMine = (await call(`${base}?assignee=me`, { token: bt })).json;
  check('mine includes group-assigned tasks', bobMine.some((t) => t.id === t3.id), JSON.stringify(bobMine.map((t) => t.title)));
  check('mine excludes others\' tasks and unassigned', !bobMine.some((t) => t.id === t4.id) && !bobMine.some((t) => t.id === t5.id));

  const aliceMine = (await call(`${base}?assignee=me`, { token: at })).json;
  check('owner mine shows direct assignment only', aliceMine.some((t) => t.id === t4.id) && !aliceMine.some((t) => t.id === t3.id) && !aliceMine.some((t) => t.id === t5.id));

  const bobMineOpen = (await call(`${base}?assignee=me&status=OPEN`, { token: bt })).json;
  check('mine composes with status filter', bobMineOpen.some((t) => t.id === t3.id));

  // Live membership changes take effect on the next query, same token.
  await call(`/projects/${proj.id}/groups/${gr.id}/members/${b.user.id}`, { token: at, method: 'DELETE' });
  const bobAfterLeave = (await call(`${base}?assignee=me`, { token: bt })).json;
  check('leaving the group removes the task from mine immediately', !bobAfterLeave.some((t) => t.id === t3.id), JSON.stringify(bobAfterLeave.map((t) => t.title)));
  await call(`/projects/${proj.id}/groups/${gr.id}/members/${b.user.id}`, { token: at, method: 'PUT' });
  const bobAfterRejoin = (await call(`${base}?assignee=me`, { token: bt })).json;
  check('rejoining the group restores the task to mine immediately', bobAfterRejoin.some((t) => t.id === t3.id));

  for (const id of [t3.id, t4.id, t5.id]) await call(`${base}/${id}`, { token: at, method: 'DELETE' });

  // Task chaining
  const chainA = (await call(base, { token: at, method: 'POST', body: { title: 'Source copy review' } })).json;
  const chainB = (await call(base, { token: at, method: 'POST', body: { title: 'Translate reviewed keys', dependsOnId: chainA.id } })).json;
  check('chained task created with predecessor', chainB.dependsOn?.id === chainA.id && chainB.dependsOn?.status === 'OPEN', JSON.stringify(chainB.dependsOn));

  const startBlocked = await call(`${base}/${chainB.id}`, { token: at, method: 'PATCH', body: { status: 'IN_PROGRESS' } });
  check('starting a blocked chain task rejected (400)', startBlocked.status === 400, `got ${startBlocked.status}`);

  await call(`${base}/${chainA.id}`, { token: at, method: 'PATCH', body: { status: 'DONE' } });
  const startOk = await call(`${base}/${chainB.id}`, { token: at, method: 'PATCH', body: { status: 'IN_PROGRESS' } });
  check('starting works once predecessor is done', startOk.status === 200, `got ${startOk.status}`);

  const cycle = await call(`${base}/${chainA.id}`, { token: at, method: 'PATCH', body: { dependsOnId: chainB.id } });
  const selfDep = await call(`${base}/${chainA.id}`, { token: at, method: 'PATCH', body: { dependsOnId: chainA.id } });
  check('cycle and self-dependency rejected (400)', cycle.status === 400 && selfDep.status === 400, `${cycle.status}/${selfDep.status}`);

  const foreignDep = await call(base, { token: at, method: 'POST', body: { title: 'x', dependsOnId: '00000000-0000-4000-8000-000000000000' } });
  check('dependency outside project rejected (400)', foreignDep.status === 400, `got ${foreignDep.status}`);

  const chainC = (await call(base, { token: at, method: 'POST', body: { title: 'Proofread translations', dependsOnId: chainB.id } })).json;
  // Exercise dependency updates both ways so the audit trail has update events.
  await call(`${base}/${chainC.id}`, { token: at, method: 'PATCH', body: { dependsOnId: chainA.id } });
  await call(`${base}/${chainC.id}`, { token: at, method: 'PATCH', body: { dependsOnId: chainB.id } });

  // Enforcement at every entry path
  const smuggle = (await call(base, { token: at, method: 'POST', body: { title: 'Status smuggle', status: 'IN_PROGRESS', dependsOnId: chainB.id } })).json;
  check('create cannot smuggle a status (stays OPEN)', smuggle.status === 'OPEN', smuggle.status);

  const chainD = (await call(base, { token: at, method: 'POST', body: { title: 'Jump straight to done', dependsOnId: chainB.id } })).json;
  const jumpDone = await call(`${base}/${chainD.id}`, { token: at, method: 'PATCH', body: { status: 'DONE' } });
  const jumpStart = await call(`${base}/${chainD.id}`, { token: at, method: 'PATCH', body: { status: 'IN_PROGRESS' } });
  check('OPEN->DONE bypass rejected while predecessor unfinished (400)', jumpDone.status === 400 && jumpStart.status === 400, `${jumpDone.status}/${jumpStart.status}`);

  const chainE = (await call(base, { token: at, method: 'POST', body: { title: 'Unrelated open task' } })).json;
  const attachBad = await call(`${base}/${chainB.id}`, { token: at, method: 'PATCH', body: { dependsOnId: chainE.id } });
  check('attaching an unfinished predecessor to a running task rejected (400)', attachBad.status === 400, `got ${attachBad.status}`);
  const attachOk = await call(`${base}/${chainB.id}`, { token: at, method: 'PATCH', body: { dependsOnId: chainA.id } });
  check('attaching a done predecessor to a running task allowed', attachOk.status === 200, `got ${attachOk.status}`);

  await call(`${base}/${chainB.id}`, { token: at, method: 'DELETE' });
  const chainCAfter = (await call(base, { token: at })).json.find((t) => t.id === chainC.id);
  check('deleting predecessor clears the link', chainCAfter && chainCAfter.dependsOn === null, JSON.stringify(chainCAfter?.dependsOn));

  const depUpd = (await call(`/projects/${proj.id}/activity?action=task.updated`, { token: at })).json.items
    .find((e) => e.detail?.changes?.dependsOn);
  check('audit records dependency changes by title', depUpd?.detail?.changes?.dependsOn?.to === 'Translate reviewed keys', JSON.stringify(depUpd?.detail?.changes));

  // Concurrent opposing dependency writes must not both succeed (cycle).
  const p1 = (await call(base, { token: at, method: 'POST', body: { title: 'Race one' } })).json;
  const p2 = (await call(base, { token: at, method: 'POST', body: { title: 'Race two' } })).json;
  const raceAttempts = await Promise.all([
    call(`${base}/${p1.id}`, { token: at, method: 'PATCH', body: { dependsOnId: p2.id } }),
    call(`${base}/${p2.id}`, { token: at, method: 'PATCH', body: { dependsOnId: p1.id } }),
  ]);
  const raceWins = raceAttempts.filter((r) => r.status === 200).length;
  check('simultaneous cycle creation: exactly one write wins', raceWins === 1 && raceAttempts.some((r) => r.status === 400), raceAttempts.map((r) => r.status).join('/'));
  const finalTasks = (await call(base, { token: at })).json;
  const depOf = Object.fromEntries(finalTasks.map((t) => [t.id, t.dependsOn?.id ?? null]));
  let acyclic = true;
  for (const start of [p1.id, p2.id]) {
    const seen = new Set(); let c = start;
    while (c) { if (seen.has(c)) { acyclic = false; break; } seen.add(c); c = depOf[c]; }
  }
  check('graph is acyclic after the race', acyclic);
  for (const id of [p1.id, p2.id]) await call(`${base}/${id}`, { token: at, method: 'DELETE' });

  for (const id of [chainA.id, chainC.id, chainD.id, chainE.id, smuggle.id]) await call(`${base}/${id}`, { token: at, method: 'DELETE' });

  // Task key locks
  const k1 = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'cart.checkout' } })).json;
  const lockTask = (await call(base, { token: at, method: 'POST', body: { title: 'Lock cart keys', lockKeys: true, keyIds: [k1.id], assigneeId: a.user.id } })).json;
  check('task created with key lock', lockTask.lockKeys === true && lockTask.keys?.[0]?.key?.name === 'cart.checkout', JSON.stringify(lockTask.keys));

  const bobUpsert = await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: bt, method: 'PUT', body: { locale: 'he', value: 'bob value' } });
  check('non-assignee member edit of a locked key rejected (403)', bobUpsert.status === 403 && String(bobUpsert.json?.message ?? '').includes('Lock cart keys'), `${bobUpsert.status} ${JSON.stringify(bobUpsert.json?.message)}`);

  const aliceUpsert = await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: at, method: 'PUT', body: { locale: 'he', value: 'alice value' } });
  check('direct assignee can edit a locked key', aliceUpsert.status === 200 || aliceUpsert.status === 201, `got ${aliceUpsert.status}`);

  const bobStatus = await call(`/projects/${proj.id}/keys/${k1.id}/translations/he/status`, { token: bt, method: 'PATCH', body: { status: 'REVIEWED' } });
  check('non-assignee status change on a locked key rejected (403)', bobStatus.status === 403, `got ${bobStatus.status}`);

  const bobBulk = await call(`/projects/${proj.id}/review/bulk-status`, { token: bt, method: 'POST', body: { locale: 'he', status: 'REVIEWED' } });
  check('bulk status on a locked key rejected (403)', bobBulk.status === 403, `got ${bobBulk.status}`);
  // Rollback proof: the row must still sit at UNVERIFIED, so a dry-run
  // preview for the same move still matches it (0 would mean it committed).
  const probe = (await call(`/projects/${proj.id}/review/bulk-status`, { token: at, method: 'POST', body: { locale: 'he', status: 'REVIEWED', keyIds: [k1.id], dryRun: true } })).json;
  check('bulk rejection rolled back (key untouched)', probe.matched === 1, `matched ${probe.matched}`);

  // Group-member path: assign the lock task to the reviewers group (Bob is in it).
  await call(`${base}/${lockTask.id}`, { token: at, method: 'PATCH', body: { assigneeGroupId: gr.id } });
  const bobGroupEdit = await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: bt, method: 'PUT', body: { locale: 'he', value: 'bob via group' } });
  check('assignee group member can edit a locked key', bobGroupEdit.status === 200, `got ${bobGroupEdit.status}`);

  await call(`/projects/${proj.id}/groups/${gr.id}/members/${b.user.id}`, { token: at, method: 'DELETE' });
  const bobOutEdit = await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: bt, method: 'PUT', body: { locale: 'he', value: 'bob out of group' } });
  check('leaving the group revokes lock access immediately (403)', bobOutEdit.status === 403, `got ${bobOutEdit.status}`);

  // Admin override: Alice is OWNER and no longer the assignee.
  const aliceOverride = await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: at, method: 'PUT', body: { locale: 'he', value: 'alice override' } });
  check('team owner can edit a locked key (override)', aliceOverride.status === 200, `got ${aliceOverride.status}`);
  await call(`/projects/${proj.id}/groups/${gr.id}/members/${b.user.id}`, { token: at, method: 'PUT' });
  // Back to a direct Alice assignment so Bob is a plain member again.
  await call(`${base}/${lockTask.id}`, { token: at, method: 'PATCH', body: { assigneeId: a.user.id } });

  // Replacement semantics + audit
  await call(`${base}/${lockTask.id}`, { token: at, method: 'PATCH', body: { keyIds: [] } });
  const bobUnlocked = await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: bt, method: 'PUT', body: { locale: 'he', value: 'bob unlocked' } });
  check('emptying the locked key set unlocks edits', bobUnlocked.status === 200, `got ${bobUnlocked.status}`);
  const relockPatch = await call(`${base}/${lockTask.id}`, { token: at, method: 'PATCH', body: { keyIds: [k1.id] } });
  check('relock patch accepted', relockPatch.status === 200, `got ${relockPatch.status} ${JSON.stringify(relockPatch.json).slice(0, 200)}`);
  const bobRelocked = await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: bt, method: 'PUT', body: { locale: 'he', value: 'bob relocked' } });
  check('re-adding the key re-locks edits (403)', bobRelocked.status === 403, `got ${bobRelocked.status}`);
  const lockAudit = (await call(`/projects/${proj.id}/activity?action=task.updated`, { token: at })).json.items
    .find((e) => e.detail?.changes?.lockedKeys);
  check('audit records locked key set changes', !!lockAudit, 'no lockedKeys change event');

  // DONE unlocks; reopening re-locks.
  await call(`${base}/${lockTask.id}`, { token: at, method: 'PATCH', body: { status: 'DONE' } });
  const bobAfterDone = await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: bt, method: 'PUT', body: { locale: 'he', value: 'bob after done' } });
  check('DONE task releases the lock', bobAfterDone.status === 200, `got ${bobAfterDone.status}`);
  await call(`${base}/${lockTask.id}`, { token: at, method: 'PATCH', body: { status: 'OPEN' } });
  const bobAfterReopen = await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: bt, method: 'PUT', body: { locale: 'he', value: 'bob after reopen' } });
  check('reopening the task re-applies the lock (403)', bobAfterReopen.status === 403, `got ${bobAfterReopen.status}`);

  // Cross-project key reference rejected.
  const proj2 = (await call('/projects', { token: at, method: 'POST', body: { name: 'TK2', slug: 'tk2', locales: ['en'] } })).json;
  const k2 = (await call(`/projects/${proj2.id}/keys`, { token: at, method: 'POST', body: { name: 'other.key' } })).json;
  const foreignKey = await call(base, { token: at, method: 'POST', body: { title: 'x', keyIds: [k2.id] } });
  check('locking a key from another project rejected (400)', foreignKey.status === 400, `got ${foreignKey.status}`);

  await call(`${base}/${lockTask.id}`, { token: at, method: 'DELETE' });
  const bobAfterDelete = await call(`/projects/${proj.id}/keys/${k1.id}/translations`, { token: bt, method: 'PUT', body: { locale: 'he', value: 'bob after delete' } });
  check('deleting the task releases the lock', bobAfterDelete.status === 200, `got ${bobAfterDelete.status}`);

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
