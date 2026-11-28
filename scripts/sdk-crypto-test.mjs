// Isolated providers, synthetic responses only. Never contacts an API.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const provider = process.argv[2];
if (provider) {
  assert(['webcrypto', 'node'].includes(provider));
  let reads = 0, digests = 0;
  const crypto = provider === 'webcrypto' ? {
    subtle: { digest: (...args) => { digests++; return webcrypto.subtle.digest(...args); } },
  } : undefined;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, get: () => { reads++; return crypto; } });
  await import('./sdk-error-test.mjs');
  assert(reads > 0, 'SDK did not inspect crypto provider');
  if (provider === 'webcrypto') assert(digests > 0, 'SDK did not use WebCrypto');
  else assert.equal(digests, 0);
  console.log(`PROVIDER verified ${provider}`);
} else {
  for (const name of ['webcrypto', 'node']) {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), name], { encoding: 'utf8', timeout: 30000 });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr || child.stdout);
    assert.equal(child.signal, null);
    const lines = child.stdout.trim().split(/\r?\n/);
    assert.equal(lines.filter(line => line.startsWith('PASS ')).length, 66, `${name}: incomplete contract run`);
    assert.equal(lines.filter(line => line === 'SDK error contract 66 checks passed').length, 1);
    assert.equal(lines.at(-1), `PROVIDER verified ${name}`);
    console.log(`PASS SDK ${name} isolated error contract 66`);
  }
  console.log('SDK crypto provider contract 2 providers / 132 checks passed');
}
