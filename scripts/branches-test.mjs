// Branches: branch-scoped keys, merge, admin gates, snapshots across branches.
// Real PostgreSQL + real HTTP API. Run: node scripts/branches-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55463, API_PORT = 3025;
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

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-br-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_br');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_br`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'br-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const owner = (await call('/auth/signup', { method: 'POST', body: { email: `br${Date.now()}@t.dev`, password: 'pass1234', displayName: 'br' } })).json;
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `brm${Date.now()}@t.dev`, password: 'pass1234', displayName: 'brm' } })).json;
  const jwt = owner.accessToken;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Br', slug: `br-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email } });

  // Default branch.
  const branches0 = await call(`/projects/${pid}/branches`, { jwt });
  check('new project has a main branch', branches0.status === 200 && branches0.json.length === 1 && branches0.json[0].name === 'main');
  check('member can list branches', (await call(`/projects/${pid}/branches`, { jwt: member.accessToken })).status === 200);
  check('member cannot create a branch (403)', (await call(`/projects/${pid}/branches`, { jwt: member.accessToken, method: 'POST', body: { name: 'feat' } })).status === 403);
  check('bad branch name rejected (400)', (await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'bad name!' } })).status === 400);
  const feat = (await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat' } })).json;
  check('admin creates a branch', !!feat?.id, JSON.stringify(feat));
  check('duplicate branch rejected (400)', (await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat' } })).status === 400);

  // Keys are branch-scoped.
  const kMain = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'app.title' } })).json;
  const kFeat = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'app.title', branch: 'feat' } })).json;
  check('same key name allowed in two branches', kMain.id !== kFeat.id);
  const kFeatOnly = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'feat.only', branch: 'feat' } })).json;
  const listMain = (await call(`/projects/${pid}/keys`, { jwt })).json;
  const listFeat = (await call(`/projects/${pid}/keys?branch=feat`, { jwt })).json;
  check('default list shows main only', listMain.length === 1 && listMain[0].name === 'app.title');
  check('branch list shows feat only', listFeat.length === 2 && listFeat.every((k) => ['app.title', 'feat.only'].includes(k.name)));
  check('unknown branch list is 404', (await call(`/projects/${pid}/keys?branch=nope`, { jwt })).status === 404);

  // Translations per branch.
  await call(`/projects/${pid}/keys/${kMain.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'ראשי' } });
  await call(`/projects/${pid}/keys/${kFeat.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'ברנץ' } });
  await call(`/projects/${pid}/keys/${kFeatOnly.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'חדש' } });
  const expMain = JSON.parse((await call(`/projects/${pid}/export/he?flat=true`, { jwt })).json === null ? '{}' : JSON.stringify((await call(`/projects/${pid}/export/he?flat=true`, { jwt })).json));
  const expMainRaw = await fetch(`${API}/projects/${pid}/export/he?flat=true`, { headers: { Authorization: `Bearer ${jwt}` } }).then((r) => r.json());
  check('main export has main values only', expMainRaw['app.title'] === 'ראשי' && !('feat.only' in expMainRaw), JSON.stringify(expMainRaw));
  const expFeatRaw = await fetch(`${API}/projects/${pid}/export/he?flat=true&branch=feat`, { headers: { Authorization: `Bearer ${jwt}` } }).then((r) => r.json());
  check('feat export has feat values', expFeatRaw['app.title'] === 'ברנץ' && expFeatRaw['feat.only'] === 'חדש');
  void expMain;

  // Import into a branch only touches that branch.
  const imp = await call(`/projects/${pid}/import/he?branch=feat`, { jwt, method: 'POST', body: { entries: { 'imported.key': 'יובא' } } });
  check('import into feat succeeds', imp.status === 201);
  check('imported key only in feat', !(await call(`/projects/${pid}/keys`, { jwt })).json.some((k) => k.name === 'imported.key')
    && (await call(`/projects/${pid}/keys?branch=feat`, { jwt })).json.some((k) => k.name === 'imported.key'));

  // Merge feat -> main: upserts, target-only kept, nothing deleted.
  const mainOnly = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'main.only' } })).json;
  await call(`/projects/${pid}/keys/${mainOnly.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'נשאר' } });
  check('member cannot merge (403)', (await call(`/projects/${pid}/branches/${feat.id}/merge`, { jwt: member.accessToken, method: 'POST', body: { into: 'main' } })).status === 403);
  check('merge into itself rejected (400)', (await call(`/projects/${pid}/branches/${feat.id}/merge`, { jwt, method: 'POST', body: { into: 'feat' } })).status === 400);
  check('merge into unknown branch 404', (await call(`/projects/${pid}/branches/${feat.id}/merge`, { jwt, method: 'POST', body: { into: 'nope' } })).status === 404);
  const merge = await call(`/projects/${pid}/branches/${feat.id}/merge`, { jwt, method: 'POST', body: { into: 'main' } });
  check('merge reports counts', merge.status === 201 && merge.json.keysMerged >= 3 && merge.json.translationsMerged >= 3, JSON.stringify(merge.json));
  const afterMain = await fetch(`${API}/projects/${pid}/export/he?flat=true`, { headers: { Authorization: `Bearer ${jwt}` } }).then((r) => r.json());
  check('merge overwrote shared key in main', afterMain['app.title'] === 'ברנץ');
  check('merge added feat-only key to main', afterMain['feat.only'] === 'חדש' && afterMain['imported.key'] === 'יובא');
  check('merge kept main-only key', afterMain['main.only'] === 'נשאר');
  const featStill = (await call(`/projects/${pid}/keys?branch=feat`, { jwt })).json;
  check('source branch untouched by merge', featStill.length === 3);
  const acts = (await call(`/projects/${pid}/activity?action=branch.merged`, { jwt })).json;
  check('merge recorded in activity', acts.items?.length >= 1);

  // Snapshots span branches: capture, delete feat, restore recreates it.
  const snap = (await call(`/projects/${pid}/snapshots`, { jwt, method: 'POST', body: { label: 'with-branches' } })).json;
  const del = await call(`/projects/${pid}/branches/${feat.id}`, { jwt, method: 'DELETE' });
  check('admin deletes a branch with its keys', del.status === 200 && del.json.keysRemoved === 3, JSON.stringify(del.json));
  check('main cannot be deleted (400)', (await call(`/projects/${pid}/branches/${(await call(`/projects/${pid}/branches`, { jwt })).json.find((b) => b.name === 'main').id}`, { jwt, method: 'DELETE' })).status === 400);
  const rest = await call(`/projects/${pid}/snapshots/${snap.id}/restore`, { jwt, method: 'POST' });
  check('restore succeeds', rest.status === 201);
  const featBack = (await call(`/projects/${pid}/keys?branch=feat`, { jwt })).json;
  check('restore recreated the deleted branch and its keys', featBack.length === 3, `feat keys=${featBack.length}`);

  // QA defaults to main and can target a branch.
  await call(`/projects/${pid}/keys/${kMain.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Title' } });
  const probe = (await call(`/projects/${pid}/keys?branch=feat`, { jwt })).json.find((k) => k.name === 'feat.only');
  await call(`/projects/${pid}/keys/${probe.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Feat only source' } });
  await call(`/projects/${pid}/keys/${probe.id}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  const qaMain = (await call(`/projects/${pid}/qa`, { jwt })).json;
  check('qa default scope is main', qaMain.issues.every((i) => i.key !== 'feat.only'));
  // feat.only has an EN source and an empty-valued he? No: he was set. Probe a
  // second feat key with EN source and no he translation instead.
  const probe2 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'qa.probe', branch: 'feat' } })).json;
  await call(`/projects/${pid}/keys/${probe2.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Probe source' } });
  const qaFeat = (await call(`/projects/${pid}/qa?branch=feat`, { jwt })).json;
  check('qa branch scope sees feat keys', qaFeat.issues.some((i) => i.key === 'qa.probe' && i.type === 'untranslated'), JSON.stringify(qaFeat.issues?.slice(0, 3)));
  check('qa main does not see feat-only probe', qaMain.issues.every((i) => i.key !== 'qa.probe'));

  // --- Session-only: API tokens (even read+write) cannot touch branch endpoints ---
  const tok = (await call('/auth/tokens', { jwt, method: 'POST', body: { name: 'ci', scopes: ['read', 'write'] } })).json;
  const apiCall = (path, opt = {}) => call(path, { ...opt, jwt: undefined, headers: undefined });
  const tokHeaders = { 'Content-Type': 'application/json', 'X-Api-Key': tok.token };
  const tokReq = async (path, method = 'GET', body) => {
    const res = await fetch(`${API}${path}`, { method, headers: tokHeaders, body: body ? JSON.stringify(body) : undefined });
    return res.status;
  };
  check('write token cannot list branches (403)', (await tokReq(`/projects/${pid}/branches`)) === 403);
  check('write token cannot create a branch (403)', (await tokReq(`/projects/${pid}/branches`, 'POST', { name: 'evil' })) === 403);
  check('write token cannot merge (403)', (await tokReq(`/projects/${pid}/branches/${feat.id}/merge`, 'POST', { into: 'main' })) === 403);
  check('write token cannot preview a merge (403)', (await tokReq(`/projects/${pid}/branches/${feat.id}/merge/preview`, 'POST', { into: 'main' })) === 403);
  check('write token cannot delete a branch (403)', (await tokReq(`/projects/${pid}/branches/${feat.id}`, 'DELETE')) === 403);
  check('write token CAN read keys with ?branch= (branch param stays token-usable)',
    (await tokReq(`/projects/${pid}/keys?branch=main`)) === 200);
  void apiCall;

  // --- Bulk review is branch-scoped: same-named keys on main are never touched ---
  const bmMain = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'bulk.probe' } })).json;
  const bmFeat = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'bulk.probe', branch: 'feat' } })).json;
  await call(`/projects/${pid}/keys/${bmMain.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'ראשי בלק' } });
  await call(`/projects/${pid}/keys/${bmFeat.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'ברנץ בלק' } });
  const bulkPrev = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED', search: 'bulk.probe', branch: 'feat', dryRun: true } });
  check('bulk preview on feat counts only feat rows', bulkPrev.json?.matched === 1, JSON.stringify(bulkPrev.json));
  const bulkRun = await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', from: 'UNVERIFIED', search: 'bulk.probe', branch: 'feat', notChangedSince: bulkPrev.json.previewAt } });
  check('bulk commit on feat updates 1 row', bulkRun.json?.updated === 1, JSON.stringify(bulkRun.json));
  const bmMainAfter = (await call(`/projects/${pid}/keys`, { jwt })).json.find((k) => k.name === 'bulk.probe');
  const mainTrans = bmMainAfter.translations?.find?.((t) => t.localeCode === 'he') ?? bmMainAfter.translations?.he;
  const mainStatus = bmMainAfter.translations?.he?.status ?? mainTrans?.status;
  check('same-named main key untouched by feat bulk', mainStatus === 'UNVERIFIED', JSON.stringify(mainStatus));
  check('bulk with unknown branch 404', (await call(`/projects/${pid}/review/bulk-status`, { jwt, method: 'POST', body: { locale: 'he', status: 'REVIEWED', branch: 'nope', dryRun: true } })).status === 404);

  // --- Merge preview + optimistic guard + history + snapshot (fresh project, controlled counts) ---
  const pid2 = (await call('/projects', { jwt, method: 'POST', body: { name: 'Br2', slug: `br2-${Date.now()}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  const patchSt = await call(`/projects/${pid2}`, { jwt, method: 'PATCH', body: { customStatuses: ['NEEDS_FIX'] } });
  check('custom status registered on project', patchSt.status === 200, JSON.stringify(patchSt.json).slice(0, 120));
  const trOf = (k, l) => k.translations?.[l] ?? k.translations?.find?.((t) => t.localeCode === l);
  const f2 = (await call(`/projects/${pid2}/branches`, { jwt, method: 'POST', body: { name: 'feat' } })).json;
  const put = async (keyId, locale, value, status) => {
    await call(`/projects/${pid2}/keys/${keyId}/translations`, { jwt, method: 'PUT', body: { locale, value } });
    if (status) await call(`/projects/${pid2}/keys/${keyId}/translations/${locale}/status`, { jwt, method: 'PATCH', body: { status } });
  };
  const sh = (n, branch, desc, tags) => call(`/projects/${pid2}/keys`, { jwt, method: 'POST', body: { name: n, branch, description: desc, tags } }).then((r) => r.json);
  const mShared = await sh('shared', undefined, 'main-desc', ['a']);
  const fShared = await sh('shared', 'feat', 'feat-desc', ['b']);
  const mSame = await sh('same'); const fSame = await sh('same', 'feat');
  const fNew = await sh('newkey', 'feat'); const mOnly = await sh('keeponly');
  await put(mShared.id, 'he', 'main text', 'REVIEWED');
  await put(fShared.id, 'he', 'feat text', 'UNVERIFIED');
  const stSet = await call(`/projects/${pid2}/keys/${fShared.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Source' } });
  const stPatch = await call(`/projects/${pid2}/keys/${fShared.id}/translations/en/status`, { jwt, method: 'PATCH', body: { status: 'NEEDS_FIX' } });
  check('custom status set on feat translation', stSet.status < 300 && stPatch.status === 200, JSON.stringify(stPatch.json).slice(0, 120));
  await put(mShared.id, 'en', 'Source', 'UNVERIFIED');
  await put(mSame.id, 'he', 'same', 'UNVERIFIED'); await put(fSame.id, 'he', 'same', 'UNVERIFIED');
  await put(fNew.id, 'he', 'new val', 'UNVERIFIED');
  await put(mOnly.id, 'he', 'stay', 'REVIEWED');

  check('member cannot preview a merge (403)', (await call(`/projects/${pid2}/branches/${f2.id}/merge/preview`, { jwt: member.accessToken, method: 'POST', body: { into: 'main' } })).status === 403);
  const prev = (await call(`/projects/${pid2}/branches/${f2.id}/merge/preview`, { jwt, method: 'POST', body: { into: 'main' } })).json;
  check('preview counts: 1 created, 2 existing, 2 overwrites, 1 identical, 1 added, 1 target-only',
    prev.keysCreated === 1 && prev.keysExisting === 2 && prev.translationsOverwritten === 2 && prev.translationsIdentical === 1 && prev.targetOnlyKeys === 1 && prev.translationsAdded === 1,
    JSON.stringify(prev));
  check('preview returns previewAt', typeof prev.previewAt === 'string' && prev.previewAt.includes('T'));

  // Concurrent target edit AFTER the preview: guarded merge skips it.
  await call(`/projects/${pid2}/keys/${mShared.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'edited after preview' } });
  const gMerge = (await call(`/projects/${pid2}/branches/${f2.id}/merge`, { jwt, method: 'POST', body: { into: 'main', previewedAt: prev.previewAt } })).json;
  check('guarded merge reports the skip', gMerge.translationsSkipped === 1, JSON.stringify(gMerge));
  const sharedAfterGuard = (await call(`/projects/${pid2}/keys`, { jwt })).json.find((k) => k.name === 'shared');
  const sharedHe = trOf(sharedAfterGuard, 'he')?.value;
  check('post-preview target edit survives guarded merge', sharedHe === 'edited after preview', JSON.stringify(sharedHe));
  const snaps2 = (await call(`/projects/${pid2}/snapshots`, { jwt })).json;
  check('pre-merge automatic snapshot exists', snaps2.some((x) => x.automatic && x.label.includes('before merge feat -> main')), JSON.stringify(snaps2.map((x) => x.label)));

  // Unguarded merge: overwrites, with history attribution and custom status copy.
  const prev2 = (await call(`/projects/${pid2}/branches/${f2.id}/merge/preview`, { jwt, method: 'POST', body: { into: 'main' } })).json;
  check('re-preview shows the overwrite is still pending', prev2.translationsOverwritten === 1, JSON.stringify(prev2));
  const uMerge = (await call(`/projects/${pid2}/branches/${f2.id}/merge`, { jwt, method: 'POST', body: { into: 'main' } })).json;
  check('unguarded merge copies the overwrite', uMerge.translationsSkipped === 0 && uMerge.translationsMerged === 1, JSON.stringify(uMerge));
  const sharedFinal = (await call(`/projects/${pid2}/keys`, { jwt })).json.find((k) => k.name === 'shared');
  check('unguarded merge overwrote target value', trOf(sharedFinal, 'he')?.value === 'feat text', JSON.stringify(trOf(sharedFinal, 'he')));
  check('merge copied custom status verbatim', trOf(sharedFinal, 'en')?.status === 'NEEDS_FIX', JSON.stringify(trOf(sharedFinal, 'en')));
  check('merge copied key metadata from source', sharedFinal.description === 'feat-desc' && JSON.stringify(sharedFinal.tags) === '["b"]', JSON.stringify({ d: sharedFinal.description, t: sharedFinal.tags }));
  const hist = (await call(`/projects/${pid2}/keys/${sharedFinal.id}/translations/he/history`, { jwt })).json;
  const mergeRow = (hist.items ?? hist).find?.((h) => h.previousValue === 'edited after preview');
  check('overwritten value preserved in history with merging actor',
    !!mergeRow && mergeRow.value === 'feat text' && !!mergeRow.changedBy?.displayName,
    JSON.stringify(mergeRow).slice(0, 200));

  // ABA: value changed after preview then changed BACK still bumps updatedAt,
  // so a guarded merge conservatively skips it (tested interleaving, not a
  // race-proof guarantee).
  const prev3 = (await call(`/projects/${pid2}/branches/${f2.id}/merge/preview`, { jwt, method: 'POST', body: { into: 'main' } })).json;
  const mSharedId = (await call(`/projects/${pid2}/keys`, { jwt })).json.find((k) => k.name === 'shared').id;
  // Round-trip main's he value away from the source and back to a value that
  // still DIFFERS from the source: without the updatedAt guard the merge
  // would silently overwrite it.
  await call(`/projects/${pid2}/keys/${mSharedId}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'ABA detour' } });
  await call(`/projects/${pid2}/keys/${mSharedId}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'back to a main-only wording' } });
  const abaMerge = (await call(`/projects/${pid2}/branches/${f2.id}/merge`, { jwt, method: 'POST', body: { into: 'main', previewedAt: prev3.previewAt } })).json;
  check('ABA post-preview write is conservatively skipped', abaMerge.translationsSkipped >= 1, JSON.stringify(abaMerge));
  const mOnlyAfter = (await call(`/projects/${pid2}/keys`, { jwt })).json.find((k) => k.name === 'keeponly');
  check('target-only key untouched by merge', trOf(mOnlyAfter, 'he')?.value === 'stay' && trOf(mOnlyAfter, 'he')?.status === 'REVIEWED');

} finally {
  if (api) api.kill('SIGTERM');
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `branches: ${failures} FAILURES` : 'branches pass complete');
process.exit(failures ? 1 : 0);
