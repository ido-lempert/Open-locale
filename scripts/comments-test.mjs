// Comments: real PostgreSQL + real HTTP API. Run: node scripts/comments-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55437, API_PORT = 3004;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { token, apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-cm-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_cm');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_cm`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'cm-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@cm.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@cm.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'CM', slug: 'cm', locales: ['en', 'he'] } })).json;
  const key = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'cta.save' } })).json;
  const base = `/projects/${proj.id}/keys/${key.id}/comments`;

  const c1 = (await call(base, { token: at, method: 'POST', body: { body: 'CTA wording needs legal review' } })).json;
  check('global comment created with author', c1.localeCode === null && c1.author?.displayName === 'Alice A');
  const c2 = (await call(base, { token: at, method: 'POST', body: { body: 'Hebrew version too long?', locale: 'he' } })).json;
  check('locale-scoped comment created', c2.localeCode === 'he');

  const all = (await call(base, { token: at })).json;
  check('unfiltered list returns both', all.length === 2);
  const heOnly = (await call(`${base}?locale=he`, { token: at })).json;
  check('locale filter includes locale + global comments', heOnly.length === 2 && heOnly.every((c) => c.localeCode === 'he' || c.localeCode === null));
  const enOnly = (await call(`${base}?locale=en`, { token: at })).json;
  check('en filter excludes he-only comment', enOnly.length === 1 && enOnly[0].localeCode === null);

  const badLocale = await call(base, { token: at, method: 'POST', body: { body: 'x', locale: 'fr' } });
  check('comment on unknown locale rejected (404)', badLocale.status === 404, `got ${badLocale.status}`);
  const tooLong = await call(base, { token: at, method: 'POST', body: { body: 'x'.repeat(2001) } });
  check('body over 2000 chars rejected (400)', tooLong.status === 400, `got ${tooLong.status}`);

  // Same-team member can read and comment; cannot delete another's comment
  // B is in a different team; test cross-team denial first
  const bRead = await call(base, { token: bt });
  check('cross-team comment read denied (404)', bRead.status === 404, `got ${bRead.status}`);
  const bDel = await call(`${base}/${c1.id}`, { token: bt, method: 'DELETE' });
  check('cross-team comment delete denied (404)', bDel.status === 404, `got ${bDel.status}`);

  // Test fixture: add B to A's team directly (invitations UI not shipped yet)
  const full = (await call(`/projects/${proj.id}`, { token: at })).json;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.teamMember.create({ data: { teamId: full.teamId, userId: b.user.id, role: 'MEMBER' } });
  await prisma.$disconnect();
  const bReadSame = await call(base, { token: bt });
  check('same-team member reads comments', bReadSame.status === 200 && bReadSame.json.length === 2, `got ${bReadSame.status}`);
  const bComment = await call(base, { token: bt, method: 'POST', body: { body: 'Bob weighs in', locale: 'en' } });
  check('same-team member comments', bComment.status === 201 && bComment.json.author?.displayName === 'Bob B', `got ${bComment.status}`);
  const bDelA = await call(`${base}/${c2.id}`, { token: bt, method: 'DELETE' });
  check('same-team delete of another author denied (403)', bDelA.status === 403, `got ${bDelA.status}`);
  const afterB = (await call(base, { token: at })).json;
  check('comment unchanged after denied delete', afterB.length === 3 && afterB.some((c) => c.id === c2.id));
  const bDelOwn = await call(`${base}/${bComment.json.id}`, { token: bt, method: 'DELETE' });
  check('same-team author deletes own comment', bDelOwn.status === 200, `got ${bDelOwn.status}`);

  // Read-only API token: reads pass, mutations denied
  const roToken = (await call('/auth/tokens', { token: at, method: 'POST', body: { name: 'ro', scopes: ['read'] } })).json;
  const roRead = await call(base, { apiKey: roToken.token });
  check('read-only token reads comments (200)', roRead.status === 200, `got ${roRead.status}`);
  const roWrite = await call(base, { apiKey: roToken.token, method: 'POST', body: { body: 'should fail' } });
  check('read-only token comment mutation denied (403)', roWrite.status === 403, `got ${roWrite.status}`);

  // A deletes own comment
  const del = await call(`${base}/${c1.id}`, { token: at, method: 'DELETE' });
  check('author deletes own comment', del.status === 200);
  const after = (await call(base, { token: at })).json;
  check('deleted comment gone', after.length === 1);

  // Threading: one-level replies on the remaining comment c2
  const reply = await call(base, { token: bt, method: 'POST', body: { body: 'Agreed, will shorten', parentId: c2.id } });
  check('reply created with parentId', reply.status === 201 && reply.json.parentId === c2.id, `got ${reply.status}`);
  const nested = await call(base, { token: at, method: 'POST', body: { body: 'nested', parentId: reply.json.id } });
  check('reply-to-reply rejected (400)', nested.status === 400, `got ${nested.status}`);
  const deadParent = await call(base, { token: at, method: 'POST', body: { body: 'orphan', parentId: c1.id } });
  check('reply to deleted parent rejected (404)', deadParent.status === 404, `got ${deadParent.status}`);
  const nonUuid = await call(base, { token: at, method: 'POST', body: { body: 'x', parentId: 'not-a-uuid' } });
  check('malformed parentId rejected (400)', nonUuid.status === 400, `got ${nonUuid.status}`);
  const key2 = (await call(`/projects/${proj.id}/keys`, { token: at, method: 'POST', body: { name: 'cta.cancel' } })).json;
  const otherKeyComment = (await call(`/projects/${proj.id}/keys/${key2.id}/comments`, { token: at, method: 'POST', body: { body: 'other key comment' } })).json;
  const crossKey = await call(base, { token: at, method: 'POST', body: { body: 'cross', parentId: otherKeyComment.id } });
  check('reply to comment on another key rejected (404)', crossKey.status === 404, `got ${crossKey.status}`);

  // Mentions: @email of a project member resolves; anything else stays text
  const cUser = (await call('/auth/signup', { method: 'POST', body: { email: 'c@cm.io', password: 'password-c', displayName: 'Cara C' } })).json;
  check('non-member fixture user exists', !!cUser.user?.id);
  const withMention = await call(base, { token: at, method: 'POST', body: { body: 'cc @b@cm.io please review' } });
  check('mention of member resolved', withMention.status === 201 && withMention.json.mentions?.length === 1 && withMention.json.mentions[0].user.email === 'b@cm.io', `got ${withMention.status}`);
  const caseMention = await call(base, { token: at, method: 'POST', body: { body: 'CC @B@CM.IO upper' } });
  check('mention match is case-insensitive', caseMention.status === 201 && caseMention.json.mentions?.length === 1, `got ${caseMention.status}`);
  const notMember = await call(base, { token: at, method: 'POST', body: { body: 'cc @c@cm.io not on team' } });
  check('existing user but non-member stays plain text', notMember.status === 201 && notMember.json.mentions?.length === 0, `got ${notMember.status}`);
  const unknownTok = await call(base, { token: at, method: 'POST', body: { body: 'hello @world test' } });
  check('unknown @token stays plain text', unknownTok.status === 201 && unknownTok.json.mentions?.length === 0, `got ${unknownTok.status}`);
  const dup = await call(base, { token: at, method: 'POST', body: { body: '@b@cm.io and again @b@cm.io' } });
  check('duplicate mention stored once', dup.status === 201 && dup.json.mentions?.length === 1, `got ${dup.status}`);
  const listed = (await call(base, { token: at })).json;
  check('list returns mentions and parentId', listed.every((cm) => Array.isArray(cm.mentions)) && listed.some((cm) => cm.parentId === c2.id));

  const acts = (await call(`/projects/${proj.id}/activity?action=comment.added`, { token: at })).json;
  const mentAct = acts.items?.find((e) => e.detail?.mentions?.includes('b@cm.io'));
  check('mention recorded in activity detail', !!mentAct);

  // Deleting a parent cascades its replies
  const delParent = await call(`${base}/${c2.id}`, { token: at, method: 'DELETE' });
  check('parent with replies deleted', delParent.status === 200, `got ${delParent.status}`);
  const afterCascade = (await call(base, { token: at })).json;
  check('replies cascade with parent', !afterCascade.some((cm) => cm.id === reply.json.id) && !afterCascade.some((cm) => cm.parentId === c2.id));
} catch (err) {
  // embedded-postgres can reject with `undefined` when the postmaster dies at
  // startup; through an async finally that exception exits 0 SILENTLY. Catch
  // and exit deterministically instead.
  console.error('SUITE INCOMPLETE:', err);
  process.exit(1);
} finally {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('All comments checks passed');
process.exitCode = 0;
