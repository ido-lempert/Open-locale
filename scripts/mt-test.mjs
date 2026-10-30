// MT hooks slice: provider CRUD + pseudo driver + fill-empty-only
// pre-translate with version/history/activity accounting, permissions, and
// the batch cap. Real PG + HTTP.
// Run: node scripts/mt-test.mjs (requires: nx build api)
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55469, API_PORT = 3000;
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
const waitFor = async (url, tries = 90) => {
  for (let i = 0; i < tries; i++) { await new Promise((r) => setTimeout(r, 500)); if (await fetch(url).then((r) => r.status > 0).catch(() => false)) return true; }
  return false;
};

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mt-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_mt');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_mt`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'mt-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  if (!(await waitFor(`${API}/projects`))) throw new Error('API did not start');

  const ts = Date.now();
  const owner = (await call('/auth/signup', { method: 'POST', body: { email: `mt${ts}@t.dev`, password: 'pass1234', displayName: 'mt' } })).json;
  const jwt = owner.accessToken;
  const member = (await call('/auth/signup', { method: 'POST', body: { email: `mtm${ts}@t.dev`, password: 'pass1234', displayName: 'm' } })).json;
  const pid = (await call('/projects', { jwt, method: 'POST', body: { name: 'Mt', slug: `mt-${ts}`, baseLocale: 'en', locales: ['en', 'he', 'fr'] } })).json.id;
  await call(`/projects/${pid}/members`, { jwt, method: 'POST', body: { email: member.user.email, role: 'MEMBER', allowedLocales: ['fr'] } });

  // Provider management is admin-only.
  const memberCreate = await call(`/projects/${pid}/mt/providers`, { jwt: member.accessToken, method: 'POST', body: { name: 'x', type: 'pseudo' } });
  check('member cannot create a provider (403)', memberCreate.status === 403, `got ${memberCreate.status}`);
  const badType = await call(`/projects/${pid}/mt/providers`, { jwt, method: 'POST', body: { name: 'x', type: 'google' } });
  check('unimplemented provider type rejected (400)', badType.status === 400, `got ${badType.status}`);
  const provider = (await call(`/projects/${pid}/mt/providers`, { jwt, method: 'POST', body: { name: 'Pseudo', type: 'pseudo' } })).json;
  check('admin creates a pseudo provider', !!provider.id && provider.enabled === true);
  const dup = await call(`/projects/${pid}/mt/providers`, { jwt, method: 'POST', body: { name: 'Pseudo', type: 'pseudo' } });
  check('duplicate provider name conflicts (409)', dup.status === 409, `got ${dup.status}`);

  // Keys with fixtures: normal, placeholder+html, empty source, existing target.
  const k1 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'a.hello' } })).json;
  await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Hello {name}!' } });
  const k2 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'a.cta' } })).json;
  await call(`/projects/${pid}/keys/${k2.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Click <b>here</b> %s' } });
  const k3 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'a.empty' } })).json;
  const k4 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'a.bye' } })).json;
  await call(`/projects/${pid}/keys/${k4.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Bye' } });
  await call(`/projects/${pid}/keys/${k4.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: ' existing human ' } });
  const k4v1 = (await call(`/projects/${pid}/keys/${k4.id}/translations/he/history`, { jwt })).json.length;

  // Locale-restricted member can only run pre-translate on their locales.
  const deny = await call(`/projects/${pid}/mt/pretranslate`, { jwt: member.accessToken, method: 'POST', body: { providerId: provider.id, locale: 'he' } });
  check('locale-restricted member denied for he (403)', deny.status === 403, `got ${deny.status}`);
  const allowFr = await call(`/projects/${pid}/mt/pretranslate`, { jwt: member.accessToken, method: 'POST', body: { providerId: provider.id, locale: 'fr' } });
  check('locale-restricted member may pre-translate fr', allowFr.status === 200 || allowFr.status === 201, `got ${allowFr.status}`);

  const run1 = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he' } });
  check('pretranslate fills exactly the empty rows', run1.json && run1.json.translated === 2 && run1.json.skippedExisting === 1 && run1.json.skippedNoSource === 1 && run1.json.totalKeys === 4, JSON.stringify(run1.json));
  const keys1 = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json;
  const t1 = keys1.find((k) => k.id === k1.id).translations.find((t) => t.localeCode === 'he');
  const t2 = keys1.find((k) => k.id === k2.id).translations.find((t) => t.localeCode === 'he');
  const t4 = keys1.find((k) => k.id === k4.id).translations.find((t) => t.localeCode === 'he');
  check('pseudo output is wrapped, accented and target-tagged', /^\[.*·he\]$/.test(t1.value) && t1.value.includes('Ħ'), t1.value);
  check('placeholders and html survive untouched', t2.value.includes('<b>') && t2.value.includes('</b>') && t2.value.includes('%s'), t2.value);
  check('placeholder token preserved verbatim', t1.value.includes('{name}'), t1.value);
  check('existing human value untouched and unversioned', t4.value === ' existing human ' && t4.version === 1, JSON.stringify({ v: t4.version, val: t4.value }));
  const k4v2 = (await call(`/projects/${pid}/keys/${k4.id}/translations/he/history`, { jwt })).json.length;
  check('no new history for the untouched row', k4v2 === k4v1, `${k4v1} -> ${k4v2}`);
  const h1 = (await call(`/projects/${pid}/keys/${k1.id}/translations/he/history`, { jwt })).json;
  check('MT write has a history row with actor attribution', h1.length === 1 && h1[0].changedBy && h1[0].status === 'UNVERIFIED', JSON.stringify(h1[0] && h1[0].status));

  // Slice 14: provider confidence scoring + provenance
  check('run result carries score aggregates', run1.json.scored === 2 && run1.json.scoreAvg === 100 && run1.json.scoreMin === 100 && run1.json.scoreMax === 100, JSON.stringify({ s: run1.json.scored, a: run1.json.scoreAvg }));
  check('filled rows carry MT provenance', t1.mtScore === 100 && t1.mtProvider === 'Pseudo' && t2.mtScore === 100, JSON.stringify({ s: t1.mtScore, p: t1.mtProvider }));
  check('untouched human row has no provenance', t4.mtScore === null || t4.mtScore === undefined, JSON.stringify({ s: t4.mtScore }));
  const actsMt = (await call(`/projects/${pid}/activity?action=mt.pretranslate`, { jwt })).json;
  check('activity detail records score summary', actsMt.items?.[0]?.detail?.scoreAvg === 100, JSON.stringify(actsMt.items?.[0]?.detail));


  const run2 = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he' } });
  check('second run translates nothing (fill-empty-only)', run2.json.translated === 0 && run2.json.skippedExisting === 3 && run2.json.skippedNoSource === 1, JSON.stringify(run2.json));
  const t1b = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k1.id).translations.find((t) => t.localeCode === 'he');
  check('second run leaves value and version untouched', t1b.value === t1.value && t1b.version === 1, `v=${t1b.version}`);

  // Determinism: same input in another locale produces the same letters with a
  // different locale tag.
  const t1fr = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k1.id).translations.find((t) => t.localeCode === 'fr');
  check('pseudo is deterministic modulo the locale tag', t1fr && t1fr.value.replace('·fr]', ']') === t1.value.replace('·he]', ']'), `${t1fr && t1fr.value} vs ${t1.value}`);

  // keyIds scoping: only the listed keys are considered.
  const k5 = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'a.scoped' } })).json;
  await call(`/projects/${pid}/keys/${k5.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Scoped' } });
  const scoped = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he', keyIds: [k5.id] } });
  check('keyIds scopes the run', scoped.json.translated === 1 && scoped.json.totalKeys === 1, JSON.stringify(scoped.json));

  // Disabled provider refuses runs; re-enable works.
  await call(`/projects/${pid}/mt/providers/${provider.id}`, { jwt, method: 'PATCH', body: { enabled: false } });
  const dis = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'fr' } });
  check('disabled provider refuses (400)', dis.status === 400, `got ${dis.status}`);
  await call(`/projects/${pid}/mt/providers/${provider.id}`, { jwt, method: 'PATCH', body: { enabled: true } });

  // Same-target-as-source rejected.
  const sameLoc = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he', sourceLocale: 'he' } });
  check('source == target rejected (400)', sameLoc.status === 400, `got ${sameLoc.status}`);

  // Cross-project provider id is invisible.
  const pidB = (await call('/projects', { jwt, method: 'POST', body: { name: 'MtB', slug: `mtb-${ts}`, baseLocale: 'en', locales: ['en', 'he'] } })).json.id;
  const cross = await call(`/projects/${pidB}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he' } });
  check('provider from another project is 404', cross.status === 404, `got ${cross.status}`);

  // Batch cap: >200 selected keys is a 400.
  for (let i = 0; i < 201; i++) {
    await call(`/projects/${pidB}/keys`, { jwt, method: 'POST', body: { name: `bulk.k${i}` } });
  }
  const over = await call(`/projects/${pidB}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: (await call(`/projects/${pidB}/mt/providers`, { jwt, method: 'POST', body: { name: 'P', type: 'pseudo' } })).json.id, locale: 'he' } });
  check('batch cap rejects runs over 200 keys (400)', over.status === 400, `got ${over.status}`);
  const withinCap = await call(`/projects/${pidB}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: over.json ? (await call(`/projects/${pidB}/mt/providers`, { jwt })).json[0].id : '', locale: 'he', keyIds: [] } });
  check('empty keyIds list selects nothing, not everything', withinCap.json && withinCap.json.totalKeys === 0 && withinCap.json.translated === 0, JSON.stringify(withinCap.json));

  // Branch isolation: same-named key on another branch is invisible to a
  // main run, and an explicit branch run touches only that branch.
  await call(`/projects/${pid}/branches`, { jwt, method: 'POST', body: { name: 'feat-mt' } });
  const kf = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'a.hello', branch: 'feat-mt' } })).json;
  await call(`/projects/${pid}/keys/${kf.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Feat only' } });
  const mainRun = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he' } });
  const featKeysAfterMain = (await call(`/projects/${pid}/keys?branch=feat-mt`, { jwt })).json;
  const featTrAfterMain = featKeysAfterMain.find((k) => k.id === kf.id).translations.find((t) => t.localeCode === 'he');
  check('default main run does NOT touch the other branch', mainRun.json.translated === 0 && !featTrAfterMain, JSON.stringify({ run: mainRun.json, featTr: !!featTrAfterMain }));
  const featRun = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he', branch: 'feat-mt' } });
  const featTr = (await call(`/projects/${pid}/keys?branch=feat-mt`, { jwt })).json.find((k) => k.id === kf.id).translations.find((t) => t.localeCode === 'he');
  check('explicit branch run fills only that branch', featRun.json.translated === 1 && featRun.json.totalKeys === 1 && featTr && featTr.value.includes('·he]'), JSON.stringify(featRun.json));
  const mainK1AfterFeat = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k1.id).translations.find((t) => t.localeCode === 'he');
  check('feat run left the main row byte-identical', mainK1AfterFeat.value === t1.value && mainK1AfterFeat.version === 1);
  const noBranch = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he', branch: 'nope' } });
  check('unknown branch rejected (400)', noBranch.status === 400, `got ${noBranch.status}`);

  // Project isolation: a foreign project's key id is invisible, not an error.
  const foreignKey = (await call(`/projects/${pidB}/keys`, { jwt, method: 'POST', body: { name: 'a.foreign' } })).json;
  const foreignRun = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he', keyIds: [foreignKey.id] } });
  check('keyIds from another project select nothing', foreignRun.json.totalKeys === 0 && foreignRun.json.translated === 0, JSON.stringify(foreignRun.json));

  // Row identity + human overwrite: MT fill keeps rowId; a later human write
  // bumps version and keeps the SAME rowId; a following run touches neither.
  const k1heBefore = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k1.id).translations.find((t) => t.localeCode === 'he');
  check('MT-filled row exposes a rowId', typeof k1heBefore.rowId === 'string' && k1heBefore.rowId.length === 36);
  const human = await call(`/projects/${pid}/keys/${k1.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'תרגום אנושי', expectedVersion: 1, expectedRowId: k1heBefore.rowId } });
  check('human overwrite of MT data commits with identity', human.status === 200 && human.json.version === 2, `got ${human.status}`);
  const runAfterHuman = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he' } });
  const k1heAfter = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === k1.id).translations.find((t) => t.localeCode === 'he');
  check('run after human write keeps value, version and rowId', runAfterHuman.json.translated === 0 && k1heAfter.value === 'תרגום אנושי' && k1heAfter.version === 2 && k1heAfter.rowId === k1heBefore.rowId, JSON.stringify({ v: k1heAfter.version, sameRow: k1heAfter.rowId === k1heBefore.rowId }));
  const h1b = (await call(`/projects/${pid}/keys/${k1.id}/translations/he/history`, { jwt })).json;
  check('history shows exactly MT fill then human edit, in order', h1b.length === 2 && h1b[0].value === 'תרגום אנושי' && h1b[1].value === t1.value, JSON.stringify(h1b.map((h) => h.value)));

  // Whitespace-only and REVIEWED values are human content: never filled over.
  await call(`/projects/${pid}/keys/${k3.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: ' ' } });
  await call(`/projects/${pid}/keys/${k5.id}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'REVIEWED' } });
  const wsRun = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he', keyIds: [k3.id, k5.id] } });
  const afterWs = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json;
  const t3 = afterWs.find((k) => k.id === k3.id).translations.find((t) => t.localeCode === 'he');
  const t5 = afterWs.find((k) => k.id === k5.id).translations.find((t) => t.localeCode === 'he');
  check('whitespace-only value preserved (skipped, not filled)', wsRun.json.translated === 0 && t3.value === ' ' && t3.version === 1, JSON.stringify({ run: wsRun.json, v: t3.version }));
  check('REVIEWED value and status preserved', t5.value.includes('·he]') && t5.status === 'REVIEWED' && t5.version === 2, JSON.stringify({ s: t5.status, v: t5.version }));

  // Activity trail.
  const acts = (await call(`/projects/${pid}/activity`, { jwt })).json;
  const mtActs = (acts.items || []).filter((a) => a.action === 'mt.pretranslate');
  check('activity log records pre-translate runs', mtActs.length >= 2, `got ${mtActs.length}`);

  // Delete provider: further runs 404.
  await call(`/projects/${pid}/mt/providers/${provider.id}`, { jwt, method: 'DELETE' });
  const gone = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider.id, locale: 'he' } });
  check('deleted provider is 404', gone.status === 404, `got ${gone.status}`);

  // Provenance clearing uses its own key and provider (the shared one is
  // deleted by an earlier leg) so no other leg's fixture changes.
  const kp = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'a.provclear' } })).json;
  await call(`/projects/${pid}/keys/${kp.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Clear me' } });
  const provider2 = (await call(`/projects/${pid}/mt/providers`, { jwt, method: 'POST', body: { name: 'Pseudo-2', type: 'pseudo' } })).json;
  const provRun = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider2.id, locale: 'he', keyIds: [kp.id] } });
  check('dedicated key filled with provenance', provRun.json.translated === 1 && provRun.json.scored === 1, JSON.stringify(provRun.json));
  const humanEdit = await call(`/projects/${pid}/keys/${kp.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'תרגום אנושי' } });
  check('human edit accepted', humanEdit.status === 200 || humanEdit.status === 201, `got ${humanEdit.status}`);
  const tProv = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === kp.id).translations.find((t) => t.localeCode === 'he');
  check('human edit clears MT provenance', tProv.mtScore === null && tProv.mtProvider === null && tProv.value === 'תרגום אנושי', JSON.stringify({ s: tProv.mtScore, p: tProv.mtProvider }));

  // --- Slice 15: provenance tracks the TEXT, not status/metadata edits ---
  // Dedicated key: other legs have already human-edited the shared fixtures.
  const fetchHe = async (kid) => (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === kid).translations.find((t) => t.localeCode === 'he');
  const kpv = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'a.provkeep' } })).json;
  await call(`/projects/${pid}/keys/${kpv.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Keep my provenance' } });
  const keepRun = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider2.id, locale: 'he', keyIds: [kpv.id] } });
  check('provenance-keep key filled by MT', keepRun.json.translated === 1 && keepRun.json.scored === 1, JSON.stringify(keepRun.json));
  const filledPv = await fetchHe(kpv.id);
  check('provenance present before edits', filledPv.mtScore === 100 && filledPv.mtProvider === 'Pseudo-2', JSON.stringify({ s: filledPv.mtScore, p: filledPv.mtProvider }));
  const statusOnly = await call(`/projects/${pid}/keys/${kpv.id}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'REVIEWED' } });
  check('status-only edit accepted', statusOnly.status === 200, `got ${statusOnly.status}`);
  const afterStatus = await fetchHe(kpv.id);
  check('status-only edit preserves MT provenance', afterStatus.status === 'REVIEWED' && afterStatus.mtScore === 100 && afterStatus.mtProvider === 'Pseudo-2', JSON.stringify({ st: afterStatus.status, s: afterStatus.mtScore, p: afterStatus.mtProvider }));
  const resave = await call(`/projects/${pid}/keys/${kpv.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: afterStatus.value } });
  check('identical-text resave accepted', resave.status === 200 || resave.status === 201, `got ${resave.status}`);
  const afterResave = await fetchHe(kpv.id);
  check('identical-text resave preserves provenance and review state', afterResave.mtScore === 100 && afterResave.status === 'REVIEWED', JSON.stringify({ s: afterResave.mtScore, st: afterResave.status }));
  // Snapshot restore: a restore that changes only STATUS preserves provenance;
  // one that restores different TEXT clears it (the restored wording's origin
  // is not recorded in the snapshot, so claiming MT provenance would mislead).
  const snap = (await call(`/projects/${pid}/snapshots`, { jwt, method: 'POST', body: { label: 'mt-prov' } })).json;
  check('snapshot created', !!snap.id, JSON.stringify(snap).slice(0, 120));
  const backToUnverified = await call(`/projects/${pid}/keys/${kpv.id}/translations/he/status`, { jwt, method: 'PATCH', body: { status: 'UNVERIFIED' } });
  check('status flip accepted', backToUnverified.status === 200, `got ${backToUnverified.status}`);
  await call(`/projects/${pid}/snapshots/${snap.id}/restore`, { jwt, method: 'POST', body: {} });
  const afterRestore1 = await fetchHe(kpv.id);
  check('status-only snapshot restore preserves MT provenance', afterRestore1.status === 'REVIEWED' && afterRestore1.mtScore === 100 && afterRestore1.mtProvider === 'Pseudo-2', JSON.stringify({ st: afterRestore1.status, s: afterRestore1.mtScore }));
  const textChange = await call(`/projects/${pid}/keys/${kpv.id}/translations`, { jwt, method: 'PUT', body: { locale: 'he', value: 'human replacement' } });
  check('text change accepted', textChange.status === 200 || textChange.status === 201, `got ${textChange.status}`);
  await call(`/projects/${pid}/snapshots/${snap.id}/restore`, { jwt, method: 'POST', body: {} });
  const afterRestore2 = await fetchHe(kpv.id);
  check('text-changing snapshot restore clears MT provenance', afterRestore2.value === afterStatus.value && (afterRestore2.mtScore === null || afterRestore2.mtScore === undefined), JSON.stringify({ v: afterRestore2.value, s: afterRestore2.mtScore }));

  // --- Slice 15: plural keys are skipped by the scalar-only pseudo fixture ---
  const kpl = (await call(`/projects/${pid}/keys`, { jwt, method: 'POST', body: { name: 'a.plural', isPlural: true } })).json;
  await call(`/projects/${pid}/keys/${kpl.id}/translations`, { jwt, method: 'PUT', body: { locale: 'en', value: 'Items', pluralForms: { one: 'One item', other: 'Many items' } } });
  const pluralRun = await call(`/projects/${pid}/mt/pretranslate`, { jwt, method: 'POST', body: { providerId: provider2.id, locale: 'he', keyIds: [kpl.id] } });
  check('plural key is skipped, not half-filled', pluralRun.json.translated === 0 && pluralRun.json.skippedPlural === 1, JSON.stringify(pluralRun.json));
  const tPlural = (await call(`/projects/${pid}/keys?branch=main`, { jwt })).json.find((k) => k.id === kpl.id).translations.find((t) => t.localeCode === 'he');
  check('skipped plural row has no value, forms or provenance', !tPlural || (tPlural.value === '' && !tPlural.pluralForms && (tPlural.mtScore === null || tPlural.mtScore === undefined)), JSON.stringify(tPlural));
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
console.log(failures ? `mt: ${failures} FAILURES` : 'mt pass complete');
process.exit(failures ? 1 : 0);
