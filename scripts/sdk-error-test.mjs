// Isolated SDK export error contract, no network or private data.
import assert from 'node:assert/strict';
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
console.log(`SDK error contract ${count} checks passed`);
