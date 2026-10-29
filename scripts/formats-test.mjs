// CSV import/export: real PostgreSQL + real HTTP API. Run: node scripts/formats-test.mjs
import { execFileSync, spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT = 55446, API_PORT = 3013;
const API = `http://127.0.0.1:${API_PORT}/api`;
const root = process.cwd();
let failures = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };
async function call(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-fmt-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_fmt');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_fmt`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'fmt-secret', PORT: String(API_PORT) }, stdio: 'pipe' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = await fetch(`${API}/projects`).then((r) => r.status === 401).catch(() => false);
  }
  if (!up) throw new Error('API did not start');

  const a = (await call('/auth/signup', { method: 'POST', body: { email: 'a@fmt.io', password: 'password-a', displayName: 'Alice A' } })).json;
  const b = (await call('/auth/signup', { method: 'POST', body: { email: 'b@fmt.io', password: 'password-b', displayName: 'Bob B' } })).json;
  const at = a.accessToken, bt = b.accessToken;
  const proj = (await call('/projects', { token: at, method: 'POST', body: { name: 'FMT', slug: 'fmt', locales: ['en', 'he'] } })).json;
  const P = `/projects/${proj.id}`;

  // Seed via CSV import (with header row and quoted specials)
  const csvIn = 'key,value\napp.title,"My App"\nmsg.quote,"He said ""hi"", loudly"\nmsg.multi,"line1\nline2"\n';
  const imp = await call(`${P}/import/en`, { token: at, method: 'POST', body: { csv: csvIn } });
  check('CSV import accepted', imp.status === 201 && imp.json.translationsUpserted === 3, JSON.stringify(imp.json));

  const exp = await fetch(`${API}${P}/export/en/csv`, { headers: { Authorization: `Bearer ${at}` } });
  const text = await exp.text();
  check('CSV export content-type', (exp.headers.get('content-type') || '').includes('text/csv'));
  check('CSV export round-trips specials', text.startsWith('key,value\r\n') && text.includes('"He said ""hi"", loudly"') && text.includes('"line1\nline2"'), JSON.stringify(text.slice(0, 80)));

  // Import into he without header
  const impHe = await call(`${P}/import/he`, { token: at, method: 'POST', body: { csv: 'app.title,האפליקציה\nmsg.quote,ציטוט\n' } });
  check('headerless CSV import works', impHe.status === 201 && impHe.json.translationsUpserted === 2, JSON.stringify(impHe.json));

  const heText = await (await fetch(`${API}${P}/export/he/csv`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('CSV export he has unicode values', heText.includes('app.title,האפליקציה'), heText.slice(0, 60));

  const threeCol = await call(`${P}/import/en`, { token: at, method: 'POST', body: { csv: 'a,b,c\n' } });
  check('3-column row rejected (400)', threeCol.status === 400, String(threeCol.status));

  const cross = await fetch(`${API}${P}/export/en/csv`, { headers: { Authorization: `Bearer ${bt}` } });
  const crossImp = await call(`${P}/import/en`, { token: bt, method: 'POST', body: { csv: 'x,y\n' } });
  check('cross-team CSV export/import denied', cross.status === 404 && crossImp.status === 404, `${cross.status}/${crossImp.status}`);

  // Formula-injection: default export shields, raw mode preserves, import is verbatim
  await call(`${P}/import/en`, { token: at, method: 'POST', body: { entries: { 'evil.formula': '=HYPERLINK("http://x")', 'evil.padded': '  =SPACE()' } } });
  const paddedSafe = await (await fetch(`${API}${P}/export/en/csv`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('leading whitespace before formula char is shielded', paddedSafe.includes("'  =SPACE()"), paddedSafe.split('\n').find((l) => l.includes('padded')) ?? '');
  const safeText = await (await fetch(`${API}${P}/export/en/csv`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('default CSV export shields formula values', safeText.includes("'=HYPERLINK"), safeText.split('\n').find((l) => l.includes('evil')) ?? '');
  const rawText = await (await fetch(`${API}${P}/export/en/csv?mode=raw`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('raw mode preserves formula values losslessly', rawText.includes('evil.formula,"=HYPERLINK') && !rawText.includes("'=HYPERLINK"), rawText.split('\n').find((l) => l.includes('evil')) ?? '');
  await call(`${P}/import/en`, { token: at, method: 'POST', body: { csv: rawText } });
  const roundtrip = await (await fetch(`${API}${P}/export/en/csv?mode=raw`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('raw export-import roundtrip is lossless', roundtrip === rawText);

  // Android XML round-trip + rejection
  const xmlIn = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<resources>',
    '  <string name="app.title">Rocks &amp; Co</string>',
    '  <string name="msg.quote">say &quot;hi&quot;\nnext</string>',
    '</resources>',
  ].join('\n') + '\n';
  const impXml = await call(`${P}/import/he`, { token: at, method: 'POST', body: { xml: xmlIn } });
  check('Android XML import accepted', impXml.status === 201 && impXml.json.translationsUpserted === 2, JSON.stringify(impXml.json));
  const xmlOut = await (await fetch(`${API}${P}/export/he/android`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('Android XML export has entities + escapes', xmlOut.includes('<string name="app.title">Rocks &amp; Co</string>') && xmlOut.includes("say \\\"hi\\\"\\nnext"), xmlOut.split("\n").find((l) => l.includes("msg.quote")) ?? "");
  const xmlRound = await call(`${P}/import/he`, { token: at, method: 'POST', body: { xml: xmlOut } });
  check('Android export-import roundtrip stable', xmlRound.status === 201 && xmlRound.json.unchangedSkipped >= 2, JSON.stringify(xmlRound.json));
  const nested = await call(`${P}/import/he`, { token: at, method: 'POST', body: { xml: '<resources><string name="x">a <b>bold</b></string></resources>' } });
  check('nested markup rejected (400)', nested.status === 400, String(nested.status));
  // Atomicity: a mixed import (one valid <string> plus an unsupported <plurals>)
  // must 400 and leave keys, translations and history exactly as before.
  const before = await (await fetch(`${API}${P}/export/he`, { headers: { Authorization: `Bearer ${at}` } })).json();
  const mixed = await call(`${P}/import/he`, { token: at, method: 'POST', body: { xml: '<resources><string name="mixed.new">should not land</string><plurals name="cats"><item quantity="one">one</item></plurals></resources>' } });
  const after = await (await fetch(`${API}${P}/export/he`, { headers: { Authorization: `Bearer ${at}` } })).json();
  check('mixed valid+unsupported import rejected (400)', mixed.status === 400, String(mixed.status));
  check('rejected mixed import leaves all keys unchanged', JSON.stringify(before) === JSON.stringify(after) && after['mixed.new'] === undefined, JSON.stringify(after).slice(0, 120));
  // Direct write evidence: activity feed count must not move across a rejected import.
  const actCount = async () => (await call(`${P}/activity`, { token: at })).json.items.length;
  const actBefore = await actCount();
  await call(`${P}/import/he`, { token: at, method: 'POST', body: { xml: '<resources><string name="mixed.two">nope</string><string-array name="a"><item>x</item></string-array></resources>' } });
  const actAfter = await actCount();
  check('rejected mixed import writes no history/activity', typeof actBefore === 'number' && actAfter === actBefore, `${actBefore} -> ${actAfter}`);
  // Direct translation-history evidence on the seeded key: a rejected import must
  // not append history rows (activity count alone would not prove this).
  const histCount = async () => {
    const keys = (await call(`${P}/keys`, { token: at })).json;
    const k = keys.find((x) => x.name === 'app.title');
    return (await call(`${P}/keys/${k.id}/translations/he/history`, { token: at })).json.length;
  };
  const histBefore = await histCount();
  await call(`${P}/import/he`, { token: at, method: 'POST', body: { xml: '<resources><plurals name="cats"><item quantity="one">one</item></plurals></resources>' } });
  const histAfter = await histCount();
  check('rejected import writes no translation-history rows', typeof histBefore === 'number' && histAfter === histBefore, `${histBefore} -> ${histAfter}`);

  // iOS .strings round-trip + rejection
  const iosIn = '"app.title" = "האפליקציה";\n"msg.esc" = "line1\\nline2";\n';
  const impIos = await call(`${P}/import/he`, { token: at, method: 'POST', body: { strings: iosIn } });
  check('iOS strings import accepted', impIos.status === 201, JSON.stringify(impIos.json));
  const iosOut = await (await fetch(`${API}${P}/export/he/ios`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('iOS export format', iosOut.includes('"app.title" = "האפליקציה";'), iosOut.split('\n')[0] ?? '');
  const badLine = await call(`${P}/import/he`, { token: at, method: 'POST', body: { strings: 'not an entry\n' } });
  check('malformed strings line rejected (400)', badLine.status === 400, String(badLine.status));
  const crossXml = await fetch(`${API}${P}/export/he/android`, { headers: { Authorization: `Bearer ${bt}` } });
  check('cross-team android export denied (404)', crossXml.status === 404, String(crossXml.status));

  // PO (gettext) round-trip + rejection
  const poIn = [
    '# fixture comment',
    'msgid "po.title"',
    'msgstr "My \\"App\\""',
    '',
    'msgid "po.multi"',
    'msgstr "line1\\nline2"',
    '',
    '#~ msgid "po.obsolete"',
    '#~ msgstr "old"',
    '',
  ].join('\n');
  const impPo = await call(`${P}/import/he`, { token: at, method: 'POST', body: { po: poIn } });
  check('PO import accepted (obsolete skipped)', impPo.status === 201 && impPo.json.translationsUpserted === 2, JSON.stringify(impPo.json));
  const poRes = await fetch(`${API}${P}/export/he/po`, { headers: { Authorization: `Bearer ${at}` } });
  const poOut = await poRes.text();
  check('PO export content-type', (poRes.headers.get('content-type') || '').includes('text/plain'));
  check('PO export has escaped entries', poOut.includes('msgid "po.title"\nmsgstr "My \\"App\\""') && poOut.includes('msgstr "line1\\nline2"'), poOut.split('\n').find((l) => l.includes('po.title')) ?? '');
  const poRound = await call(`${P}/import/he`, { token: at, method: 'POST', body: { po: poOut } });
  check('PO export-import roundtrip stable', poRound.status === 201 && poRound.json.unchangedSkipped >= 2, JSON.stringify(poRound.json));
  const poPlural = await call(`${P}/import/he`, { token: at, method: 'POST', body: { po: 'msgid "apple"\nmsgid_plural "apples"\nmsgstr[0] "%d"\nmsgstr[1] "%d"\n' } });
  check('PO plural entry rejected (400)', poPlural.status === 400, String(poPlural.status));
  const poBefore = await (await fetch(`${API}${P}/export/he`, { headers: { Authorization: `Bearer ${at}` } })).json();
  const poMixed = await call(`${P}/import/he`, { token: at, method: 'POST', body: { po: 'msgid "po.mixed"\nmsgstr "should not land"\n\nmsgctxt "button"\nmsgid "po.ctx"\nmsgstr "Save"\n' } });
  const poAfter = await (await fetch(`${API}${P}/export/he`, { headers: { Authorization: `Bearer ${at}` } })).json();
  check('PO mixed valid+context import rejected (400) and leaves keys unchanged', poMixed.status === 400 && JSON.stringify(poBefore) === JSON.stringify(poAfter) && poAfter['po.mixed'] === undefined, String(poMixed.status));

  // PO respects the shared boundaries - branch scoping, locale write
  // grants, task key locks - enforced inside importJson/exportJson and
  // exercised here through the PO path itself.
  await call(`${P}/branches`, { token: at, method: 'POST', body: { name: 'po-branch' } });
  const impBr = await call(`${P}/import/en?branch=po-branch`, { token: at, method: 'POST', body: { po: 'msgid "po.branchonly"\nmsgstr "branch value"\n' } });
  check('PO import scopes to the named branch', impBr.status === 201, JSON.stringify(impBr.json));
  const mainAfterBr = await (await fetch(`${API}${P}/export/en?flat=true`, { headers: { Authorization: `Bearer ${at}` } })).json();
  const brAfterBr = await (await fetch(`${API}${P}/export/en?flat=true&branch=po-branch`, { headers: { Authorization: `Bearer ${at}` } })).json();
  check('PO branch import invisible on main, present on the branch', mainAfterBr['po.branchonly'] === undefined && brAfterBr['po.branchonly'] === 'branch value');
  const brPoOut = await (await fetch(`${API}${P}/export/en/po?branch=po-branch`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('PO export reads the named branch', brPoOut.includes('msgid "po.branchonly"'));

  const c = (await call('/auth/signup', { method: 'POST', body: { email: 'c@fmt.io', password: 'password-c', displayName: 'He Only' } })).json;
  const ct = c.accessToken;
  await call(`${P}/members`, { token: at, method: 'POST', body: { email: 'c@fmt.io', role: 'MEMBER', allowedLocales: ['he'] } });
  const cEn = await call(`${P}/import/en`, { token: ct, method: 'POST', body: { po: 'msgid "po.denied"\nmsgstr "x"\n' } });
  check('PO import outside the member locale grant denied (403)', cEn.status === 403, String(cEn.status));
  const cHe = await call(`${P}/import/he`, { token: ct, method: 'POST', body: { po: 'msgid "po.memberok"\nmsgstr "allowed"\n' } });
  check('PO import inside the member locale grant accepted', cHe.status === 201, String(cHe.status));
  const cExport = await fetch(`${API}${P}/export/en/po`, { headers: { Authorization: `Bearer ${ct}` } });
  check('PO export not narrowed by locale write grants', cExport.status === 200, String(cExport.status));

  // Lock po.title through a task; a PO import by a non-admin non-assignee
  // skips the locked key (reported in the run) while an unlocked key lands.
  const keysForLock = (await call(`${P}/keys`, { token: at })).json;
  const lockKey = keysForLock.find((k) => k.name === 'po.title');
  await call(`${P}/tasks`, { token: at, method: 'POST', body: { title: 'Lock po.title', lockKeys: true, keyIds: [lockKey.id] } });
  const lockImp = await call(`${P}/import/he`, { token: ct, method: 'POST', body: { po: 'msgid "po.title"\nmsgstr "changed under lock"\n\nmsgid "po.unlocked"\nmsgstr "lands"\n' } });
  check('PO import skips the locked key and reports it', lockImp.status === 201 && lockImp.json.failed === 1 && lockImp.json.translationsUpserted === 1, JSON.stringify(lockImp.json));
  const heAfterLock = await (await fetch(`${API}${P}/export/he?flat=true`, { headers: { Authorization: `Bearer ${at}` } })).json();
  check('locked key keeps its value, unlocked key imported', heAfterLock['po.title'] === 'My "App"' && heAfterLock['po.unlocked'] === 'lands', JSON.stringify({ title: heAfterLock['po.title'], unlocked: heAfterLock['po.unlocked'] }));

  // XLIFF 1.2 round-trip, rejection and the shared boundaries.
  const xliffIn = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">',
    '  <file source-language="en" target-language="he" datatype="plaintext" original="open-locale">',
    '    <body>',
    '      <trans-unit id="xliff.title">',
    '        <source>My "App"</source>',
    '        <target>My &quot;App&quot; ✓</target>',
    '      </trans-unit>',
    '      <trans-unit id="xliff.chars">',
    '        <source>chars</source>',
    '        <target>A &amp; B &lt;C&gt;</target>',
    '      </trans-unit>',
    '      <trans-unit id="xliff.multi">',
    '        <source>line1 line2</source>',
    '        <target>line1',
    'line2</target>',
    '      </trans-unit>',
    '      <trans-unit id="xliff.untranslated">',
    '        <source>only source</source>',
    '      </trans-unit>',
    '    </body>',
    '  </file>',
    '</xliff>',
  ].join('\n');
  const impXl = await call(`${P}/import/he`, { token: at, method: 'POST', body: { xliff: xliffIn } });
  check('XLIFF import accepted (untranslated unit skipped, not wiped)', impXl.status === 201 && impXl.json.translationsUpserted === 3 && impXl.json.untranslatedSkipped === 1, JSON.stringify(impXl.json));
  const xlRes = await fetch(`${API}${P}/export/he/xliff`, { headers: { Authorization: `Bearer ${at}` } });
  const xlOut = await xlRes.text();
  check('XLIFF export content-type', (xlRes.headers.get('content-type') || '').includes('x-xliff+xml'), xlRes.headers.get('content-type') ?? '');
  check('XLIFF export has languages and correct escaping', xlOut.includes('source-language="en"') && xlOut.includes('target-language="he"') && xlOut.includes('<target>My "App" ✓</target>') && xlOut.includes('<target>A &amp; B &lt;C&gt;</target>') && xlOut.includes('<target>line1\nline2</target>'), xlOut.split('\n').find((l) => l.includes('xliff.chars')) ?? '');
  const xlRound = await call(`${P}/import/he`, { token: at, method: 'POST', body: { xliff: xlOut } });
  check('XLIFF export-import roundtrip stable', xlRound.status === 201 && xlRound.json.unchangedSkipped >= 3, JSON.stringify(xlRound.json));
  const xlBefore = await (await fetch(`${API}${P}/export/he`, { headers: { Authorization: `Bearer ${at}` } })).json();
  const xlGroup = await call(`${P}/import/he`, { token: at, method: 'POST', body: { xliff: '<xliff version="1.2"><file><body><group id="g"><trans-unit id="xliff.grouped"><source>s</source><target>should not land</target></trans-unit></group></body></file></xliff>' } });
  const xlAfterGroup = await (await fetch(`${API}${P}/export/he`, { headers: { Authorization: `Bearer ${at}` } })).json();
  check('XLIFF group nesting rejected (400) and leaves keys unchanged', xlGroup.status === 400 && JSON.stringify(xlBefore) === JSON.stringify(xlAfterGroup) && xlAfterGroup['xliff.grouped'] === undefined, String(xlGroup.status));
  const xlMarkup = await call(`${P}/import/he`, { token: at, method: 'POST', body: { xliff: '<xliff version="1.2"><file><body><trans-unit id="xliff.markup"><source>a<g id="1">bad</g></source><target>x</target></trans-unit></body></file></xliff>' } });
  check('XLIFF inline markup rejected (400)', xlMarkup.status === 400, String(xlMarkup.status));

  await call(`${P}/branches`, { token: at, method: 'POST', body: { name: 'xliff-branch' } });
  const impXlBr = await call(`${P}/import/en?branch=xliff-branch`, { token: at, method: 'POST', body: { xliff: '<xliff version="1.2"><file><body><trans-unit id="xliff.branchonly"><source>s</source><target>branch value</target></trans-unit></body></file></xliff>' } });
  check('XLIFF import scopes to the named branch', impXlBr.status === 201, JSON.stringify(impXlBr.json));
  const mainAfterXlBr = await (await fetch(`${API}${P}/export/en?flat=true`, { headers: { Authorization: `Bearer ${at}` } })).json();
  const brAfterXlBr = await (await fetch(`${API}${P}/export/en?flat=true&branch=xliff-branch`, { headers: { Authorization: `Bearer ${at}` } })).json();
  check('XLIFF branch import invisible on main, present on the branch', mainAfterXlBr['xliff.branchonly'] === undefined && brAfterXlBr['xliff.branchonly'] === 'branch value');
  const brXlOut = await (await fetch(`${API}${P}/export/en/xliff?branch=xliff-branch`, { headers: { Authorization: `Bearer ${at}` } })).text();
  check('XLIFF export reads the named branch', brXlOut.includes('id="xliff.branchonly"'));

  const cXlEn = await call(`${P}/import/en`, { token: ct, method: 'POST', body: { xliff: '<xliff version="1.2"><file><body><trans-unit id="xliff.denied"><source>s</source><target>x</target></trans-unit></body></file></xliff>' } });
  check('XLIFF import outside the member locale grant denied (403)', cXlEn.status === 403, String(cXlEn.status));
  const cXlHe = await call(`${P}/import/he`, { token: ct, method: 'POST', body: { xliff: '<xliff version="1.2"><file><body><trans-unit id="xliff.memberok"><source>s</source><target>allowed</target></trans-unit></body></file></xliff>' } });
  check('XLIFF import inside the member locale grant accepted', cXlHe.status === 201, String(cXlHe.status));
  const cXlExport = await fetch(`${API}${P}/export/en/xliff`, { headers: { Authorization: `Bearer ${ct}` } });
  check('XLIFF export not narrowed by locale write grants', cXlExport.status === 200, String(cXlExport.status));

  const keysForXlLock = (await call(`${P}/keys`, { token: at })).json;
  const lockXlKey = keysForXlLock.find((k) => k.name === 'xliff.title');
  await call(`${P}/tasks`, { token: at, method: 'POST', body: { title: 'Lock xliff.title', lockKeys: true, keyIds: [lockXlKey.id] } });
  const xlLockImp = await call(`${P}/import/he`, { token: ct, method: 'POST', body: { xliff: '<xliff version="1.2"><file><body><trans-unit id="xliff.title"><source>s</source><target>changed under lock</target></trans-unit><trans-unit id="xliff.unlocked"><source>s</source><target>lands</target></trans-unit></body></file></xliff>' } });
  check('XLIFF import skips the locked key and reports it', xlLockImp.status === 201 && xlLockImp.json.failed === 1 && xlLockImp.json.translationsUpserted === 1, JSON.stringify(xlLockImp.json));
  const heAfterXlLock = await (await fetch(`${API}${P}/export/he?flat=true`, { headers: { Authorization: `Bearer ${at}` } })).json();
  check('XLIFF locked key keeps its value, unlocked key imported', heAfterXlLock['xliff.title'] === 'My "App" ✓' && heAfterXlLock['xliff.unlocked'] === 'lands', JSON.stringify({ title: heAfterXlLock['xliff.title'], unlocked: heAfterXlLock['xliff.unlocked'] }));

  const runs = (await call(`${P}/imports`, { token: at })).json;
  check('CSV imports recorded as import runs', Array.isArray(runs) ? runs.length >= 2 : (runs.items?.length ?? 0) >= 2, JSON.stringify(runs).slice(0, 120));

} finally {
  api?.kill('SIGTERM');
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log('All CSV format checks passed');
