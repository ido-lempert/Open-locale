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
console.log(`SDK error contract ${count} checks passed`);
