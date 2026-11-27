// Fast SDK URL contract: exact fetch-facing paths, no provider or database.
import assert from 'node:assert/strict';
import { createClient, OpenLocaleError } from '../libs/sdk/src/index.mjs';
let request, count = 0;
const client = createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async (url, options) => {
  request = { url: new URL(url), options }; count++;
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
} });
const value = 'literal/segment?branch=other#fragment%2e';
const encoded = encodeURIComponent(value);
const cases = [
  ['project get', x => client.projects.get(x), `/api/projects/${encoded}`],
  ['key list', x => client.keys.list(x), `/api/projects/${encoded}/keys`],
  ['key create', x => client.keys.create(x, 'name'), `/api/projects/${encoded}/keys`],
  ['translation get project', x => client.translations.get(x, 'en'), `/api/projects/${encoded}/export/en`],
  ['translation get locale', x => client.translations.get('project', x), `/api/projects/project/export/${encoded}`],
  ['translation put project', x => client.translations.put(x, 'key', 'en', 'text'), `/api/projects/${encoded}/keys/key/translations`],
  ['translation put key', x => client.translations.put('project', x, 'en', 'text'), `/api/projects/project/keys/${encoded}/translations`],
  ['OTA latest project', x => client.ota.latest(x, 'en'), `/api/projects/${encoded}/ota/latest`],
  ['OTA version project', x => client.ota.version(x, 1, 'en'), `/api/projects/${encoded}/ota/1/en`],
  ['OTA version number', x => client.ota.version('project', x, 'en'), `/api/projects/project/ota/${encoded}/en`],
  ['OTA version locale', x => client.ota.version('project', 1, x), `/api/projects/project/ota/1/${encoded}`],
  ['import project', x => client.io.importEntries(x, 'en', {}), `/api/projects/${encoded}/import/en`],
  ['import locale', x => client.io.importEntries('project', x, {}), `/api/projects/project/import/${encoded}`],
  ['export project', x => client.io.exportText(x, 'en', 'po'), `/api/projects/${encoded}/export/en/po`],
  ['export locale', x => client.io.exportText('project', x, 'po'), `/api/projects/project/export/${encoded}/po`],
  ['export format', x => client.io.exportText('project', 'en', x), `/api/projects/project/export/en/${encoded}`],
];
let passed = 0;
for (const [name, run, path] of cases) {
  const before = count;
  // OTA mock200 intentionally lacks digest. URL construction is still observable.
  if (name.startsWith('OTA ')) {
    await assert.rejects(async () => run(value), error => error instanceof OpenLocaleError && /integrity digest/.test(error.message));
  } else {
    await run(value);
  }
  assert.equal(count, before + 1);
  assert.equal(request.url.pathname, path);
  assert.equal(request.url.hash, '');
  assert.equal(request.url.searchParams.get('branch'), null);
  assert.equal(request.options.headers['X-Api-Key'], 'test-only');
  console.log(`PASS encoded ${name}`); passed++;
  for (const dot of ['', '.', '..']) {
    const prior = count;
    await assert.rejects(async () => run(dot), error => error instanceof OpenLocaleError && error.status === 0);
    assert.equal(count, prior);
    console.log(`PASS invalid component ${name} ${dot || '(empty)'}`); passed++;
  }
}
const queryValue = 'branch&dryRun=false#fragment+percent%';
for (const [name, run, expected] of [
  ['key search and branch', () => client.keys.list('project', { branch: queryValue, search: queryValue }), { branch: queryValue, search: queryValue }],
  ['key create branch', () => client.keys.create('project', 'literal', { branch: queryValue }), { branch: queryValue }],
  ['translation read branch', () => client.translations.get('project', 'en', { branch: queryValue }), { branch: queryValue, flat: 'true' }],
  ['translation write branch', () => client.translations.put('project', 'key', 'en', 'literal', { branch: queryValue }), { branch: queryValue }],
  ['OTA latest query', () => client.ota.latest('project', queryValue, { branch: queryValue, publicationId: queryValue }), { branch: queryValue, locale: queryValue, publicationId: queryValue }],
  ['OTA version query', () => client.ota.version('project', 1, 'en', { branch: queryValue, publicationId: queryValue }), { branch: queryValue, publicationId: queryValue }],
  ['OTA empty pin', () => client.ota.latest('project', 'en', { publicationId: '' }), { locale: 'en', publicationId: '' }],
  ['import dryRun branch', () => client.io.importEntries('project', 'en', {}, { branch: queryValue, dryRun: true }), { branch: queryValue, dryRun: 'true' }],
  ['export branch', () => client.io.exportText('project', 'en', 'po', { branch: queryValue }), { branch: queryValue }],
]) {
  if (name.startsWith('OTA ')) await assert.rejects(run, error => error instanceof OpenLocaleError && /integrity digest/.test(error.message));
  else await run();
  assert.deepEqual([...request.url.searchParams], Object.entries(expected));
  assert.equal(request.url.hash, '');
  console.log(`PASS literal query ${name}`); passed++;
}
await client.request('/caller-controlled?literal=yes');
assert.equal(request.url.pathname, '/api/caller-controlled');
assert.equal(request.url.searchParams.get('literal'), 'yes');
console.log('PASS explicit request path remains caller-controlled'); passed++;
console.log(`SDK URL contract ${passed} checks passed`);
