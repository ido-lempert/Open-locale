import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=(filter='')=>spawnSync(process.execPath,['scripts/ota-browser-harness-test.mjs'],{env:{...process.env,OTA_HARNESS_PREFLIGHT:'1',OTA_HARNESS_FILTER:filter},encoding:'utf8',timeout:10000});
const expected=['bundle','bundle-download','value-filter','time','search-metadata','value-types'].map(n=>`PASS test:ota-${n}-browser: script command and PostgreSQL override agree`).sort();
const all=run();assert.equal(all.status,0,all.stdout+all.stderr);assert.deepEqual(all.stdout.trim().split('\n').sort(),expected);console.log('PASS exact six OTA browser commands validated without PostgreSQL startup');
const filtered=run('^test:ota-(search-metadata|value-types)-browser$');assert.equal(filtered.status,0,filtered.stdout+filtered.stderr);assert.deepEqual(filtered.stdout.trim().split('\n').sort(),expected.filter(s=>/search-metadata|value-types/.test(s)));console.log('PASS filtered preflight includes both formerly omitted flows');
const none=run('^missing$');assert.notEqual(none.status,0);assert.ok(none.stderr.includes('No harness cases selected'));assert.equal(none.stdout,'');console.log('PASS empty filter selection fails without false PASS');
