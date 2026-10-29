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

  const del = await call(`/projects/${pid}/groups/${group.id}`, { jwt: O, method: 'DELETE' });
  check('owner deletes the group', del.status === 200, String(del.status));
} finally {
  if (api) api.kill();
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures) { console.log(`${failures} FAIL`); process.exit(1); }
console.log('groups: all checks passed');
