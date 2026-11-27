// Isolated SDK export error contract, no network or private data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createClient, OpenLocaleError } from '../libs/sdk/src/index.mjs';
let requested;
const expectedPath = '/projects/project/export/he/po?branch=feature';
let count = 0;
for (const [label, body, expected] of [
  ['string', { message: 'Denied' }, 'Denied'],
  ['validation list', { message: ['First', 'Second'] }, 'First; Second'],
  ['missing message', {}, 'HTTP 403'],
]) {
  const client = createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async url => { requested = new URL(url); return new Response(JSON.stringify(body), { status: 403 }); } });
  const error = await client.io.exportText('project', 'he', 'po', { branch: 'feature' }).catch(e => e);
  assert(error instanceof OpenLocaleError);
  assert.equal(error.status, 403);
  assert.equal(error.path, expectedPath);
  assert.equal(requested.pathname + requested.search, '/api' + expectedPath);
  assert.equal(error.message, expected);
  console.log(`PASS export error ${label}`); count++;
}
for (const [label, text] of [['broken object', '{"private-marker":'], ['html', '<html>private-marker</html>']]) {
  const digest = createHash('sha256').update(text).digest('hex');
  const client = createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async () => new Response(text, { status: 200, headers: { 'x-openlocale-bundle-sha256': digest } }) });
  const error = await client.ota.latest('project', 'he', { branch: 'feature' }).catch(e => e);
  assert(error instanceof OpenLocaleError);
  assert.equal(error.status, 200);
  assert.equal(error.path, '/projects/project/ota/latest?branch=feature&locale=he');
  assert.equal(error.message, 'OTA bundle is not valid JSON');
  assert(!error.message.includes('private-marker'));
  console.log(`PASS OTA parse error ${label}`); count++;
}
const validBundle = { version: 1, branch: 'main', translations: { greeting: 'Hello' } };
for (const [label, bundle] of [
  ['null', null], ['array', []], ['missing fields', {}],
  ['fraction version', { ...validBundle, version: 1.5 }],
  ['zero version', { ...validBundle, version: 0 }],
  ['branch type', { ...validBundle, branch: 4 }],
  ['translations array', { ...validBundle, translations: [] }],
  ['translations null', { ...validBundle, translations: null }],
  ['translation object', { ...validBundle, translations: { greeting: {} } }],
  ['translation number', { ...validBundle, translations: { greeting: 1 } }],
]) {
  const text = JSON.stringify(bundle);
  const digest = createHash('sha256').update(text).digest('hex');
  const client = createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async () => new Response(text, { status: 200, headers: { 'x-openlocale-bundle-sha256': digest } }) });
  const error = await client.ota.latest('project', 'he').catch(e => e);
  assert(error instanceof OpenLocaleError);
  assert.equal(error.status, 200);
  assert.equal(error.message, 'OTA bundle has invalid required fields');
  assert.equal(error.path, '/projects/project/ota/latest?locale=he');
  console.log(`PASS OTA required fields ${label}`); count++;
}
const specialText = '{"version":1,"branch":"main","translations":{"__proto__":"literal","constructor":"own","empty":""},"futureField":true}';
const specialDigest = createHash('sha256').update(specialText).digest('hex');
const specialClient = createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async () => new Response(specialText, { headers: { 'x-openlocale-bundle-sha256': specialDigest } }) });
const special = await specialClient.ota.latest('project', 'en');
assert.equal(special.bundle.translations.__proto__, 'literal');
assert(Object.hasOwn(special.bundle.translations, '__proto__'));
assert.equal(special.bundle.translations.constructor, 'own');
assert.equal(special.bundle.translations.empty, '');
assert.equal(special.bundle.futureField, true);
console.log('PASS OTA valid literal keys and additive fields preserved'); count++;
for (const [label, bundle, pull] of [
  ['default branch', { ...validBundle, branch: 'other' }, c => c.ota.latest('project', 'en')],
  ['explicit branch', validBundle, c => c.ota.latest('project', 'en', { branch: 'feature' })],
  ['version', { ...validBundle, version: 2 }, c => c.ota.version('project', 1, 'en')],
]) {
  const text = JSON.stringify(bundle), digest = createHash('sha256').update(text).digest('hex');
  const client = createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async () => new Response(text, { headers: { 'x-openlocale-bundle-sha256': digest } }) });
  const error = await pull(client).catch(e => e);
  assert(error instanceof OpenLocaleError);
  assert.equal(error.message, 'OTA bundle does not match requested scope');
  assert.equal(error.status, 200);
  console.log(`PASS OTA requested scope ${label}`); count++;
}
for (const [label, locale] of [['different', 'he'], ['null', null], ['number', 4]]) {
  const text = JSON.stringify({ ...validBundle, locale }), digest = createHash('sha256').update(text).digest('hex');
  const client = createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async () => new Response(text, { headers: { 'x-openlocale-bundle-sha256': digest } }) });
  for (const [endpoint, pull] of [['latest', () => client.ota.latest('project', 'en')], ['version', () => client.ota.version('project', 1, 'en')]]) {
    const error = await pull().catch(e => e);
    assert(error instanceof OpenLocaleError);
    assert.equal(error.message, 'OTA bundle does not match requested scope');
    console.log(`PASS OTA locale ${label} ${endpoint}`); count++;
  }
}
const matchingText = JSON.stringify({ ...validBundle, locale: 'en' });
const matchingDigest = createHash('sha256').update(matchingText).digest('hex');
const matchingClient = createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async () => new Response(matchingText, { headers: { 'x-openlocale-bundle-sha256': matchingDigest } }) });
assert.equal((await matchingClient.ota.latest('project', 'en')).bundle.locale, 'en');
console.log('PASS OTA matching locale retained'); count++;
for (const [label, text] of [['invalid JSON', '{'], ['invalid shape', 'null'], ['wrong scope', JSON.stringify({ ...validBundle, branch: 'other' })]]) {
  for (const [digestLabel, digest, message] of [['absent', null, 'OTA bundle missing its integrity digest'], ['malformed', 'invalid', 'OTA bundle missing its integrity digest'], ['mismatch', '0'.repeat(64), 'OTA bundle integrity check failed: digest mismatch']]) {
    const client = createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async () => new Response(text, { headers: digest ? { 'x-openlocale-bundle-sha256': digest } : {} }) });
    const error = await client.ota.latest('project', 'en').catch(e => e);
    assert(error instanceof OpenLocaleError);
    assert.equal(error.message, message);
    console.log(`PASS OTA integrity precedes ${label} ${digestLabel}`); count++;
  }
}
console.log(`SDK error contract ${count} checks passed`);
