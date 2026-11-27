// Isolated package consumer, no installation/registry/network.
import { mkdtempSync, mkdirSync, symlinkSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const dir = mkdtempSync(join(tmpdir(), 'ol-sdk-types-'));
try {
  mkdirSync(join(dir, 'node_modules/@open-locale'), { recursive: true });
  symlinkSync(resolve('libs/sdk'), join(dir, 'node_modules/@open-locale/sdk'), 'dir');
  const fixture = readFileSync('scripts/sdk-types-test.mts', 'utf8').replace('../libs/sdk/src/index.js', '@open-locale/sdk');
  writeFileSync(join(dir, 'consumer.mts'), fixture);
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--skipLibCheck', '--lib', 'es2022,dom', '--module', 'nodenext', '--moduleResolution', 'nodenext', join(dir, 'consumer.mts')], { stdio: 'inherit' });
  console.log('PASS SDK package export resolves strict types and OTA narrowing');
  writeFileSync(join(dir, 'runtime.mjs'), `import { createClient, OpenLocaleError } from '@open-locale/sdk'; if (typeof createClient !== 'function' || typeof OpenLocaleError !== 'function') throw new Error('Missing SDK exports');`);
  execFileSync(process.execPath, [join(dir, 'runtime.mjs')], { stdio: 'inherit' });
  console.log('PASS SDK package export retains runtime ESM entry');
} finally { rmSync(dir, { recursive: true, force: true }); }
