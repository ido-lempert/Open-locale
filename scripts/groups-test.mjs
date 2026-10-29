// User groups: real PostgreSQL + real HTTP API.
// Groups are named grant templates inside a team: members inherit the
// group's role and locale restriction as part of their effective grant
// (union with direct membership - strongest role wins; empty locale list
// from any grant means unrestricted). Team membership stays the outer
// boundary; group membership presupposes it. Management needs a role
// strictly above the group's role, so power cannot escalate sideways.
// Run: node scripts/groups-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55473, API_PORT = 3039;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
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

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-grp-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_grp');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_grp`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'grp-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  api.stderr.on('data', (d) => process.stderr.write(d));
  if (!up) throw new Error('API did not start');

  const signup = async (name) =>
    (await call('/auth/signup', { method: 'POST', body: { email: `${name}${Date.now()}@t.dev`, password: 'pass1234', displayName: name } })).json;
  const owner = await signup('gowner');
  const admin = await signup('gadmin');
  const memberA = await signup('gmema');
  const memberB = await signup('gmemb');
  const outsider = await signup('gouts');
  const O = owner.accessToken, A = () => admin.accessToken;
  const pid = (await call('/projects', { jwt: O, method: 'POST', body: { name: 'Grp', slug: `grp-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he', 'ar'] } })).json.id;
  await call(`/projects/${pid}/members`, { jwt: O, method: 'POST', body: { email: admin.user.email, role: 'ADMIN' } });
  await call(`/projects/${pid}/members`, { jwt: O, method: 'POST', body: { email: memberA.user.email, allowedLocales: ['ar'] } });
  await call(`/projects/${pid}/members`, { jwt: O, method: 'POST', body: { email: memberB.user.email, allowedLocales: ['he'] } });

  const k = (await call(`/projects/${pid}/keys`, { jwt: O, method: 'POST', body: { name: 'grp.key' } })).json;
  const write = (jwt, locale) => call(`/projects/${pid}/keys/${k.id}/translations`, { jwt, method: 'PUT', body: { locale, value: 'x' } });

  // Listing and management authorization.
  const outsiderList = await call(`/projects/${pid}/groups`, { jwt: outsider.accessToken });
  check('outsider cannot list groups (404, no leak)', outsiderList.status === 404, String(outsiderList.status));
  const emptyList = await call(`/projects/${pid}/groups`, { jwt: memberA.accessToken });
  check('any member can list groups (starts empty)', emptyList.status === 200 && emptyList.json.length === 0, JSON.stringify(emptyList.json));
  const memberCreate = await call(`/projects/${pid}/groups`, { jwt: memberA.accessToken, method: 'POST', body: { name: 'nope', role: 'MEMBER' } });
  check('member cannot create a group', memberCreate.status === 403, String(memberCreate.status));

  // Creation rank rules.
  const adminCreatesAdmin = await call(`/projects/${pid}/groups`, { jwt: A(), method: 'POST', body: { name: 'bosses', role: 'ADMIN' } });
  check('admin cannot create an ADMIN group (no sideways power)', adminCreatesAdmin.status === 403, String(adminCreatesAdmin.status));
  const ownerCreatesOwner = await call(`/projects/${pid}/groups`, { jwt: O, method: 'POST', body: { name: 'owners', role: 'OWNER' } });
  check('OWNER-role group rejected 400', ownerCreatesOwner.status === 400, String(ownerCreatesOwner.status));
  const group = (await call(`/projects/${pid}/groups`, { jwt: A(), method: 'POST', body: { name: 'translators', role: 'MEMBER', allowedLocales: ['he'] } })).json;
  check('admin creates a MEMBER group with locale restriction', !!group.id && group.role === 'MEMBER' && group.allowedLocales[0] === 'he', JSON.stringify(group));
  const dupName = await call(`/projects/${pid}/groups`, { jwt: O, method: 'POST', body: { name: 'translators', role: 'MEMBER' } });
  check('duplicate group name rejected 409', dupName.status === 409, String(dupName.status));

  // Membership presupposes team membership.
  const addOutsider = await call(`/projects/${pid}/groups/${group.id}/members/${outsider.user.id}`, { jwt: O, method: 'PUT' });
  check('adding a non-team user to a group rejected', addOutsider.status === 400, String(addOutsider.status));
  const addA = await call(`/projects/${pid}/groups/${group.id}/members/${memberA.user.id}`, { jwt: O, method: 'PUT' });
  check('owner adds a team member to the group', addA.status === 201 || addA.status === 200, String(addA.status));
  const addDup = await call(`/projects/${pid}/groups/${group.id}/members/${memberA.user.id}`, { jwt: O, method: 'PUT' });
  check('duplicate group membership rejected 409', addDup.status === 409, String(addDup.status));
  const listed = await call(`/projects/${pid}/groups`, { jwt: O });
  check('group list shows the member', listed.json.find((g) => g.id === group.id).members.some((m) => m.user.id === memberA.user.id));

  // Union semantics: direct ['ar'] + group ['he'] = ar + he, en still denied.
  check('group grant adds locale he to direct ar', (await write(memberA.accessToken, 'he')).status === 200);
  check('direct grant still allows ar', (await write(memberA.accessToken, 'ar')).status === 200);
  const enDenied = await write(memberA.accessToken, 'en');
  check('union does not widen to unlisted locale en', enDenied.status === 403, String(enDenied.status));

  // Group role bump takes effect live; demotion takes effect immediately too.
  const addLocale = (jwt) => call(`/projects/${pid}/locales`, { jwt, method: 'POST', body: { code: 'fr' } });
  const preAdmin = await addLocale(memberA.accessToken);
  check('MEMBER-level group grants no admin power', preAdmin.status === 403, String(preAdmin.status));
  await call(`/projects/${pid}/groups/${group.id}`, { jwt: O, method: 'PATCH', body: { role: 'ADMIN' } });
  const nowAdmin = await addLocale(memberA.accessToken);
  check('group promoted to ADMIN grants admin power live', nowAdmin.status === 201 || nowAdmin.status === 200, String(nowAdmin.status));
  await call(`/projects/${pid}/groups/${group.id}`, { jwt: O, method: 'PATCH', body: { role: 'MEMBER' } });
  const lostAdmin = await call(`/projects/${pid}/locales`, { jwt: memberA.accessToken, method: 'POST', body: { code: 'de' } });
  check('demotion back to MEMBER removes admin power immediately', lostAdmin.status === 403, String(lostAdmin.status));

  // Management rank rules: an admin cannot manage a group at ADMIN level.
  await call(`/projects/${pid}/groups/${group.id}`, { jwt: O, method: 'PATCH', body: { role: 'ADMIN' } });
  const adminEditsAdmin = await call(`/projects/${pid}/groups/${group.id}`, { jwt: A(), method: 'PATCH', body: { role: 'MEMBER' } });
  check('admin cannot demote an ADMIN group', adminEditsAdmin.status === 403, String(adminEditsAdmin.status));
  const adminDeletesAdmin = await call(`/projects/${pid}/groups/${group.id}`, { jwt: A(), method: 'DELETE' });
  check('admin cannot delete an ADMIN group', adminDeletesAdmin.status === 403, String(adminDeletesAdmin.status));
  await call(`/projects/${pid}/groups/${group.id}`, { jwt: O, method: 'PATCH', body: { role: 'MEMBER' } });
  const adminEditsMember = await call(`/projects/${pid}/groups/${group.id}`, { jwt: A(), method: 'PATCH', body: { name: 'translators-2' } });
  check('admin can manage a MEMBER group', adminEditsMember.status === 200 && adminEditsMember.json.name === 'translators-2', String(adminEditsMember.status));

  // Removal from the group revokes the group grant only; direct grants stay.
  await call(`/projects/${pid}/groups/${group.id}/members/${memberA.user.id}`, { jwt: O, method: 'DELETE' });
  const heAfterRemove = await write(memberA.accessToken, 'he');
  check('group removal revokes the group locale immediately', heAfterRemove.status === 403, String(heAfterRemove.status));
  check('direct locale ar survives group removal', (await write(memberA.accessToken, 'ar')).status === 200);

  // Team membership is the outer boundary: removing the direct membership
  // cuts all access even with a group row still in place.
  await call(`/projects/${pid}/groups/${group.id}/members/${memberB.user.id}`, { jwt: O, method: 'PUT' });
  await call(`/projects/${pid}/members/${memberB.user.id}`, { jwt: O, method: 'DELETE' });
  const bWrite = await write(memberB.accessToken, 'he');
  check('removed team member keeps no access via group row (404)', bWrite.status === 404, String(bWrite.status));
  const bList = await call(`/projects/${pid}/groups`, { jwt: memberB.accessToken });
  check('removed team member cannot even list groups', bList.status === 404, String(bList.status));

  // Protected group cannot be entered sideways: an admin cannot enroll
  // anyone (self or other) into an ADMIN group, and the failed demote above
  // means the group really still is ADMIN when they try.
  await call(`/projects/${pid}/groups/${group.id}`, { jwt: O, method: 'PATCH', body: { role: 'ADMIN' } });
  const enrollSelf = await call(`/projects/${pid}/groups/${group.id}/members/${admin.user.id}`, { jwt: A(), method: 'PUT' });
  check('admin cannot enroll self into an ADMIN group', enrollSelf.status === 403, String(enrollSelf.status));
  const enrollOther = await call(`/projects/${pid}/groups/${group.id}/members/${memberA.user.id}`, { jwt: A(), method: 'PUT' });
  check('admin cannot enroll another user into an ADMIN group', enrollOther.status === 403, String(enrollOther.status));
  const stillAdmin = await call(`/projects/${pid}/groups`, { jwt: O });
  check('protected group role unchanged after failed mutations', stillAdmin.json.find((g) => g.id === group.id).role === 'ADMIN');

  // Cross-team isolation: a group id from another team is 404 on this
  // project, and a user who belongs only to another team cannot enroll.
  const owner2 = await signup('gowner2');
  const pid2 = (await call('/projects', { jwt: owner2.accessToken, method: 'POST', body: { name: 'Other', slug: `other-${Date.now()}`, baseLocale: 'en', locales: ['en'] } })).json.id;
  await call(`/projects/${pid2}/members`, { jwt: owner2.accessToken, method: 'POST', body: { email: outsider.user.email } });
  const group2 = (await call(`/projects/${pid2}/groups`, { jwt: owner2.accessToken, method: 'POST', body: { name: 'elsewhere', role: 'MEMBER' } })).json;
  const xGid = await call(`/projects/${pid}/groups/${group2.id}`, { jwt: O, method: 'PATCH', body: { name: 'x' } });
  check('cross-team group id is 404 on this project', xGid.status === 404, String(xGid.status));
  const xGidDel = await call(`/projects/${pid}/groups/${group2.id}`, { jwt: O, method: 'DELETE' });
  check('cross-team group id delete is 404', xGidDel.status === 404, String(xGidDel.status));
  const xUid = await call(`/projects/${pid}/groups/${group.id}/members/${outsider.user.id}`, { jwt: O, method: 'PUT' });
  check('user of another team cannot enroll here (400)', xUid.status === 400, String(xUid.status));

  // API tokens: management obeys token scope AND the owner's effective role.
  const roToken = (await call('/auth/tokens', { jwt: O, method: 'POST', body: { name: 'grp-ro', scopes: ['read'] } })).json;
  const roList = await fetch(`${API}/projects/${pid}/groups`, { headers: { 'X-Api-Key': roToken.token } });
  check('read-only token can list groups', roList.status === 200, String(roList.status));
  const roCreate = await fetch(`${API}/projects/${pid}/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': roToken.token }, body: JSON.stringify({ name: 'tk', role: 'MEMBER' }) });
  check('read-only token cannot create a group', roCreate.status === 403, String(roCreate.status));
  const memberToken = (await call('/auth/tokens', { jwt: memberA.accessToken, method: 'POST', body: { name: 'grp-mem', scopes: ['read', 'write'] } })).json;
  const memCreate = await fetch(`${API}/projects/${pid}/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': memberToken.token }, body: JSON.stringify({ name: 'tk2', role: 'MEMBER' }) });
  check('write token of a MEMBER cannot create a group', memCreate.status === 403, String(memCreate.status));

  // Audit trail: grant changes are recorded in the activity log.
  const act = async (action) => ((await call(`/projects/${pid}/activity?action=${action}&limit=100`, { jwt: O })).json).items;
  const updMember = await call(`/projects/${pid}/members/${memberA.user.id}`, { jwt: O, method: 'PATCH', body: { allowedLocales: ['ar', 'he'] } });
  check('member locale update succeeds (setup for audit check)', updMember.status === 200, String(updMember.status));
  const memberAdded = await act('member.added');
  check('audit: member.added recorded with grant detail', memberAdded.some((e) => e.detail?.email === memberA.user.email && e.detail?.role === 'MEMBER' && JSON.stringify(e.detail?.allowedLocales) === '["ar"]'));
  const memberUpdated = await act('member.updated');
  check('audit: member.updated recorded with from/to', memberUpdated.some((e) => e.detail?.email === memberA.user.email && JSON.stringify(e.detail?.from?.allowedLocales) === '["ar"]' && JSON.stringify(e.detail?.to?.allowedLocales) === '["ar","he"]'));
  const memberRemoved = await act('member.removed');
  check('audit: member.removed recorded with prior role', memberRemoved.some((e) => e.detail?.email === memberB.user.email && e.detail?.role === 'MEMBER'));
  const groupCreated = await act('group.created');
  check('audit: group.created recorded with grant', groupCreated.some((e) => e.detail?.name === 'translators' && e.detail?.role === 'MEMBER' && JSON.stringify(e.detail?.allowedLocales) === '["he"]'), JSON.stringify(groupCreated[0]?.detail));
  const groupUpdated = await act('group.updated');
  check('audit: group.updated recorded with role from/to', groupUpdated.some((e) => e.detail?.from?.role === 'MEMBER' && e.detail?.to?.role === 'ADMIN'));
  const gmAdded = await act('group.member.added');
  check('audit: group.member.added recorded with group + member', gmAdded.some((e) => e.detail?.group === 'translators' && e.detail?.member === memberA.user.email));
  const gmRemoved = await act('group.member.removed');
  check('audit: group.member.removed recorded', gmRemoved.some((e) => e.detail?.member === memberA.user.email));
  const auditActor = groupCreated[0]?.actor?.email ?? groupCreated[0]?.actorId;
  check('audit: events carry the acting user', !!auditActor);

  const del = await call(`/projects/${pid}/groups/${group.id}`, { jwt: O, method: 'DELETE' });
  check('owner deletes the group', del.status === 200, String(del.status));
  const groupDeleted = await act('group.deleted');
  check('audit: group.deleted recorded with final state', groupDeleted.some((e) => e.detail?.name === 'translators-2' && e.detail?.role === 'ADMIN'));
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  if (api) api.kill();
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures) { console.log(`${failures} FAIL`); process.exit(1); }
console.log('groups: all checks passed');
process.exitCode = 0;
