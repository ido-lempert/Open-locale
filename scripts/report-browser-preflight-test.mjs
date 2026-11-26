import assert from 'node:assert/strict';
import {reportBrowserPreflight as validate} from './lib/report-browser-preflight.mjs';
import {spawnSync} from 'node:child_process';
const source='const PG_PORT = Number(process.env.RIGHT_PORT ?? 55123), WEB_PORT=4200;';
let count=0;
const test=(name,fn)=>{fn();count++;console.log('PASS '+name);};
test('plain node command exact override accepted',()=>assert.deepEqual(validate('test:example','node scripts/example-test.mjs','RIGHT_PORT',source),['test:example','scripts/example-test.mjs','RIGHT_PORT']));
test('reaped command accepted',()=>assert.equal(validate('test:example','python3 scripts/run-reaped.py node scripts/example-test.mjs','RIGHT_PORT',source)[1],'scripts/example-test.mjs'));
for(const [name,command,env,text] of [
 ['aliased script','node scripts/other-test.mjs','RIGHT_PORT',source],
 ['wrong port mapping','node scripts/example-test.mjs','WRONG_PORT',source],
 ['missing declaration','node scripts/example-test.mjs','RIGHT_PORT','const PORT=55123;'],
 ['duplicate declaration','node scripts/example-test.mjs','RIGHT_PORT',source+source],
 ['unsupported command','node scripts/example-test.mjs; true','RIGHT_PORT',source],
 ['missing mapping','node scripts/example-test.mjs',undefined,source],
 ['invalid mapping','node scripts/example-test.mjs','RIGHT.PORT',source],
])test(name+' rejected',()=>assert.throws(()=>validate('test:example',command,env,text)));
const run=spawnSync(process.execPath,['scripts/report-qa-harness-test.mjs'],{env:{...process.env,REPORT_QA_HARNESS_PREFLIGHT:'1',REPORT_QA_HARNESS_FILTER:''},encoding:'utf8',timeout:10000});
const expected=['reports-refresh','qa-branches','qa','reports-download','qa-type','qa-download','qa-search','reports-project-download','reports-locale-search','qa-search-metadata','reports-locale-metadata','reports-own-count','reports-table-layout','qa-unknown-type','qa-table-scroll','qa-clear'].map(n=>`PASS test:${n}-browser: script command and PostgreSQL override agree`).sort();
test('all real registry entries preflight without browser/PostgreSQL startup',()=>{assert.equal(run.status,0,run.stdout+run.stderr);assert.deepEqual(run.stdout.trim().split('\n').sort(),expected);assert.ok(!run.stdout.includes('database system'));});
console.log(`preflight ${count} checks complete`);
