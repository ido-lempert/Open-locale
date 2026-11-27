// OTA publications: publish gates, immutable bundles, ETag/304, branch scope,
// pruning, auth rules. Real PostgreSQL + real HTTP API.
// Run: node scripts/ota-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const PG_PORT = 55465, API_PORT = 3027;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
// Fail-closed exit: a silent exit before the success path (for example a
// startup await that never settles with an empty event loop) leaves this at 1.
process.exitCode = 1;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { jwt, token, method = 'GET', body, headers: extra } = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (token) headers['X-Api-Key'] = token;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, etag: res.headers.get('etag'), json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ota-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_ota');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_ota`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'ota-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const owner = (await call('/auth/signup', { method: 'POST', body: { email: `ota${Date.now()}@t.dev`, password: 'pass1234', displayName: 'ota' } })).json;
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `otam${Date.now()}@t.dev`, password: 'pass1234', displayName: 'otam' } })).json;
  const jwt = owner.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Ota', slug: `ota-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email } });
  const k1 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'app.title' } })).json;
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Title' } });
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'כותרת' } });

  // Pull before any publish: 404. Publish gates.
  check('latest before publish is 404', (await call(`/projects/${pid}/ota/latest?locale=en`, { jwt })).status === 404);
  check('member cannot publish (403)', (await call(`/projects/${pid}/ota/publish`, { jwt: member.accessToken, method: 'POST', body: {} })).status === 403);
  const wtok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'ci', scopes: ['read', 'write'] } })).json.token;
  check('API token cannot publish (403 session-only)', (await call(`/projects/${pid}/ota/publish`, { token: wtok, method: 'POST', body: {} })).status === 403);
  check('unauthenticated pull rejected (401)', (await fetch(`${API}/projects/${pid}/ota/latest?locale=en`)).status === 401);

  // Publish v1 for main.
  const p1 = (await call(`/projects/${pid}/ota/publish`, { jwt, method: 'POST', body: {} })).json;
  check('publish returns v1 with locales and counts', p1.version === 1 && p1.branch === 'main' && p1.locales.join(',') === 'en,he' && p1.translations === 2, JSON.stringify(p1));
  const acts = (await call(`/projects/${pid}/activity?action=ota.published`, { jwt })).json;
  check('publish recorded in activity', acts.items?.length >= 1);

  // Bound version before Prisma Int lookup. Missing signed-int32 versions
  // remain ordinary 404s, including zero and negative values.
  for (const version of ['2147483648', '-2147483649', '9007199254740993', '9999999999999999999999999999999999999999']) {
    const r = await call(`/projects/${pid}/ota/${version}/he`, { jwt });
    check(`out-of-storage-range OTA version ${version} rejects400 not storage500`, r.status === 400, `got ${r.status}`);
  }
  for (const version of ['0', '-1', '2147483647', '-2147483648']) {
    check(`in-range absent OTA version ${version} retains404`, (await call(`/projects/${pid}/ota/${version}/he`, { jwt })).status === 404);
  }

  // Pull latest + ETag/304.
  const l1 = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt });
  check('latest he bundle has branch values', l1.json.translations['app.title'] === 'כותרת' && l1.json.version === 1 && l1.json.branch === 'main');
  check('latest carries weak ETag and private cache-control', !!l1.etag);
  check('latest OTA validator has complete quoted weak ETag syntax', typeof l1.etag === 'string' && /^W\/"[^"\s]+"$/.test(l1.etag), String(l1.etag));
  const l1b = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt, headers: { 'If-None-Match': l1.etag } });
  check('If-None-Match yields 304', l1b.status === 304, `got ${l1b.status}`);
  // Real HTTP stack must support weak comparison, lists and wildcard while
  // keeping authorization and scope selection ahead of conditional handling.
  for (const [label, validator] of [
    ['strong equivalent', l1.etag.replace(/^W\//, '')],
    ['list matching last', `"unrelated", ${l1.etag}`],
    ['list matching first', `${l1.etag}, "unrelated"`],
    ['wildcard', '*'],
  ]) {
    const conditional = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt, headers: { 'If-None-Match': validator } });
    check(`conditional ${label} reuses existing representation`, conditional.status === 304 && conditional.json === null, `got ${conditional.status}`);
  }
  for (const [label, validator] of [
    ['unknown list', '"other", W/"different"'],
    ['substring only', `"prefix${l1.etag.slice(3, -1)}suffix"`],
    ['unclosed quote', l1.etag.slice(0, -1)],
    ['mixed wildcard', `*, ${l1.etag}`],
    ['trailing garbage', `${l1.etag} garbage`],
    ['quoted comma', `"unrelated,${l1.etag.slice(3, -1)}"`],
  ]) {
    check(`conditional ${label} cannot false304`, (await call(`/projects/${pid}/ota/latest?locale=he`, { jwt, headers: { 'If-None-Match': validator } })).status === 200);
  }
  const cache200 = await fetch(`${API}/projects/${pid}/ota/latest?locale=he`, { headers: { Authorization: `Bearer ${jwt}` } });
  const cache304 = await fetch(`${API}/projects/${pid}/ota/latest?locale=he`, { headers: { Authorization: `Bearer ${jwt}`, 'If-None-Match': l1.etag } });
  check('200 and304 retain private revalidation policy', cache200.status === 200 && cache304.status === 304 && [cache200, cache304].every(r => r.headers.get('cache-control') === 'private, no-cache'));
  check('304 preserves complete current validator', cache304.headers.get('etag') === l1.etag);
  check('wildcard does not bypass unauthenticated access', (await fetch(`${API}/projects/${pid}/ota/latest?locale=he`, { headers: { 'If-None-Match': '*' } })).status === 401);
  check('wildcard does not hide missing locale', (await call(`/projects/${pid}/ota/latest?locale=fr`, { jwt, headers: { 'If-None-Match': '*' } })).status === 404);


  for (const [label, path] of [
    ['latest branch', 'latest?locale=he&branch=main&branch=main'],
    ['version branch', '1/he?branch=main&branch=main'],
    ['latest locale', 'latest?locale=he&locale=he'],
    ['latest publication pin', `latest?locale=he&publicationId=${p1.id}&publicationId=${p1.id}`],
    ['version publication pin', `1/he?publicationId=${p1.id}&publicationId=${p1.id}`],
  ]) {
    const response = await call(`/projects/${pid}/ota/${path}`, { jwt, headers: { 'If-None-Match': l1.etag } });
    check(`duplicate scalar OTA ${label} cannot select bundle or false304`, response.status === 404, `got ${response.status}`);
  }

  // Read-scope API token can pull (SDK path) but a token of another project cannot.
  const rtok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'sdk', scopes: ['read'] } })).json.token;
  const lt = await call(`/projects/${pid}/ota/latest?locale=en`, { token: rtok });
  check('read token pulls bundle', lt.status === 200 && lt.json.translations['app.title'] === 'Title');
  const other = (await call('/auth/signup', { method: 'POST', body: { email: `otao${Date.now()}@t.dev`, password: 'pass1234', displayName: 'out' } })).json;
  check('non-member cannot pull (404/403)', [403, 404].includes((await call(`/projects/${pid}/ota/latest?locale=en`, { jwt: other.accessToken })).status));

  // Publish v2 after a change; v1 stays immutable.
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'כותרת חדשה' } });
  const p2 = (await call(`/projects/${pid}/ota/publish`, { jwt, method: 'POST', body: {} })).json;
  check('second publish increments to v2', p2.version === 2);
  const v1 = await call(`/projects/${pid}/ota/1/he`, { jwt });
  check('v1 bundle immutable after v2', v1.json.translations['app.title'] === 'כותרת' && v1.json.version === 1);
  const l2 = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt });
  check('latest is v2 with new value', l2.json.version === 2 && l2.json.translations['app.title'] === 'כותרת חדשה');
  check('old ETag no longer matches after v2', (await call(`/projects/${pid}/ota/latest?locale=he`, { jwt, headers: { 'If-None-Match': l1.etag } })).status === 200);
  check('unknown version 404', (await call(`/projects/${pid}/ota/99/he`, { jwt })).status === 404);
  check('unknown locale 404', (await call(`/projects/${pid}/ota/latest?locale=fr`, { jwt })).status === 404);

  // --- Bundle integrity digest (slice 18): full sha256 over the exact served bytes ---
  const rawV2 = await fetch(`${API}/projects/${pid}/ota/latest?locale=he`, { headers: { Authorization: `Bearer ${jwt}` } });
  const rawV2Text = await rawV2.text();
  const digestV2 = rawV2.headers.get('x-openlocale-bundle-sha256');
  check('integrity header present, full 256-bit hex', !!digestV2 && /^[0-9a-f]{64}$/.test(digestV2), String(digestV2));
  check('digest matches the exact served bytes', digestV2 === createHash('sha256').update(rawV2Text).digest('hex'), 'recomputed over response body');
  const rawV2c = await fetch(`${API}/projects/${pid}/ota/latest?locale=he`, { headers: { Authorization: `Bearer ${jwt}`, 'If-None-Match': l2.etag } });
  check('304 still carries the integrity digest', rawV2c.status === 304 && rawV2c.headers.get('x-openlocale-bundle-sha256') === digestV2, `got ${rawV2c.status}`);
  const rawV1 = await fetch(`${API}/projects/${pid}/ota/1/he`, { headers: { Authorization: `Bearer ${jwt}` } });
  const digestV1 = rawV1.headers.get('x-openlocale-bundle-sha256');
  check('v1 digest stable and differs from v2', !!digestV1 && digestV1 !== digestV2 && digestV1 === createHash('sha256').update(await rawV1.text()).digest('hex'), `${digestV1} vs ${digestV2}`);

  // Branch scope: feat bundle is separate and does not leak main values.
  await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat' } });
  const kf = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'app.title', branch: 'feat' } })).json;
  await call(`/projects/${pid}/keys/${kf.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'ברנץ' } });
  check('branch latest before its own publish is 404', (await call(`/projects/${pid}/ota/latest?locale=he&branch=feat`, { jwt })).status === 404);
  const pf = (await call(`/projects/${pid}/ota/publish`, { jwt, method: 'POST', body: { branch: 'feat' } })).json;
  check('branch publish starts at v1 for that branch', pf.version === 1 && pf.branch === 'feat', JSON.stringify(pf));
  const lf = await call(`/projects/${pid}/ota/latest?locale=he&branch=feat`, { jwt });
  check('feat bundle has feat values only', lf.json.translations['app.title'] === 'ברנץ' && lf.json.branch === 'feat');
  const lm = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt });
  check('main bundle unaffected by feat publish', lm.json.version === 2 && lm.json.translations['app.title'] === 'כותרת חדשה');

  // List metadata.
  const list = (await call(`/projects/${pid}/ota`, { jwt })).json;
  check('list shows main v1+v2 and feat v1 with counts', list.length === 3 && list.every((x) => x.translations >= 1 && x.locales.length >= 1), JSON.stringify(list.map((x) => `${x.branch}@${x.version}`)));

  const pinnedPath=`/projects/${pid}/ota/1/he?branch=feat&publicationId=${pf.id}`;
  const pinned=await call(pinnedPath,{jwt});check('publication pin reads exact existing scoped bundle',pinned.status===200&&pinned.json.translations['app.title']==='ברנץ');
  check('matching pin preserves conditional304',(await call(pinnedPath,{jwt,headers:{'If-None-Match':pinned.etag}})).status===304);
  for(const identity of [p1.id,'invalid','',`${pf.id}x`])check(`mismatched publication pin rejects before304 (${identity===p1.id?'other branch':identity||'empty'})`,(await call(`/projects/${pid}/ota/1/he?branch=feat&publicationId=${identity}`,{jwt,headers:{'If-None-Match':pinned.etag}})).status===404);
  const ephemeral=(await call(`/projects/${pid}/branches`,{jwt,method:'POST',body:{name:'pin-race'}})).json;
  await call(`/projects/${pid}/import/he?branch=pin-race`,{jwt,method:'POST',body:{entries:{identity:'Original'}}});const original=(await call(`/projects/${pid}/ota/publish`,{jwt,method:'POST',body:{branch:'pin-race'}})).json;
  await call(`/projects/${pid}/branches/${ephemeral.id}`,{jwt,method:'DELETE'});await call(`/projects/${pid}/branches`,{jwt,method:'POST',body:{name:'pin-race'}});await call(`/projects/${pid}/import/he?branch=pin-race`,{jwt,method:'POST',body:{entries:{identity:'Replacement'}}});const replacement=(await call(`/projects/${pid}/ota/publish`,{jwt,method:'POST',body:{branch:'pin-race'}})).json;
  check('recreated branch reusesv1 but different publication identity',original.version===1&&replacement.version===1&&original.id!==replacement.id);
  check('old pin404 cannot select recreated branchv1',(await call(`/projects/${pid}/ota/1/he?branch=pin-race&publicationId=${original.id}`,{jwt})).status===404);
  const newPinned=await call(`/projects/${pid}/ota/1/he?branch=pin-race&publicationId=${replacement.id}`,{jwt});check('replacement pin reads new retained bytes',newPinned.status===200&&newPinned.json.translations.identity==='Replacement');
  check('legacy unpinned version read remains replacement-compatible',(await call(`/projects/${pid}/ota/1/he?branch=pin-race`,{jwt})).json.translations.identity==='Replacement');

  // Validator uniqueness: same version+locale on another project or branch
  // must produce a different ETag (no false 304 across projects/branches).
  const pid3 = (await call('/projects', { jwt, method: 'POST', body: { name: 'Ota3', slug: `ota3-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  const k3 = (await call(`/projects/${pid3}/keys`, { jwt, method: 'POST', body: { name: 'app.title' } })).json;
  await call(`/projects/${pid3}/keys/${k3.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'כותרת חדשה' } });
  await call(`/projects/${pid3}/ota/publish`, { jwt, method: 'POST', body: {} });
  const p3l = await call(`/projects/${pid3}/ota/latest?locale=he`, { jwt });
  check('same v1/he on another project has a different ETag', p3l.etag !== lf.etag, `${p3l.etag} vs ${lf.etag}`);
  const mainV1 = await call(`/projects/${pid}/ota/1/he`, { jwt });
  check('same v1/he across branches has a different ETag', mainV1.etag !== lf.etag, `${mainV1.etag} vs ${lf.etag}`);
  // Content hash: an identical payload republished under a new version still
  // differs by version, and identical content across projects differs by id.
  check('cross-project conditional request cannot 304', (await call(`/projects/${pid3}/ota/latest?locale=he`, { jwt, headers: { 'If-None-Match': lf.etag } })).status === 200);

  // Authorization precedes 304: after membership removal or token revocation,
  // a request with a previously valid If-None-Match must NOT get 304.
  const memberTok = member.accessToken;
  const memberFirst = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt: memberTok });
  check('member can pull before removal', memberFirst.status === 200);
  const memberId = (await call(`/projects/${pid}/members`, { jwt })).json.find((m) => m.email === member.user.email)?.userId
    ?? (await call(`/projects/${pid}/members`, { jwt })).json.find((m) => m.email === member.user.email)?.id;
  await call(`/projects/${pid}/members/${memberId}`, { jwt, method: 'DELETE' });
  const afterRemoval = await call(`/projects/${pid}/ota/latest?locale=he`, { jwt: memberTok, headers: { 'If-None-Match': memberFirst.etag } });
  check('removed member with valid ETag gets 403/404, not 304', [403, 404].includes(afterRemoval.status), `got ${afterRemoval.status}`);
  const sdkTokRow = (await call('/auth/tokens', { jwt })).json.find((x) => x.name === 'sdk');
  await call(`/auth/tokens/${sdkTokRow.id}`, { jwt, method: 'DELETE' });
  const afterRevoke = await call(`/projects/${pid}/ota/latest?locale=he`, { token: rtok, headers: { 'If-None-Match': lt.etag } });
  check('revoked token with valid ETag gets 401, not 304', afterRevoke.status === 401, `got ${afterRevoke.status}`);
  // Restore member access for subsequent checks.
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email } });

  // Concurrent publish: versions strictly unique and monotonic, each payload a
  // consistent full read (every version has both locales and the same keys).
  const pre = (await call(`/projects/${pid}/ota`, { jwt })).json.filter((x) => x.branch === 'main').map((x) => x.version);
  const base = Math.max(...pre);
  const pubs = await Promise.all([0, 1, 2, 3, 4].map(() => call(`/projects/${pid}/ota/publish`, { jwt, method: 'POST', body: {} })));
  const versions = pubs.map((r) => r.json?.version).sort((x, y) => x - y);
  check('5 concurrent publishes all succeed with unique monotonic versions',
    pubs.every((r) => r.status === 201) && new Set(versions).size === 5 && JSON.stringify(versions) === JSON.stringify([base + 1, base + 2, base + 3, base + 4, base + 5]),
    JSON.stringify(versions));
  const payloadChecks = await Promise.all(versions.map(async (v) => {
    const b = (await call(`/projects/${pid}/ota/${v}/he`, { jwt })).json;
    return b.version === v && typeof b.translations['app.title'] === 'string';
  }));
  check('every concurrently published bundle is self-consistent', payloadChecks.every(Boolean), JSON.stringify(payloadChecks));

  // Valid flat key names must not become JavaScript object behavior in OTA.
  const specialPid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Special OTA keys', slug: `ota-special-${Date.now()}`, baseLocale: 'en', locales: ['en'] } })).json.id;
  const specialEntries = [['__proto__', 'prototype text'], ['constructor', 'constructor text'], ['toString', 'string text'], ['hasOwnProperty', 'own text'], ['constructor.prototype.label', 'literal dotted text']];
  const specialWrites = [];
  let prototypeKeyId;
  for (const [name, value] of specialEntries) {
    const created = await call(`/projects/${specialPid}/keys`, { jwt, method: 'POST', body: { name } });
    const written = await call(`/projects/${specialPid}/keys/${created.json.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value } });
    specialWrites.push(created.status === 201 && written.status === 200);
    if (name === '__proto__') prototypeKeyId = created.json.id;
  }
  check('prototype-named valid keys and values are accepted', specialWrites.every(Boolean));
  // Force the second write to fail in real PostgreSQL, not an API mock.
  // The placeholder insert must roll back with the payload update.
  const { PrismaClient } = await import('@prisma/client');
  const faultDb = new PrismaClient({ datasources: { db: { url } } });
  try {
    await faultDb.$executeRawUnsafe("CREATE FUNCTION ota_test_reject_payload() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'OTA_TEST_PAYLOAD_WRITE'; END $$");
    await faultDb.$executeRawUnsafe('CREATE TRIGGER ota_test_payload_fault BEFORE UPDATE OF payload ON ota_publications FOR EACH ROW EXECUTE FUNCTION ota_test_reject_payload()');
    const failedPublish = await call(`/projects/${specialPid}/ota/publish`, { jwt, method: 'POST', body: {} });
    check('forced payload storage error refuses publication without SQL details', failedPublish.status === 500 && !JSON.stringify(failedPublish.json).includes('OTA_TEST_PAYLOAD_WRITE'));
    check('failed payload storage leaves no committed placeholder row', await faultDb.otaPublication.count({ where: { projectId: specialPid } }) === 0);
    check('failed payload storage leaves no publication list or release audit', (await call(`/projects/${specialPid}/ota`, { jwt })).json.length === 0 && (await call(`/projects/${specialPid}/activity?action=ota.published`, { jwt })).json.items.length === 0);
    check('failed first publication cannot become latest empty bundle', (await call(`/projects/${specialPid}/ota/latest?locale=en`, { jwt })).status === 404);
  } finally {
    await faultDb.$executeRawUnsafe('DROP TRIGGER IF EXISTS ota_test_payload_fault ON ota_publications');
    await faultDb.$executeRawUnsafe('DROP FUNCTION IF EXISTS ota_test_reject_payload()');
    await faultDb.$disconnect();
  }
  const specialPub = await call(`/projects/${specialPid}/ota/publish`, { jwt, method: 'POST', body: {} });
  check('retry after payload rollback starts at version1', specialPub.status === 201 && specialPub.json.version === 1);
  check('successful payload retry creates one publication audit', (await call(`/projects/${specialPid}/activity?action=ota.published`, { jwt })).json.items.length === 1);
  check('prototype-named publication counts every stored translation', specialPub.status === 201 && specialPub.json.translations === specialEntries.length && specialPub.json.locales.join(',') === 'en');
  for (const path of ['latest?locale=en', `1/en?publicationId=${specialPub.json.id}`]) {
    const raw = await fetch(`${API}/projects/${specialPid}/ota/${path}`, { headers: { Authorization: `Bearer ${jwt}` } });
    const text = await raw.text();
    const data = JSON.parse(text);
    check(`prototype-named keys survive exact flat bundle (${path.startsWith('latest') ? 'latest' : 'pinned version'})`, raw.status === 200 && Object.keys(data.translations).length === specialEntries.length && specialEntries.every(([name, value]) => Object.hasOwn(data.translations, name) && data.translations[name] === value));
    check(`special-key bundle retains exact integrity (${path.startsWith('latest') ? 'latest' : 'pinned version'})`, raw.headers.get('x-openlocale-bundle-sha256') === createHash('sha256').update(text).digest('hex'));
  }

  const specialList = (await call(`/projects/${specialPid}/ota`, { jwt })).json;
  check('stored prototype-named publication metadata retains all keys', specialList.length === 1 && specialList[0].translations === specialEntries.length);
  await call(`/projects/${specialPid}/keys/${prototypeKeyId}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'edited source' } });
  const specialRetained = await call(`/projects/${specialPid}/ota/1/en?publicationId=${specialPub.json.id}`, { jwt });
  check('prototype-named retained value stays immutable after source edit', Object.hasOwn(specialRetained.json.translations, '__proto__') && specialRetained.json.translations.__proto__ === 'prototype text');

  const priorBundle = await call(`/projects/${specialPid}/ota/latest?locale=en`, { jwt });
  const retryDb = new PrismaClient({ datasources: { db: { url } } });
  try {
    await retryDb.$executeRawUnsafe("CREATE FUNCTION ota_test_reject_payload() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'OTA_TEST_PAYLOAD_WRITE'; END $$");
    await retryDb.$executeRawUnsafe('CREATE TRIGGER ota_test_payload_fault BEFORE UPDATE OF payload ON ota_publications FOR EACH ROW EXECUTE FUNCTION ota_test_reject_payload()');
    check('forced next payload failure refuses release', (await call(`/projects/${specialPid}/ota/publish`, { jwt, method: 'POST', body: {} })).status === 500);
    const afterFailedList = (await call(`/projects/${specialPid}/ota`, { jwt })).json;
    check('failed next payload preserves sole retained publication identity', afterFailedList.length === 1 && afterFailedList[0].id === specialPub.json.id && afterFailedList[0].version === 1 && afterFailedList[0].translations === specialEntries.length);
    const afterFailedLatest = await call(`/projects/${specialPid}/ota/latest?locale=en`, { jwt });
    check('failed next payload preserves complete previous latest body and ETag', afterFailedLatest.status === 200 && afterFailedLatest.etag === priorBundle.etag && JSON.stringify(afterFailedLatest.json) === JSON.stringify(priorBundle.json));
    check('failed next payload preserves previous conditional304', (await call(`/projects/${specialPid}/ota/latest?locale=en`, { jwt, headers: { 'If-None-Match': priorBundle.etag } })).status === 304);
    check('failed next payload cannot create readable version2 or release audit', (await call(`/projects/${specialPid}/ota/2/en`, { jwt })).status === 404 && (await call(`/projects/${specialPid}/activity?action=ota.published`, { jwt })).json.items.length === 1);
  } finally {
    await retryDb.$executeRawUnsafe('DROP TRIGGER IF EXISTS ota_test_payload_fault ON ota_publications');
    await retryDb.$executeRawUnsafe('DROP FUNCTION IF EXISTS ota_test_reject_payload()');
    await retryDb.$disconnect();
  }
  const successfulNext = await call(`/projects/${specialPid}/ota/publish`, { jwt, method: 'POST', body: {} });
  check('next retry reuses version2 with exactly two successful release audits', successfulNext.status === 201 && successfulNext.json.version === 2 && (await call(`/projects/${specialPid}/activity?action=ota.published`, { jwt })).json.items.length === 2);
  const nextLatest = await call(`/projects/${specialPid}/ota/latest?locale=en`, { jwt, headers: { 'If-None-Match': priorBundle.etag } });
  check('successful next retry returns complete edited latest not false304', nextLatest.status === 200 && nextLatest.json.version === 2 && nextLatest.json.translations.__proto__ === 'edited source' && Object.keys(nextLatest.json.translations).length === specialEntries.length && nextLatest.etag !== priorBundle.etag);
  const oldPinned = await call(`/projects/${specialPid}/ota/1/en?publicationId=${specialPub.json.id}`, { jwt });
  check('successful next retry leaves previous pinned body and validator immutable', oldPinned.status === 200 && oldPinned.etag === priorBundle.etag && JSON.stringify(oldPinned.json) === JSON.stringify(priorBundle.json));

  // Pruning: 26 publishes on feat keep only the latest 25.
  for (let i = 0; i < 25; i++) {
    await call(`/projects/${pid}/ota/publish`, { jwt, method: 'POST', body: { branch: 'feat' } });
  }
  const listF = (await call(`/projects/${pid}/ota`, { jwt })).json.filter((x) => x.branch === 'feat');
  check('publications pruned to latest 25 per branch', listF.length === 25 && Math.min(...listF.map((x) => x.version)) === 2, `count=${listF.length} min=${Math.min(...listF.map((x) => x.version))}`);
  check('pruned v1 bundle is gone (404)', (await call(`/projects/${pid}/ota/1/he?branch=feat`, { jwt })).status === 404);
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
}
console.log(failures ? `ota: ${failures} FAILURES` : 'ota pass complete');
process.exit(failures ? 1 : 0);
