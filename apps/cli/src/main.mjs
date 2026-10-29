#!/usr/bin/env node
// Open-locale CLI. Zero-dependency (node >=20): talks to the REST API v1 with
// an X-Api-Key token. Config lives in ./open-locale.json or env vars so the
// token never appears in shell history unless the user chooses env.
//
//   open-locale push <file> --locale he          upload translations (atomic import; --dry-run previews)
//   open-locale push <file.zip>                  import a store-only bundle (one entry per locale)
//   open-locale pull --locale he [--format f] [-o file]   json|csv|android|ios|po|xliff|properties|arb|yaml|resx
//   open-locale pull --all [--format f] -o <file.zip>     export every locale as one store-only zip
//   open-locale keys [--search term]             list keys; every command accepts --branch <name>
//   open-locale imports [--limit N]              audit recent import runs
//
// Config: OPENLOCALE_URL (default http://localhost:3000), OPENLOCALE_TOKEN,
// OPENLOCALE_PROJECT; or { "url", "token", "project" } in open-locale.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const fail = (msg, code = 1) => { console.error(`error: ${msg}`); process.exit(code); };
const branchQuery = () => { const b = opt('branch'); return b ? `?branch=${encodeURIComponent(b)}` : ''; };
// Server- and archive-supplied strings can carry control characters; render
// them as visible escapes instead of letting them forge lines or drive the
// terminal. Never applied to export payloads, only to status/audit lines.
const vis = (v) => String(v).replace(/[\u0000-\u001f\u007f-\u009f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
const queryString = (extra = {}) => {
  const params = new URLSearchParams();
  const b = opt('branch');
  if (b) params.set('branch', b);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, dflt) => {
  for (const flag of name.length === 1 ? [`--${name}`, `-${name}`] : [`--${name}`]) {
    const i = args.indexOf(flag);
    if (i >= 0) return args[i + 1];
  }
  return dflt;
};

function config() {
  let file = {};
  if (existsSync('open-locale.json')) {
    try { file = JSON.parse(readFileSync('open-locale.json', 'utf8')); }
    catch { fail('open-locale.json is not valid JSON'); }
  }
  const url = process.env.OPENLOCALE_URL ?? file.url ?? 'http://localhost:3000';
  const token = process.env.OPENLOCALE_TOKEN ?? file.token;
  const project = process.env.OPENLOCALE_PROJECT ?? file.project;
  if (!token) fail('no API token: set OPENLOCALE_TOKEN or "token" in open-locale.json (create one under project settings)');
  if (!project) fail('no project id: set OPENLOCALE_PROJECT or "project" in open-locale.json');
  return { url: url.replace(/\/$/, ''), token, project };
}

async function api(path, { method = 'GET', body, raw = false, zip = false } = {}) {
  const { url, token } = config();
  const res = await fetch(`${url}/api${path}`, {
    method,
    headers: { 'Content-Type': zip ? 'application/zip' : 'application/json', 'X-Api-Key': token },
    body: zip ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) fail('authentication failed (401): check the API token');
  if (res.status === 403) fail('not permitted (403): the token lacks the needed scope or role');
  if (raw) return res;
  const json = await res.json().catch(() => null);
  if (!res.ok) fail(`API ${method} ${path} -> ${res.status}: ${json?.message ?? 'unknown error'}`);
  return json;
}

const FORMATS = new Set(['json', 'csv', 'android', 'ios', 'po', 'xliff', 'properties', 'arb', 'yaml', 'resx']);
const PUSH_EXTS = [['.xml', 'xml'], ['.strings', 'strings'], ['.csv', 'csv'], ['.po', 'po'], ['.xlf', 'xliff'], ['.xliff', 'xliff'], ['.properties', 'properties'], ['.arb', 'arb'], ['.yaml', 'yaml'], ['.yml', 'yaml'], ['.resx', 'resx']];

async function push() {
  const file = args[1];
  const locale = opt('locale');
  if (!file || !existsSync(file)) fail('push needs an existing file: open-locale push <file> --locale he');
  const { project } = config();
  const bq = branchQuery();
  // A .zip file is a bundle import: one entry per locale, no --locale.
  if (file.toLowerCase().endsWith('.zip')) {
    if (locale) fail('bundle push imports every locale in the archive; drop --locale');
    const format = opt('format', 'json');
    if (!FORMATS.has(format)) fail(`unknown format ${format} (${[...FORMATS].join('|')})`);
    if (args.includes('--dry-run')) fail('dry-run is not supported for bundle push: the bundle import API has no preview mode');
    console.error('note: bundle import accepts store-only zips from `pull --all` (compressed zips are rejected); each locale imports independently - skipped entries and failed locales are reported, not rolled back.');
    const result = await api(`/projects/${project}/import-bundle/${format}${bq}`, { method: 'POST', body: readFileSync(file), zip: true });
    for (const r of result.imported) console.log(`${r.locale}: ${r.translationsUpserted} upserted, ${r.keysCreated} key(s) created, ${r.unchangedSkipped} unchanged, ${r.failed} failed`);
    for (const x of result.skipped) console.error(`skipped entry ${vis(x.name)} (not imported; exit stays 0 for skips alone): ${vis(x.reason)}`);
    for (const x of result.failedLocales) console.error(`${vis(x.locale)} failed (${x.status}): ${vis(x.error)}`);
    if (result.failedLocales.length > 0 || result.imported.some((r) => r.failed > 0)) process.exit(1);
    return;
  }
  if (!locale) fail('push needs --locale <code>');
  const text = readFileSync(file, 'utf8');
  const lower = file.toLowerCase();
  const hit = PUSH_EXTS.find(([ext]) => lower.endsWith(ext));
  const ext = hit ? hit[1] : 'json';
  const body = ext === 'json' ? { entries: JSON.parse(text) } : { [ext]: text };
  const dryRun = args.includes('--dry-run');
  const result = await api(`/projects/${project}/import/${locale}${queryString(dryRun ? { dryRun: 'true' } : {})}`, { method: 'POST', body });
  if (dryRun) {
    console.log(`dry run ${result.status}: ${result.translationsUpserted} upserted, ${result.keysCreated} key(s) created, ` +
      `${result.unchangedSkipped} unchanged, ${result.failed} failed (preview only - nothing written; counts are a point-in-time snapshot)`);
    for (const f of result.failures ?? []) console.error(`would fail: ${vis(f)}`);
    if (result.status === 'FAILED') process.exit(1);
    return;
  }
  console.log(`import ${result.status}: ${result.translationsUpserted} upserted, ${result.keysCreated} key(s) created, ` +
    `${result.unchangedSkipped} unchanged, ${result.failed} failed (run ${result.importId})`);
  if (result.status === 'FAILED') process.exit(1);
  if (result.error) console.error(`warning: ${result.error}`);
}

async function pull() {
  const locale = opt('locale');
  const format = opt('format', 'json');
  const out = opt('o');
  const all = args.includes('--all');
  if (!FORMATS.has(format)) fail(`unknown format ${format} (${[...FORMATS].join('|')})`);
  const { project } = config();
  if (all) {
    if (locale) fail('pull --all exports every locale into one zip; drop --locale');
    if (!out) fail('pull --all needs -o <file.zip> (binary output)');
    const res = await api(`/projects/${project}/export-bundle/${format}${branchQuery()}`, { raw: true });
    if (!res.ok) fail(`export-bundle -> ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(out, buf);
    console.log(`wrote ${out} (${buf.length} bytes, all locales, ${format}, store-only zip)`);
    return;
  }
  if (!locale) fail('pull needs --locale <code> (or --all for a bundle zip)');
  const suffix = format === 'json' ? '' : `/${format}`;
  const res = await api(`/projects/${project}/export/${locale}${suffix}${branchQuery()}`, { raw: true });
  if (!res.ok) fail(`export -> ${res.status}`);
  const text = await res.text();
  if (out) { writeFileSync(out, text); console.log(`wrote ${out} (${locale}, ${format})`); }
  else process.stdout.write(text);
}

async function keys() {
  const search = opt('search');
  const { project } = config();
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const br = opt('branch');
  if (br) params.set('branch', br);
  const ps = params.toString();
  const q = ps ? `?${ps}` : '';
  const list = await api(`/projects/${project}/keys${q}`);
  for (const k of list) console.log(`${vis(k.name)}${k.description ? `\t${vis(k.description)}` : ''}`);
  console.error(`${list.length} key(s)`);
}

async function imports() {
  if (opt('branch')) fail('import runs are not branch-scoped; drop --branch');
  const { project } = config();
  const limit = Number(opt('limit', '50'));
  if (!Number.isInteger(limit) || limit < 1) fail('--limit must be a positive integer');
  const runs = await api(`/projects/${project}/imports`);
  for (const r of runs.slice(0, limit)) {
    // actorId is set for JWT and token imports alike; null means the actor
    // user row no longer exists (SetNull on delete), never "token origin".
    console.log(`${vis(r.createdAt)}  ${vis(r.localeCode)}  ${vis(r.status)}  ${r.translationsUpserted} upserted, ${r.keysCreated} key(s) created, ` +
      `${r.unchangedSkipped} unchanged, ${r.failed} failed  ${vis(r.actor?.email ?? 'unknown actor')}  ${r.id}${r.error ? `  - ${vis(r.error)}` : ''}`);
  }
  console.error(`${Math.min(limit, runs.length)} of ${runs.length} import run(s) (newest first)`);
}

const usage = `open-locale <command>
  push <file> --locale <code>            import a translations file (json/xml/strings/csv/po/xlf/properties/arb/yaml/resx)
  push <file> --locale <c> --dry-run     preview counts without writing (not available for bundle zip)
  push <file.zip> [--format f]           import a bundle zip: STORE-ONLY, as written by pull --all
                                         (compressed zips are rejected before any write; each locale
                                         imports independently, no rollback across locales)
  pull --locale <code> [--format f] [-o file]   export translations (json|csv|android|ios|po|xliff|properties|arb|yaml|resx)
  pull --all [--format f] -o <file.zip>  export every locale as one store-only zip
  keys [--search term]                   list keys
  imports [--limit N]                    list recent import runs (newest first, API caps at 50)
  docs                                   print the OpenAPI docs URL
options: push/pull/keys accept [--branch name] to scope the read or write to a
  branch (default: main); imports are not branch-scoped
exit codes: 0 = success (bundle entries with no matching locale are skipped and listed
  on stderr; skips alone keep exit 0); 1 = any failed key or locale, details on stderr`;
if (!cmd || cmd === 'help' || cmd === '--help') { console.log(usage); process.exit(cmd ? 0 : 1); }
if (cmd === 'docs') { const { url } = config(); console.log(`${url}/api/openapi.json`); process.exit(0); }
if (cmd === 'push') await push();
else if (cmd === 'pull') await pull();
else if (cmd === 'keys') await keys();
else if (cmd === 'imports') await imports();
else fail(`unknown command: ${cmd}\n${usage}`);
