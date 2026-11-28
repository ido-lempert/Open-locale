// Local Chromium SDK primitives, not application UI acceptance or real API access.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const source = readFileSync('libs/sdk/src/index.mjs');
let browser;
const server = createServer((req, res) => {
  if (req.url === '/sdk.mjs') { res.setHeader('Content-Type', 'text/javascript'); res.end(source); }
  else if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Local SDK contract</title>'); }
  else { res.statusCode = 404; res.end(); }
});
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  const unexpected = [];
  page.on('request', req => {
    if ([origin + '/', origin + '/sdk.mjs', origin + '/favicon.ico'].includes(req.url())) req.continue();
    else { unexpected.push(req.url()); req.abort(); }
  });
  await page.goto(origin, { waitUntil: 'networkidle0' });
  const results = await page.evaluate(async () => {
    const { createClient, OpenLocaleError } = await import('/sdk.mjs');
    if (!globalThis.isSecureContext || !crypto.subtle) throw new Error('Native WebCrypto unavailable');
    const encoder = new TextEncoder(), bundle = { version: 1, branch: 'main', translations: { key: 'שלום 😀 �' } };
    const canonical = encoder.encode(JSON.stringify(bundle));
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...canonical]);
    const malformed = new Uint8Array([...encoder.encode('{"version":1,"branch":"main","translations":{"key":"'), 0xff, ...encoder.encode('"}}')]);
    const tests = [
      ['Unicode', canonical, canonical, null],
      ['BOM included', bom, bom, null],
      ['BOM addition', bom, canonical, 'OTA bundle integrity check failed: digest mismatch'],
      ['malformed UTF8', malformed, malformed, 'OTA bundle is not valid UTF-8'],
      ['invalid JSON', encoder.encode('{'), encoder.encode('{'), 'OTA bundle is not valid JSON'],
      ['invalid shape', encoder.encode('null'), encoder.encode('null'), 'OTA bundle has invalid required fields'],
      ['wrong branch', encoder.encode(JSON.stringify({ ...bundle, branch: 'other' })), null, 'OTA bundle does not match requested scope'],
    ];
    const results = [];
    for (const [label, bytes, digestBytes, expected] of tests) {
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', digestBytes ?? bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
      const client = createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async () => new Response(bytes, { headers: { 'x-openlocale-bundle-sha256': digest } }) });
      const result = await client.ota.latest('project', 'en').catch(e => e);
      if (expected) {
        if (!(result instanceof OpenLocaleError) || result.message !== expected || result.status !== 200 || result.path !== '/projects/project/ota/latest?locale=en') throw new Error(`Failed ${label}: ${result.message}`);
      } else if (JSON.stringify(result.bundle) !== JSON.stringify(bundle) || result.notModified !== false || result.sha256 !== digest) throw new Error(`Failed ${label}`);
      results.push(label);
    }
    const cached = await createClient({ url: 'https://example.invalid', token: 'test-only', fetchImpl: async () => new Response(null, { status: 304, headers: { etag: 'selected' } }) }).ota.latest('project', 'en', { etag: 'request' });
    if (!cached.notModified || cached.etag !== 'selected' || cached.sha256 !== null || 'bundle' in cached) throw new Error('Failed304');
    results.push('304 selected validator');
    return results;
  });
  assert.equal(results.length, 8);
  assert.deepEqual(unexpected, []);
  for (const label of results) console.log(`PASS native browser SDK ${label}`);
  console.log('SDK browser contract 8 checks passed');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
