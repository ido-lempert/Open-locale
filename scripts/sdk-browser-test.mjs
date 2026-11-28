// Local Chromium SDK primitives, not application UI acceptance or real API access.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const source = readFileSync('libs/sdk/src/index.mjs');
let browser;
const transportReads = [];
const redirectReads = [];
let redirectTargetReads = 0;
const transportBody = JSON.stringify({ version: 1, branch: 'main', translations: { network: 'שלום 😀' } });
const transportDigest = createHash('sha256').update(transportBody).digest('hex');
const server = createServer((req, res) => {
  if (req.url === '/redirect-target') {
    redirectTargetReads++; res.setHeader('Content-Type', 'application/json'); res.end(transportBody);
  }
  else if (req.url?.startsWith('/api/projects/redirect-')) {
    redirectReads.push({ path: req.url, token: req.headers['x-api-key'] });
    res.statusCode = Number(req.url.split('redirect-')[1].split('/')[0]);
    res.setHeader('Location', '/redirect-target'); res.end();
  }
  else if (req.url?.startsWith('/api/projects/')) {
    transportReads.push({ path: req.url, method: req.method, token: req.headers['x-api-key'], etag: req.headers['if-none-match'] });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-OpenLocale-Bundle-SHA256', transportDigest);
    res.setHeader('ETag', '"transport-v1"');
    if (req.headers['if-none-match'] === '"transport-v1"') { res.statusCode = 304; res.end(); }
    else res.end(req.url.includes('/tampered/') ? transportBody + ' ' : transportBody);
  }
  else if (req.url === '/sdk.mjs') { res.setHeader('Content-Type', 'text/javascript'); res.end(source); }
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
    const allowed = ['/', '/sdk.mjs', '/favicon.ico', '/api/projects/transport/ota/latest?locale=en', '/api/projects/tampered/ota/latest?locale=en', '/redirect-target',
      ...[301, 302, 303, 307, 308].flatMap(status => [`/api/projects/redirect-${status}`, `/api/projects/redirect-${status}/ota/latest?locale=en`])];
    if (allowed.some(path => req.url() === origin + path)) req.continue();
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
    const live = createClient({ url: location.origin, token: 'test-only' });
    const fresh = await live.ota.latest('transport', 'en');
    if (fresh.notModified || fresh.bundle.translations.network !== 'שלום 😀' || fresh.etag !== '"transport-v1"' || !/^[a-f0-9]{64}$/.test(fresh.sha256)) throw new Error('Failed native HTTP fresh');
    results.push('HTTP fresh bytes');
    const revalidated = await live.ota.latest('transport', 'en', { etag: fresh.etag });
    if (!revalidated.notModified || revalidated.etag !== fresh.etag || revalidated.sha256 !== fresh.sha256 || 'bundle' in revalidated) throw new Error('Failed native HTTP304');
    results.push('HTTP conditional304');
    const tampered = await live.ota.latest('tampered', 'en').catch(e => e);
    if (!(tampered instanceof OpenLocaleError) || tampered.message !== 'OTA bundle integrity check failed: digest mismatch') throw new Error('Failed native HTTP tamper');
    results.push('HTTP changed bytes rejected');
    for (const status of [301, 302, 303, 307, 308]) {
      for (const [label, pull] of [
        ['request', () => live.projects.get(`redirect-${status}`)],
        ['OTA', () => live.ota.latest(`redirect-${status}`, 'en')],
      ]) {
        const error = await pull().catch(e => e);
        if (!(error instanceof TypeError)) throw new Error(`Failed redirect ${status} ${label}`);
        results.push(`HTTP redirect ${status} ${label} rejected`);
      }
    }
    return results;
  });
  assert.equal(results.length, 21);
  assert.equal(redirectTargetReads, 0, 'Redirect destination must receive no request');
  assert.deepEqual(redirectReads, [301, 302, 303, 307, 308].flatMap(status => [
    { path: `/api/projects/redirect-${status}`, token: 'test-only' },
    { path: `/api/projects/redirect-${status}/ota/latest?locale=en`, token: 'test-only' },
  ]));
  assert.deepEqual(transportReads, [
    { path: '/api/projects/transport/ota/latest?locale=en', method: 'GET', token: 'test-only', etag: undefined },
    { path: '/api/projects/transport/ota/latest?locale=en', method: 'GET', token: 'test-only', etag: '"transport-v1"' },
    { path: '/api/projects/tampered/ota/latest?locale=en', method: 'GET', token: 'test-only', etag: undefined },
  ]);
  assert.deepEqual(unexpected, []);
  for (const label of results) console.log(`PASS native browser SDK ${label}`);
  console.log('SDK browser contract 21 checks passed');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
