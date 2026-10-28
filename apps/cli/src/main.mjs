#!/usr/bin/env node
// Open-locale CLI. Zero-dependency (node >=20): talks to the REST API v1 with
// an X-Api-Key token. Config lives in ./open-locale.json or env vars so the
// token never appears in shell history unless the user chooses env.
//
//   open-locale push <file> --locale he          upload translations (atomic import)
//   open-locale pull --locale he [--format json|csv|android|ios] [-o file]
//   open-locale keys [--search term]             list keys
//
// Config: OPENLOCALE_URL (default http://localhost:3000), OPENLOCALE_TOKEN,
// OPENLOCALE_PROJECT; or { "url", "token", "project" } in open-locale.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const fail = (msg, code = 1) => { console.error(`error: ${msg}`); process.exit(code); };
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

async function api(path, { method = 'GET', body, raw = false } = {}) {
  const { url, token } = config();
  const res = await fetch(`${url}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) fail('authentication failed (401): check the API token');
  if (res.status === 403) fail('not permitted (403): the token lacks the needed scope or role');
  if (raw) return res;
  const json = await res.json().catch(() => null);
  if (!res.ok) fail(`API ${method} ${path} -> ${res.status}: ${json?.message ?? 'unknown error'}`);
  return json;
}

const FORMATS = new Set(['json', 'csv', 'android', 'ios']);

async function push() {
  const file = args[1];
  const locale = opt('locale');
  if (!file || !existsSync(file)) fail('push needs an existing file: open-locale push <file> --locale he');
  if (!locale) fail('push needs --locale <code>');
  const { project } = config();
  const text = readFileSync(file, 'utf8');
  const ext = file.toLowerCase().endsWith('.xml') ? 'xml'
    : file.toLowerCase().endsWith('.strings') ? 'strings'
    : file.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
  const body = ext === 'json' ? { entries: JSON.parse(text) } : ext === 'xml' ? { xml: text }
    : ext === 'strings' ? { strings: text } : { csv: text };
  const result = await api(`/projects/${project}/import/${locale}`, { method: 'POST', body });
  console.log(`import ${result.status}: ${result.translationsUpserted} upserted, ${result.keysCreated} key(s) created, ` +
    `${result.unchangedSkipped} unchanged, ${result.failed} failed (run ${result.importId})`);
  if (result.status === 'FAILED') process.exit(1);
  if (result.error) console.error(`warning: ${result.error}`);
}

async function pull() {
  const locale = opt('locale');
  const format = opt('format', 'json');
  const out = opt('o');
  if (!locale) fail('pull needs --locale <code>');
  if (!FORMATS.has(format)) fail(`unknown format ${format} (json|csv|android|ios)`);
  const { project } = config();
  const suffix = format === 'json' ? '' : `/${format}`;
  const res = await api(`/projects/${project}/export/${locale}${suffix}`, { raw: true });
  if (!res.ok) fail(`export -> ${res.status}`);
  const text = await res.text();
  if (out) { writeFileSync(out, text); console.log(`wrote ${out} (${locale}, ${format})`); }
  else process.stdout.write(text);
}

async function keys() {
  const search = opt('search');
  const { project } = config();
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  const list = await api(`/projects/${project}/keys${q}`);
  for (const k of list) console.log(`${k.name}${k.description ? `\t${k.description}` : ''}`);
  console.error(`${list.length} key(s)`);
}

const usage = `open-locale <command>
  push <file> --locale <code>            import a translations file (json/xml/strings/csv)
  pull --locale <code> [--format f] [-o file]   export translations (json|csv|android|ios)
  keys [--search term]                   list keys
  docs                                   print the OpenAPI docs URL`;
if (!cmd || cmd === 'help' || cmd === '--help') { console.log(usage); process.exit(cmd ? 0 : 1); }
if (cmd === 'docs') { const { url } = config(); console.log(`${url}/api/openapi.json`); process.exit(0); }
if (cmd === 'push') await push();
else if (cmd === 'pull') await pull();
else if (cmd === 'keys') await keys();
else fail(`unknown command: ${cmd}\n${usage}`);
