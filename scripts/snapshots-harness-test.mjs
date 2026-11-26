// Real occupied-port startup abort must never report a successful test run.
import {createServer} from 'node:net';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
let failures=0;
const check=(name,ok)=>console.log(`${ok?'PASS':(failures++,'FAIL')} ${name}`);
const listener=createServer();
await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'0.0.0.0',resolve);});
try{
 const ports={
  'test:snapshot-metadata-fallback-browser':'SNAPSHOT_BROWSER_TEST_PG_PORT',
  'test:snapshot-restore-identity-browser':'SNAPSHOT_BROWSER_TEST_PG_PORT',
  'test:snapshot-restore-ready-browser':'SNAPSHOT_BROWSER_TEST_PG_PORT',
  'test:snapshot-restore-unknown-browser':'SNAPSHOT_BROWSER_TEST_PG_PORT',
  'test:snapshots-search-browser':'SNAPSHOT_BROWSER_TEST_PG_PORT',
  'test:snapshot-browser':'SNAPSHOT_BROWSER_TEST_PG_PORT',
  'test:snapshot-capture-unknown-browser':'SNAPSHOT_BROWSER_TEST_PG_PORT',
  'test:snapshots-download-browser':'SNAPSHOT_BROWSER_TEST_PG_PORT',
  'test:snapshots-label-metadata-browser':'SNAPSHOT_LABEL_META_TEST_PG_PORT',
  'test:snapshots-counts-browser':'SNAPSHOT_COUNTS_TEST_PG_PORT',
  'test:snapshots-clear-browser':'SNAPSHOT_CLEAR_TEST_PG_PORT',
  'test:snapshots-kind-browser':'SNAPSHOT_BROWSER_TEST_PG_PORT',
  'test:snapshot-label-validation-browser':'SNAPSHOT_BROWSER_TEST_PG_PORT',
  'test:snapshot-time-zone-browser':'SNAPSHOT_ZONE_TEST_PG_PORT',
  'test:snapshot-restore-receipt-browser':'SNAPSHOT_RECEIPT_TEST_PG_PORT',
 };
 const scripts=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).scripts;
 const cases=Object.entries(scripts).filter(([name])=>name.startsWith('test:snapshot')&&name.endsWith('-browser')).map(([label,command])=>{
  const match=/^(?:python3 scripts\/run-reaped\.py )?node (scripts\/[a-z0-9-]+\.mjs)$/.exec(command);
  if(!match||!Object.hasOwn(ports,label))throw new Error(`Unsupported harness entry: ${label}`);
  return [label,match[1],ports[label]];
 }).filter(([label])=>!process.env.SNAPSHOT_HARNESS_FILTER||new RegExp(process.env.SNAPSHOT_HARNESS_FILTER).test(label));
 if(!cases.length)throw new Error('No harness cases selected');
 for(const [label,script,portEnv] of cases){
  const run=spawnSync('python3',['scripts/run-reaped.py',process.execPath,script],{env:{...process.env,[portEnv]:String(listener.address().port)},encoding:'utf8',timeout:30000});
  const output=run.stdout+run.stderr;
  check(`${label}: occupied PostgreSQL port aborts real browser startup`,!run.error&&output.includes('Address already in use')&&output.includes('FAIL suite aborted'));
  check(`${label}: incomplete cleanup retains nonzero exit without timeout or signal`,run.status!==null&&run.status!==0&&!run.signal&&!run.error);
  check(`${label}: aborted suite cannot count application PASS assertions`,!/^PASS /m.test(output));
  if(run.error||run.status===0||run.signal)console.log(JSON.stringify({label,status:run.status,signal:run.signal,error:run.error?.message,output}));
 }

}finally{await new Promise(resolve=>listener.close(resolve));}
process.exitCode=failures?1:0;
