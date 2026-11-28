// SDK: real PostgreSQL + real HTTP API, exercising libs/sdk end to end.
// Run: node scripts/sdk-test.mjs   (requires: nx build api)
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { createClient, OpenLocaleError } from '../libs/sdk/src/index.mjs';

const PG_PORT = Number(process.env.SDK_TEST_PG_PORT ?? 55471), API_PORT = 3021;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = new URL('..', import.meta.url).pathname;
let pass = 0, fail = 0, completed = false;
// Startup/cleanup awaits may end without reaching the final exit. Fail closed.
process.exitCode = 1;
process.on('exit', () => { if (!completed || fail) process.exitCode = 1; });
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${detail}`); }
};
const call = async (path, { method = 'GET', body, token } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-sdk-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_sdk');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_sdk`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'sdk-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@sdk.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const proj = (await call('/projects', { token: a.accessToken, method: 'POST', body: { name: 'SDK Shop', slug: 'sdk-shop', locales: ['en', 'he'] } })).json;
  const tok = (await call('/auth/tokens', { token: a.accessToken, method: 'POST', body: { name: 'sdk', scopes: ['read', 'write'] } })).json;

  const ol = createClient({ url: `http://127.0.0.1:${API_PORT}`, token: tok.token });

  check('client requires url and token', (() => { try { createClient({ url: '', token: 'x' }); return false; } catch (e) { return e instanceof OpenLocaleError; } })()
    && (() => { try { createClient({ url: 'http://x', token: '' }); return false; } catch (e) { return e instanceof OpenLocaleError; } })());

  const projects = await ol.projects.list();
  check('projects.list returns the project', projects.some((p) => p.slug === 'sdk-shop'), JSON.stringify(projects).slice(0, 120));

  const validProject = await ol.projects.get(proj.id);
  check('projects.get valid UUID unchanged', validProject.id === proj.id);
  for (const id of ['not-a-uuid', 'project/with?punctuation#', '2147483648']) {
    const error = await ol.projects.get(id).catch(e => e);
    check('projects.get malformed UUID returns400 ' + id,
      error instanceof OpenLocaleError && error.status === 400 && error.path === `/projects/${encodeURIComponent(id)}`,
      error instanceof Error ? `${error.name}:${error.status}` : 'unexpected response');
  }
  const missingProject = await ol.projects.get('00000000-0000-4000-8000-000000000000').catch(e => e);
  check('projects.get valid absent UUID retains404', missingProject instanceof OpenLocaleError && missingProject.status === 404);
  const unauthenticatedMalformed = await fetch(`${API}/projects/not-a-uuid`);
  check('projects.get malformed UUID still requires authentication', unauthenticatedMalformed.status === 401);

  for (const [label, run, method] of [
    ['list', id => ol.keys.list(id), 'GET'],
    ['create', id => ol.keys.create(id, 'invalid-project-probe'), 'POST'],
  ]) {
    for (const id of ['not-a-uuid', 'project/with?punctuation#', '2147483648']) {
      const error = await run(id).catch(e => e);
      check(`keys.${label} malformed project returns400 ${id}`, error instanceof OpenLocaleError && error.status === 400,
        error instanceof Error ? `${error.name}:${error.status}` : 'unexpected response');
    }
    const absent = await run('00000000-0000-4000-8000-000000000000').catch(e => e);
    check(`keys.${label} absent valid project retains404`, absent instanceof OpenLocaleError && absent.status === 404);
    const denied = await fetch(`${API}/projects/not-a-uuid/keys`, { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify({ name: 'probe' }) } : {}) });
    check(`keys.${label} malformed project still requires authentication`, denied.status === 401);
  }

  const key = await ol.keys.create(proj.id, 'sdk.greeting', { description: 'from the sdk' });
  check('keys.create lands', key.name === 'sdk.greeting' && !!key.id, JSON.stringify(key).slice(0, 120));
  const keys = await ol.keys.list(proj.id, { search: 'greeting' });
  check('keys.list with search finds it', keys.length === 1 && keys[0].name === 'sdk.greeting', JSON.stringify(keys).slice(0, 120));

  await ol.translations.put(proj.id, key.id, 'en', 'Hello from the SDK');
  await ol.translations.put(proj.id, key.id, 'he', 'שלום מה-SDK');
  const en = await ol.translations.get(proj.id, 'en');
  check('translations.get returns the flat map', en['sdk.greeting'] === 'Hello from the SDK', JSON.stringify(en).slice(0, 120));

  for (const [label, projectId, keyId] of [
    ['project plain', 'not-a-uuid', key.id], ['project punctuation', 'project/with?punctuation#', key.id],
    ['key plain', proj.id, 'not-a-uuid'], ['key punctuation', proj.id, 'key/with?punctuation#'],
  ]) {
    const error = await ol.translations.put(projectId, keyId, 'en', 'must-not-save').catch(e => e);
    check(`translation PUT malformed ${label} returns400`, error instanceof OpenLocaleError && error.status === 400,
      error instanceof Error ? `${error.name}:${error.status}` : 'unexpected response');
  }
  for (const [label, projectId, keyId] of [
    ['project', '00000000-0000-4000-8000-000000000000', key.id],
    ['key', proj.id, '00000000-0000-4000-8000-000000000000'],
  ]) {
    const error = await ol.translations.put(projectId, keyId, 'en', 'must-not-save').catch(e => e);
    check(`translation PUT absent valid ${label} retains404`, error instanceof OpenLocaleError && error.status === 404);
  }
  const deniedPut = await fetch(`${API}/projects/not-a-uuid/keys/not-a-uuid/translations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: 'en', value: 'must-not-save' }) });
  check('translation PUT malformed still requires authentication', deniedPut.status === 401);
  check('translation PUT invalid identifiers preserve saved translation', (await ol.translations.get(proj.id, 'en'))['sdk.greeting'] === 'Hello from the SDK');

  for (const [label, run, suffix, method] of [
    ['JSON export', id => ol.translations.get(id, 'en'), '/export/en?flat=true', 'GET'],
    ['JSON import', id => ol.io.importEntries(id, 'en', { 'sdk.greeting': 'must-not-save' }), '/import/en', 'POST'],
    ['JSON import preview', id => ol.io.importEntries(id, 'en', { 'sdk.greeting': 'must-not-save' }, { dryRun: true }), '/import/en?dryRun=true', 'POST'],
  ]) {
    for (const id of ['not-a-uuid', 'project/with?punctuation#']) {
      const error = await run(id).catch(e => e);
      check(`${label} malformed project returns400 ${id}`, error instanceof OpenLocaleError && error.status === 400,
        error instanceof Error ? `${error.name}:${error.status}` : 'unexpected response');
    }
    const absent = await run('00000000-0000-4000-8000-000000000000').catch(e => e);
    check(`${label} absent valid project retains404`, absent instanceof OpenLocaleError && absent.status === 404);
    const denied = await fetch(`${API}/projects/not-a-uuid${suffix}`, { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify({ entries: { probe: 'value' } }) } : {}) });
    check(`${label} malformed project still requires authentication`, denied.status === 401);
  }
  check('invalid JSON import projects preserve saved translation', (await ol.translations.get(proj.id, 'en'))['sdk.greeting'] === 'Hello from the SDK');

  for (const format of ['csv', 'android', 'stringsdict', 'ios', 'po', 'pot', 'xliff', 'resx', 'properties', 'arb', 'yaml']) {
    for (const id of ['not-a-uuid', 'project/with?punctuation#']) {
      const error = await ol.io.exportText(id, 'en', format).catch(e => e);
      check(`${format} export malformed project returns400 ${id}`, error instanceof OpenLocaleError && error.status === 400,
        error instanceof Error ? `${error.name}:${error.status}` : 'unexpected response');
    }
    const absent = await ol.io.exportText('00000000-0000-4000-8000-000000000000', 'en', format).catch(e => e);
    check(`${format} export absent valid project retains404`, absent instanceof OpenLocaleError && absent.status === 404);
    const denied = await fetch(`${API}/projects/not-a-uuid/export/en/${format}`);
    check(`${format} export malformed project still requires authentication`, denied.status === 401);
  }

  for (const [label, method, tail, body] of [
    ['history', 'GET', 'history', undefined],
    ['status', 'PATCH', 'status', { status: 'UNVERIFIED' }],
  ]) {
    for (const [field, projectId, keyId] of [
      ['project plain', 'not-a-uuid', key.id], ['project punctuation', 'project/with?punctuation#', key.id],
      ['key plain', proj.id, 'not-a-uuid'], ['key punctuation', proj.id, 'key/with?punctuation#'],
    ]) {
      const error = await ol.request(`/projects/${encodeURIComponent(projectId)}/keys/${encodeURIComponent(keyId)}/translations/en/${tail}`, { method, body }).catch(e => e);
      check(`translation ${label} malformed ${field} returns400`, error instanceof OpenLocaleError && error.status === 400,
        error instanceof Error ? `${error.name}:${error.status}` : 'unexpected response');
    }
    for (const [field, projectId, keyId] of [['project', '00000000-0000-4000-8000-000000000000', key.id], ['key', proj.id, '00000000-0000-4000-8000-000000000000']]) {
      const error = await ol.request(`/projects/${projectId}/keys/${keyId}/translations/en/${tail}`, { method, body }).catch(e => e);
      check(`translation ${label} absent valid ${field} retains404`, error instanceof OpenLocaleError && error.status === 404);
    }
    const denied = await fetch(`${API}/projects/not-a-uuid/keys/not-a-uuid/translations/en/${tail}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    check(`translation ${label} malformed still requires authentication`, denied.status === 401);
  }

  for (const suffix of ['/export-bundle/json', '/tm/en/tmx', '/tm/suggest?locale=en&source=Hello', '/imports']) {
    for (const id of ['not-a-uuid', 'project/with?punctuation#']) {
      const error = await ol.request(`/projects/${encodeURIComponent(id)}${suffix}`).catch(e => e);
      check(`translation read ${suffix} malformed project400 ${id}`, error instanceof OpenLocaleError && error.status === 400,
        error instanceof Error ? `${error.name}:${error.status}` : 'unexpected response');
    }
    const absent = await ol.request(`/projects/00000000-0000-4000-8000-000000000000${suffix}`).catch(e => e);
    check(`translation read ${suffix} absent valid project404`, absent instanceof OpenLocaleError && absent.status === 404);
    const denied = await fetch(`${API}/projects/not-a-uuid${suffix}`);
    check(`translation read ${suffix} malformed auth401`, denied.status === 401);
  }

  const zipFixture = new Uint8Array(await (await ol.request(`/projects/${proj.id}/export-bundle/json`, { raw: true })).arrayBuffer());
  for (const [label, suffix, payload, contentType] of [
    ['bulk status', '/review/bulk-status', JSON.stringify({ locale: 'en', status: 'UNVERIFIED' }), 'application/json'],
    ['ZIP import', '/import-bundle/json', zipFixture, 'application/zip'],
  ]) {
    const send = (id, authenticated = true) => fetch(`${API}/projects/${encodeURIComponent(id)}${suffix}`, { method: 'POST', headers: { 'Content-Type': contentType, ...(authenticated ? { 'X-Api-Key': tok.token } : {}) }, body: payload });
    for (const id of ['not-a-uuid', 'project/with?punctuation#']) {
      const res = await send(id);
      check(`${label} malformed project400 ${id}`, res.status === 400, String(res.status));
    }
    const absent = await send('00000000-0000-4000-8000-000000000000');
    check(`${label} absent valid project404`, absent.status === 404, String(absent.status));
    const denied = await send('not-a-uuid', false);
    check(`${label} malformed auth401`, denied.status === 401);
  }
  check('invalid bulk and ZIP project IDs preserve saved translation', (await ol.translations.get(proj.id, 'en'))['sdk.greeting'] === 'Hello from the SDK');

  for (const [label, method, tail, body] of [
    ['update', 'PATCH', '', { description: 'must-not-save' }],
    ['tags', 'PATCH', '/tags', { tags: ['must-not-save'] }],
    ['delete', 'DELETE', '', undefined],
  ]) {
    for (const [field, projectId, keyId] of [
      ['project plain', 'not-a-uuid', key.id], ['project punctuation', 'project/with?punctuation#', key.id],
      ['key plain', proj.id, 'not-a-uuid'], ['key punctuation', proj.id, 'key/with?punctuation#'],
    ]) {
      const error = await ol.request(`/projects/${encodeURIComponent(projectId)}/keys/${encodeURIComponent(keyId)}${tail}`, { method, body }).catch(e => e);
      check(`key ${label} malformed ${field}400`, error instanceof OpenLocaleError && error.status === 400,
        error instanceof Error ? `${error.name}:${error.status}` : 'unexpected response');
    }
    for (const [field, projectId, keyId] of [['project', '00000000-0000-4000-8000-000000000000', key.id], ['key', proj.id, '00000000-0000-4000-8000-000000000000']]) {
      const error = await ol.request(`/projects/${projectId}/keys/${keyId}${tail}`, { method, body }).catch(e => e);
      check(`key ${label} absent valid ${field}404`, error instanceof OpenLocaleError && error.status === 404);
    }
    const denied = await fetch(`${API}/projects/not-a-uuid/keys/not-a-uuid${tail}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    check(`key ${label} malformed auth401`, denied.status === 401);
  }
  const preservedKey = (await ol.keys.list(proj.id)).find(row => row.id === key.id);
  check('invalid key writes preserve original key', preservedKey?.description === 'from the sdk' && !preservedKey.tags.includes('must-not-save'));

  const commentPath = `/projects/${proj.id}/keys/${key.id}/comments`;
  const commentProbe = await ol.request(commentPath, { method: 'POST', body: { body: 'preserve-comment' } });
  for (const [label, method, body] of [['list', 'GET', undefined], ['add', 'POST', { body: 'must-not-add' }], ['delete', 'DELETE', undefined]]) {
    const suffix = method === 'DELETE' ? `/${commentProbe.id}` : '';
    for (const [field, projectId, keyId] of [['project', 'not-a-uuid', key.id], ['key', proj.id, 'key/with?punctuation#']]) {
      const error = await ol.request(`/projects/${encodeURIComponent(projectId)}/keys/${encodeURIComponent(keyId)}/comments${suffix}`, { method, body }).catch(e => e);
      check(`comment ${label} malformed ${field}400`, error instanceof OpenLocaleError && error.status === 400, `${error.status}`);
    }
    for (const [field, projectId, keyId] of [['project', '00000000-0000-4000-8000-000000000000', key.id], ['key', proj.id, '00000000-0000-4000-8000-000000000000']]) {
      const error = await ol.request(`/projects/${projectId}/keys/${keyId}/comments${suffix}`, { method, body }).catch(e => e);
      check(`comment ${label} absent valid ${field}404`, error instanceof OpenLocaleError && error.status === 404);
    }
    const denied = await fetch(`${API}/projects/not-a-uuid/keys/not-a-uuid/comments${suffix}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    check(`comment ${label} malformed auth401`, denied.status === 401);
  }
  for (const id of ['not-a-uuid', 'comment/with?punctuation#']) {
    const error = await ol.request(`${commentPath}/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(e => e);
    check('comment delete malformed commentId400 ' + id, error instanceof OpenLocaleError && error.status === 400, `${error.status}`);
  }
  const absentComment = await ol.request(`${commentPath}/00000000-0000-4000-8000-000000000000`, { method: 'DELETE' }).catch(e => e);
  check('comment delete absent valid commentId404', absentComment instanceof OpenLocaleError && absentComment.status === 404);
  const commentsAfterInvalid = await ol.request(commentPath);
  check('invalid comment writes preserve original only', commentsAfterInvalid.length === 1 && commentsAfterInvalid[0].id === commentProbe.id && commentsAfterInvalid[0].body === 'preserve-comment');

  for (const [label, method, suffix, body] of [
    ['update', 'PATCH', '', { name: 'must-not-save' }], ['delete', 'DELETE', '', undefined],
    ['locale add', 'POST', '/locales', { code: 'fr' }], ['locale remove', 'DELETE', '/locales/en', undefined],
  ]) {
    for (const id of ['not-a-uuid', 'project/with?punctuation#']) {
      const error = await ol.request(`/projects/${encodeURIComponent(id)}${suffix}`, { method, body }).catch(e => e);
      check(`project ${label} malformed ID400 ${id}`, error instanceof OpenLocaleError && error.status === 400, `${error.status}`);
    }
    const absent = await ol.request(`/projects/00000000-0000-4000-8000-000000000000${suffix}`, { method, body }).catch(e => e);
    check(`project ${label} absent valid ID404`, absent instanceof OpenLocaleError && absent.status === 404);
    const denied = await fetch(`${API}/projects/not-a-uuid${suffix}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    check(`project ${label} malformed auth401`, denied.status === 401);
  }
  const preservedProject = await ol.projects.get(proj.id);
  check('invalid project writes preserve name and locales', preservedProject.name === 'SDK Shop' && preservedProject.locales.map(row => row.code).sort().join(',') === 'en,he');

  const membersBeforeInvalid = await call(`/projects/${proj.id}/members`, { token: a.accessToken });
  for (const [label, method, memberSuffix, body] of [
    ['list', 'GET', '', undefined], ['add', 'POST', '', { email: 'a@sdk.io' }],
    ['update', 'PATCH', '/00000000-0000-4000-8000-000000000000', { role: 'MEMBER' }],
    ['remove', 'DELETE', '/00000000-0000-4000-8000-000000000000', undefined],
  ]) {
    const send = (projectId, suffix = memberSuffix, authenticated = true) => call(`/projects/${encodeURIComponent(projectId)}/members${suffix}`, { method, body, token: authenticated ? a.accessToken : undefined });
    for (const id of ['not-a-uuid', 'project/with?punctuation#']) {
      const res = await send(id);
      check(`member ${label} malformed project400 ${id}`, res.status === 400, String(res.status));
    }
    const absent = await send('00000000-0000-4000-8000-000000000000');
    check(`member ${label} absent valid project404`, absent.status === 404);
    check(`member ${label} malformed auth401`, (await send('not-a-uuid', memberSuffix, false)).status === 401);
    if (memberSuffix) {
      for (const id of ['not-a-uuid', 'user/with?punctuation#']) {
        const res = await send(proj.id, '/' + encodeURIComponent(id));
        check(`member ${label} malformed user400 ${id}`, res.status === 400, String(res.status));
      }
      check(`member ${label} absent valid user404`, (await send(proj.id)).status === 404);
    }
  }
  const membersAfterInvalid = await call(`/projects/${proj.id}/members`, { token: a.accessToken });
  check('invalid member paths preserve member roles', JSON.stringify(membersAfterInvalid.json) === JSON.stringify(membersBeforeInvalid.json));

  const groupProbe = (await call(`/projects/${proj.id}/groups`, { token: a.accessToken, method: 'POST', body: { name: 'preserve-group', role: 'MEMBER' } })).json;
  const groupsBeforeInvalid = (await call(`/projects/${proj.id}/groups`, { token: a.accessToken })).json;
  const absentUuid = '00000000-0000-4000-8000-000000000000';
  for (const [label, method, groupScoped, userScoped, body] of [
    ['list', 'GET', false, false, undefined], ['create', 'POST', false, false, { name: 'must-not-create', role: 'MEMBER' }],
    ['update', 'PATCH', true, false, { name: 'must-not-save' }], ['delete', 'DELETE', true, false, undefined],
    ['member add', 'PUT', true, true, undefined], ['member remove', 'DELETE', true, true, undefined],
  ]) {
    const send = (projectId, groupId = groupProbe.id, userId = absentUuid, authenticated = true) => call(`/projects/${encodeURIComponent(projectId)}/groups${groupScoped ? '/' + encodeURIComponent(groupId) : ''}${userScoped ? '/members/' + encodeURIComponent(userId) : ''}`, { method, body, token: authenticated ? a.accessToken : undefined });
    const parameters = ['project', ...(groupScoped ? ['group'] : []), ...(userScoped ? ['user'] : [])];
    for (const field of parameters) {
      const args = [proj.id, groupProbe.id, absentUuid];
      args[parameters.indexOf(field)] = field + '/with?punctuation#';
      const res = await send(...args);
      check(`group ${label} malformed ${field}400`, res.status === 400, String(res.status));
      args[parameters.indexOf(field)] = absentUuid;
      const missing = await send(...args);
      const expected = field === 'user' && label === 'member add' ? 400 : 404;
      check(`group ${label} absent valid ${field} retains${expected}`, missing.status === expected, String(missing.status));
    }
    check(`group ${label} malformed auth401`, (await send('not-a-uuid', groupProbe.id, absentUuid, false)).status === 401);
  }
  check('invalid group paths preserve groups and memberships', JSON.stringify((await call(`/projects/${proj.id}/groups`, { token: a.accessToken })).json) === JSON.stringify(groupsBeforeInvalid));

  const branchesBeforeInvalid = (await call(`/projects/${proj.id}/branches`, { token: a.accessToken })).json;
  for (const [label, method, branchScoped, tail, body] of [
    ['list', 'GET', false, '', undefined], ['create', 'POST', false, '', { name: 'must-not-create' }],
    ['delete', 'DELETE', true, '', undefined], ['preview', 'POST', true, '/merge/preview', { into: 'main' }],
    ['merge', 'POST', true, '/merge', { into: 'main' }],
  ]) {
    const path = (projectId, branchId) => `/projects/${encodeURIComponent(projectId)}/branches${branchScoped ? '/' + encodeURIComponent(branchId) + tail : ''}`;
    for (const field of ['project', ...(branchScoped ? ['branch'] : [])]) {
      const args = [proj.id, absentUuid]; args[field === 'project' ? 0 : 1] = 'not-a-uuid';
      const res = await call(path(...args), { token: a.accessToken, method, body });
      check(`branch ${label} malformed ${field}400`, res.status === 400, String(res.status));
      args[field === 'project' ? 0 : 1] = absentUuid;
      const missing = await call(path(...args), { token: a.accessToken, method, body });
      check(`branch ${label} absent valid ${field}404`, missing.status === 404, String(missing.status));
    }
    check(`branch ${label} malformed auth401`, (await call(path('not-a-uuid', 'not-a-uuid'), { method, body })).status === 401);
    const deniedToken = await ol.request(path('not-a-uuid', 'not-a-uuid'), { method, body }).catch(e => e);
    check(`branch ${label} malformed API token retains403`, deniedToken instanceof OpenLocaleError && deniedToken.status === 403);
  }
  check('invalid branch paths preserve branches', JSON.stringify((await call(`/projects/${proj.id}/branches`, { token: a.accessToken })).json) === JSON.stringify(branchesBeforeInvalid));

  const snapshotsBeforeInvalid = (await call(`/projects/${proj.id}/snapshots`, { token: a.accessToken })).json;
  for (const [label, method, snapshotScoped, body] of [
    ['list', 'GET', false, undefined], ['create', 'POST', false, { label: 'must-not-create' }],
    ['restore', 'POST', true, undefined],
  ]) {
    const path = (projectId, snapshotId = absentUuid) => `/projects/${encodeURIComponent(projectId)}/snapshots${snapshotScoped ? '/' + encodeURIComponent(snapshotId) + '/restore' : ''}`;
    for (const field of ['project', ...(snapshotScoped ? ['snapshot'] : [])]) {
      const args = [proj.id, absentUuid]; args[field === 'project' ? 0 : 1] = 'not-a-uuid';
      const res = await call(path(...args), { token: a.accessToken, method, body });
      check(`snapshot ${label} malformed ${field}400`, res.status === 400, String(res.status));
      args[field === 'project' ? 0 : 1] = absentUuid;
      const missing = await call(path(...args), { token: a.accessToken, method, body });
      check(`snapshot ${label} absent valid ${field}404`, missing.status === 404, String(missing.status));
    }
    check(`snapshot ${label} malformed auth401`, (await call(path('not-a-uuid', 'not-a-uuid'), { method, body })).status === 401);
  }
  check('invalid snapshot paths preserve snapshots and translation', JSON.stringify((await call(`/projects/${proj.id}/snapshots`, { token: a.accessToken })).json) === JSON.stringify(snapshotsBeforeInvalid) && (await ol.translations.get(proj.id, 'en'))['sdk.greeting'] === 'Hello from the SDK');

  const tasksBeforeInvalid = (await call(`/projects/${proj.id}/tasks`, { token: a.accessToken })).json;
  for (const [label, method, taskScoped, body] of [
    ['list', 'GET', false, undefined], ['create', 'POST', false, { title: 'must-not-create' }],
    ['update', 'PATCH', true, { title: 'must-not-save' }], ['delete', 'DELETE', true, undefined],
  ]) {
    const path = (projectId, taskId = absentUuid) => `/projects/${encodeURIComponent(projectId)}/tasks${taskScoped ? '/' + encodeURIComponent(taskId) : ''}`;
    for (const field of ['project', ...(taskScoped ? ['task'] : [])]) {
      const args = [proj.id, absentUuid]; args[field === 'project' ? 0 : 1] = 'not-a-uuid';
      const res = await call(path(...args), { token: a.accessToken, method, body });
      check(`task ${label} malformed ${field}400`, res.status === 400, String(res.status));
      args[field === 'project' ? 0 : 1] = absentUuid;
      const missing = await call(path(...args), { token: a.accessToken, method, body });
      check(`task ${label} absent valid ${field}404`, missing.status === 404, String(missing.status));
    }
    check(`task ${label} malformed auth401`, (await call(path('not-a-uuid', 'not-a-uuid'), { method, body })).status === 401);
  }
  check('invalid task paths preserve task list', JSON.stringify((await call(`/projects/${proj.id}/tasks`, { token: a.accessToken })).json) === JSON.stringify(tasksBeforeInvalid));

  const glossaryBeforeInvalid = (await call(`/projects/${proj.id}/glossary`, { token: a.accessToken })).json;
  for (const [label, method, termScoped, body] of [
    ['list', 'GET', false, undefined], ['create', 'POST', false, { term: 'must-not-create' }],
    ['update', 'PATCH', true, { notes: 'must-not-save' }], ['delete', 'DELETE', true, undefined],
  ]) {
    const path = (projectId, termId = absentUuid) => `/projects/${encodeURIComponent(projectId)}/glossary${termScoped ? '/' + encodeURIComponent(termId) : ''}`;
    for (const field of ['project', ...(termScoped ? ['term'] : [])]) {
      const args = [proj.id, absentUuid]; args[field === 'project' ? 0 : 1] = 'not-a-uuid';
      const res = await call(path(...args), { token: a.accessToken, method, body });
      check(`glossary ${label} malformed ${field}400`, res.status === 400, String(res.status));
      args[field === 'project' ? 0 : 1] = absentUuid;
      const missing = await call(path(...args), { token: a.accessToken, method, body });
      check(`glossary ${label} absent valid ${field}404`, missing.status === 404, String(missing.status));
    }
    check(`glossary ${label} malformed auth401`, (await call(path('not-a-uuid', 'not-a-uuid'), { method, body })).status === 401);
  }
  check('invalid glossary paths preserve glossary', JSON.stringify((await call(`/projects/${proj.id}/glossary`, { token: a.accessToken })).json) === JSON.stringify(glossaryBeforeInvalid));

  const imp = await ol.io.importEntries(proj.id, 'he', { 'sdk.second': 'שני' });
  check('io.importEntries imports', imp.status === 'COMPLETED' && imp.translationsUpserted === 1, JSON.stringify(imp));
  const dry = await ol.io.importEntries(proj.id, 'he', { 'sdk.third': 'שלישי' }, { dryRun: true });
  const heAfterDry = await ol.translations.get(proj.id, 'he');
  check('io.importEntries dryRun previews without writing', dry.dryRun === true && heAfterDry['sdk.third'] === undefined, JSON.stringify(dry));

  const po = await ol.io.exportText(proj.id, 'he', 'po');
  check('io.exportText returns the format body', po.includes('msgid "sdk.greeting"') && po.includes('msgstr "שלום מה-SDK"'), po.split('\n').find((l) => l.includes('sdk.greeting')) ?? '');

  for (const [label, run] of [
    ['project get', () => ol.projects.get(`${proj.id}/keys#`)],
    ['key list', () => ol.keys.list(`${proj.id}/keys#`)],
    ['key create', () => ol.keys.create(`${proj.id}/keys#`, 'sdk.unexpected-scope')],
    ['translation read project', () => ol.translations.get(`${proj.id}/export/he?flat=true#`, 'he')],
    ['translation write project', () => ol.translations.put(`${proj.id}/keys/${key.id}/translations#`, key.id, 'he', 'WRONG_SCOPE')],
    ['translation write key', () => ol.translations.put(proj.id, `${key.id}/translations#`, 'he', 'WRONG_SCOPE')],
    ['import project', () => ol.io.importEntries(`${proj.id}/import/he#`, 'he', { 'sdk.unexpected-import': 'unexpected' })],
    ['export project', () => ol.io.exportText(`${proj.id}/export/he/po#`, 'he', 'po')],
  ]) {
    const error = await Promise.resolve().then(run).then(() => null).catch(e => e);
    check(`SDK literal identifier ${label} cannot select another endpoint`, error instanceof OpenLocaleError && error.status >= 400);
  }
  const afterIdentifiers = await ol.translations.get(proj.id, 'he');
  const keysAfterIdentifiers = await ol.keys.list(proj.id);
  check('SDK rejected identifier writes leave translations and key list unchanged', afterIdentifiers['sdk.greeting'] === 'שלום מה-SDK' && afterIdentifiers['sdk.unexpected-import'] === undefined && !keysAfterIdentifiers.some(k => k.name === 'sdk.unexpected-scope'));

  let dotRequests = 0;
  const dotClient = createClient({ url: `http://127.0.0.1:${API_PORT}`, token: tok.token, fetchImpl: (u, o) => { dotRequests++; return fetch(u, o); } });
  for (const [label, run] of [
    ['project parent', () => dotClient.projects.get('..')],
    ['key project self', () => dotClient.keys.list('.')],
    ['translation locale parent', () => dotClient.translations.get(proj.id, '..')],
    ['translation key parent', () => dotClient.translations.put(proj.id, '..', 'he', 'unexpected')],
    ['OTA locale parent', () => dotClient.ota.version(proj.id, 1, '..')],
    ['export format parent', () => dotClient.io.exportText(proj.id, 'he', '..')],
  ]) {
    const before = dotRequests;
    const error = await Promise.resolve().then(run).then(() => null).catch(e => e);
    check(`SDK dot segment ${label} rejects locally before fetch`, error instanceof OpenLocaleError && error.status === 0 && dotRequests === before);
  }

  const emptyBefore = dotRequests;
  const emptyProject = await Promise.resolve().then(() => dotClient.projects.get('')).then(() => null).catch(e => e);
  check('SDK empty project rejects locally instead of reading collection', emptyProject instanceof OpenLocaleError && emptyProject.status === 0 && dotRequests === emptyBefore);

  // Branch scoping through the same client.
  await call(`/projects/${proj.id}/branches`, { token: a.accessToken, method: 'POST', body: { name: 'sdk-branch' } });
  await ol.io.importEntries(proj.id, 'he', { 'sdk.branchonly': 'ענף' }, { branch: 'sdk-branch' });
  const mainHe = await ol.translations.get(proj.id, 'he');
  const brHe = await ol.translations.get(proj.id, 'he', { branch: 'sdk-branch' });
  check('branch option scopes import and export', mainHe['sdk.branchonly'] === undefined && brHe['sdk.branchonly'] === 'ענף', '');

  const injectedLocale = 'he?branch=sdk-branch#';
  for (const [label, run] of [
    ['import write', () => ol.io.importEntries(proj.id, injectedLocale, { 'sdk.scope-probe': 'unexpected' })],
    ['export format', () => ol.io.exportText(proj.id, 'he', 'po?branch=sdk-branch#')],
  ]) {
    const error = await Promise.resolve().then(run).then(() => null).catch(e => e);
    check(`SDK literal ${label} cannot redirect branch scope`, error instanceof OpenLocaleError && [400, 404].includes(error.status));
  }
  const literalTranslation = await ol.translations.get(proj.id, injectedLocale);
  check('SDK literal translation locale does not read branch values', Object.keys(literalTranslation).length === 0);
  const literalExport = await ol.io.exportText(proj.id, injectedLocale, 'po');
  check('SDK literal export locale does not read branch values', !literalExport.includes('sdk.branchonly') && !literalExport.includes('ענף'));
  const branchAfterProbe = await ol.translations.get(proj.id, 'he', { branch: 'sdk-branch' });
  check('SDK rejected locale imports leave branch unchanged', branchAfterProbe['sdk.scope-probe'] === undefined && branchAfterProbe['sdk.branchonly'] === 'ענף');

  // OTA pulls with integrity verification: the slice-18 digest exists FOR
  // this consumer - the SDK must verify it and never hand over bad bytes.
  const firstPublication = (await call(`/projects/${proj.id}/ota/publish`, { token: a.accessToken, method: 'POST', body: {} })).json;
  const pull1 = await ol.ota.latest(proj.id, 'he');
  check('ota.latest returns the verified bundle', pull1.notModified === false && pull1.bundle.translations['sdk.greeting'] === 'שלום מה-SDK' && pull1.bundle.version === 1 && /^[0-9a-f]{64}$/.test(pull1.sha256) && !!pull1.etag, String(pull1.sha256).slice(0, 20));
  for (const [label, pull] of [
    ['latest', opts => ol.ota.latest(proj.id, 'he', opts)],
    ['version', opts => ol.ota.version(proj.id, 1, 'he', opts)],
  ]) {
    const pinned = await pull({ publicationId: firstPublication.id });
    check(`SDK ${label} matching publication pin reads exact bundle`, pinned.etag === pull1.etag && pinned.sha256 === pull1.sha256 && pinned.bundle.version === 1);
    const cached = await pull({ publicationId: firstPublication.id, etag: `"other", ${pull1.etag}` });
    check(`SDK ${label} matching publication pin supports conditional304`, cached.notModified === true && cached.etag === pull1.etag && cached.bundle === undefined);
    for (const [pinLabel, publicationId] of [['wrong', 'wrong-pin'], ['empty', '']]) {
      const error = await pull({ publicationId, etag: '*' }).then(() => null).catch(e => e);
      check(`SDK ${label} ${pinLabel} pin rejects before wildcard304`, error instanceof OpenLocaleError && error.status === 404 && error.path.includes('publicationId='));
    }
  }
  for (const [label, pull] of [
    ['latest project path', () => ol.ota.latest(`${proj.id}/ota/latest?locale=he#`, 'he')],
    ['version project path', () => ol.ota.version(`${proj.id}/ota/latest?locale=he#`, 1, 'he')],
    ['version fragment', () => ol.ota.version(proj.id, '1/he#', 'he')],
    ['version query', () => ol.ota.version(proj.id, '1/he?branch=main#', 'he')],
  ]) {
    const error = await pull().then(() => null).catch(e => e);
    check(`SDK OTA literal ${label} cannot select existing endpoint`, error instanceof OpenLocaleError && [400, 404].includes(error.status), `status ${error?.status}`);
  }
  const pull304 = await ol.ota.latest(proj.id, 'he', { etag: pull1.etag });
  check('etag revalidation yields notModified and still carries the digest', pull304.notModified === true && pull304.sha256 === pull1.sha256 && pull304.bundle === undefined);
  for (const [label, etag] of [
    ['list', `"unrelated", ${pull1.etag}`],
    ['strong equivalent', pull1.etag.replace(/^W\//, '')],
    ['wildcard', '*'],
  ]) {
    const cached = await ol.ota.latest(proj.id, 'he', { etag });
    check(`SDK304 ${label} returns selected response ETag not request expression`, cached.notModified === true && cached.etag === pull1.etag && cached.sha256 === pull1.sha256 && cached.bundle === undefined);
  }

  const noValidator = createClient({ url: `http://127.0.0.1:${API_PORT}`, token: tok.token,
    fetchImpl: async (u, o) => {
      const response = await fetch(u, o);
      if (response.status !== 304) return response;
      const headers = new Headers(response.headers); headers.delete('etag');
      return new Response(null, { status: 304, headers });
    },
  });
  const missingValidator = await noValidator.ota.latest(proj.id, 'he', { etag: '*' });
  check('SDK304 missing response ETag stays null not wildcard', missingValidator.notModified === true && missingValidator.etag === null && missingValidator.sha256 === pull1.sha256 && missingValidator.bundle === undefined);
  const tampered = createClient({ url: `http://127.0.0.1:${API_PORT}`, token: tok.token, fetchImpl: async (u, opts) => {
    const res = await fetch(u, opts);
    if (!String(u).includes('/ota/')) return res;
    const text = await res.text();
    return new Response(text.replace('שלום', 'XXXX'), { status: res.status, headers: res.headers });
  } });
  const tamperErr = await tampered.ota.latest(proj.id, 'he').then(() => null).catch((e) => e);
  check('tampered bundle bytes are rejected, never returned', tamperErr instanceof OpenLocaleError && /integrity check failed/.test(tamperErr.message), String(tamperErr));
  const stripped = createClient({ url: `http://127.0.0.1:${API_PORT}`, token: tok.token, fetchImpl: async (u, opts) => {
    const res = await fetch(u, opts);
    if (!String(u).includes('/ota/')) return res;
    const h = new Headers(res.headers); h.delete('x-openlocale-bundle-sha256');
    return new Response(await res.text(), { status: res.status, headers: h });
  } });
  const stripErr = await stripped.ota.latest(proj.id, 'he').then(() => null).catch((e) => e);
  check('missing digest header fails closed', stripErr instanceof OpenLocaleError && /missing its integrity digest/.test(stripErr.message), String(stripErr));
  await ol.translations.put(proj.id, key.id, 'he', 'שלום חדש');
  await call(`/projects/${proj.id}/ota/publish`, { token: a.accessToken, method: 'POST', body: {} });
  const pullV2 = await ol.ota.latest(proj.id, 'he');
  const pullV1 = await ol.ota.version(proj.id, 1, 'he');
  check('ota.version(1) immutable after v2, digests differ', pullV1.bundle.version === 1 && pullV1.bundle.translations['sdk.greeting'] === 'שלום מה-SDK' && pullV2.bundle.version === 2 && pullV1.sha256 !== pullV2.sha256, '');

  const staleLatest = await ol.ota.latest(proj.id, 'he', { publicationId: firstPublication.id, etag: '*' }).then(() => null).catch(e => e);
  check('SDK latest old pin rejects after newer publication', staleLatest instanceof OpenLocaleError && staleLatest.status === 404);
  const retained = await ol.ota.version(proj.id, 1, 'he', { publicationId: firstPublication.id });
  check('SDK version old pin retains exact bytes and cache identity after newer publication', retained.bundle.version === 1 && retained.bundle.translations['sdk.greeting'] === 'שלום מה-SDK' && retained.sha256 === pull1.sha256 && retained.etag === pull1.etag);
  const retained304 = await ol.ota.version(proj.id, 1, 'he', { publicationId: firstPublication.id, etag: `"other", ${pull1.etag}` });
  check('SDK retained old pin still revalidates after newer publication', retained304.notModified === true && retained304.etag === pull1.etag && retained304.sha256 === pull1.sha256 && retained304.bundle === undefined);
  let capturedUrl;
  const captured = createClient({ url: `http://127.0.0.1:${API_PORT}`, token: tok.token, fetchImpl: (url, opts) => { capturedUrl = new URL(url); return fetch(url, opts); } });
  const queryLikePin = `${firstPublication.id}&branch=sdk-branch&locale=en#fragment`;
  const encodedError = await captured.ota.latest(proj.id, 'he', { publicationId: queryLikePin, etag: '*' }).then(() => null).catch(e => e);
  check('SDK query-like pin stays one value without changing locale branch or fragment', encodedError instanceof OpenLocaleError && encodedError.status === 404 && capturedUrl.searchParams.get('publicationId') === queryLikePin && capturedUrl.searchParams.getAll('publicationId').length === 1 && capturedUrl.searchParams.get('locale') === 'he' && !capturedUrl.searchParams.has('branch') && capturedUrl.hash === '');
  const unchangedLatest = await ol.ota.latest(proj.id, 'he');
  check('SDK failed pinned reads leave latest unchanged', unchangedLatest.etag === pullV2.etag && unchangedLatest.sha256 === pullV2.sha256 && unchangedLatest.bundle.translations['sdk.greeting'] === 'שלום חדש');

  // Recreated branch can reuse version1 but must not reuse publication pin.
  const branch = (await call(`/projects/${proj.id}/branches`, { token: a.accessToken })).json.find(b => b.name === 'sdk-branch');
  const branchPublication = (await call(`/projects/${proj.id}/ota/publish`, { token: a.accessToken, method: 'POST', body: { branch: 'sdk-branch' } })).json;
  const branchPinned = await ol.ota.version(proj.id, 1, 'he', { branch: 'sdk-branch', publicationId: branchPublication.id });
  check('SDK pin combines with branch and reads isolated values', branchPinned.bundle.translations['sdk.branchonly'] === 'ענף' && branchPinned.bundle.translations['sdk.greeting'] === undefined);
  for (const [label, locale] of [['branch query', 'he?branch=sdk-branch'], ['fragment', 'he#ignored'], ['path slash', 'he/extra'], ['encoded query', 'he%3Fbranch%3Dsdk-branch']]) {
    const response = await ol.ota.version(proj.id, 1, locale).then(value => value).catch(error => error);
    check(`SDK version literal locale ${label} cannot select another scope`, response instanceof OpenLocaleError && response.status === 404);
  }

  await call(`/projects/${proj.id}/branches/${branch.id}`, { token: a.accessToken, method: 'DELETE' });
  await call(`/projects/${proj.id}/branches`, { token: a.accessToken, method: 'POST', body: { name: 'sdk-branch' } });
  await ol.io.importEntries(proj.id, 'he', { 'replacement': 'new branch' }, { branch: 'sdk-branch' });
  const replacementPublication = (await call(`/projects/${proj.id}/ota/publish`, { token: a.accessToken, method: 'POST', body: { branch: 'sdk-branch' } })).json;
  for (const [label, pull] of [
    ['latest', opts => ol.ota.latest(proj.id, 'he', opts)],
    ['version', opts => ol.ota.version(proj.id, 1, 'he', opts)],
  ]) {
    const stale = await pull({ branch: 'sdk-branch', publicationId: branchPublication.id, etag: '*' }).then(() => null).catch(e => e);
    check(`SDK ${label} old pin rejects recreated branch version1`, stale instanceof OpenLocaleError && stale.status === 404);
    const replacement = await pull({ branch: 'sdk-branch', publicationId: replacementPublication.id });
    check(`SDK ${label} replacement pin reads new branch only`, replacement.bundle.version === 1 && replacement.bundle.translations.replacement === 'new branch' && replacement.bundle.translations['sdk.branchonly'] === undefined);
  }

  // Errors carry status and path, not just a message.
  const err = await ol.projects.get('00000000-0000-0000-0000-000000000000').then(() => null).catch((e) => e);
  check('errors are OpenLocaleError with status and path', err instanceof OpenLocaleError && err.status === 404 && err.path.includes('/projects/'), String(err));

  const badAuth = createClient({ url: `http://127.0.0.1:${API_PORT}`, token: 'wrong-token' });
  const authErr = await badAuth.projects.list().then(() => null).catch((e) => e);
  check('bad token surfaces 401', authErr instanceof OpenLocaleError && authErr.status === 401, String(authErr));
  await call(`/auth/tokens/${tok.id}`, { token: a.accessToken, method: 'DELETE' });
  for (const [endpoint, pull] of [
    ['latest', opts => ol.ota.latest(proj.id, 'he', opts)],
    ['version', opts => ol.ota.version(proj.id, 1, 'he', opts)],
  ]) {
    for (const [label, etag] of [['exact', pull1.etag], ['list', `"other", ${pull1.etag}`], ['wildcard', '*']]) {
      const denied = await pull({ etag }).then(() => null).catch(e => e);
      check(`SDK revoked token ${endpoint} ${label} rejects instead of cached success`, denied instanceof OpenLocaleError && denied.status === 401 && denied.path.includes('/ota/'));
    }
  }
  completed = true;
} catch (err) {
  console.log('FAIL suite aborted', err);
  fail++;
} finally {
  try { api?.kill('SIGKILL'); } catch { }
  try { await pg.stop(); } catch { }
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(`DONE pass=${pass} fail=${fail}`);
process.exit(!completed || fail ? 1 : 0);
