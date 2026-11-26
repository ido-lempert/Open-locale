// Real occupied-port startup abort must never report a successful test run.
import {createServer} from 'node:net';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {reportBrowserPreflight} from './lib/report-browser-preflight.mjs';
let failures=0;
const check=(name,ok)=>console.log(`${ok?'PASS':(failures++,'FAIL')} ${name}`);
const listener=createServer();
await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'0.0.0.0',resolve);});
try{
 const ports={
  'test:ota-bundle-browser':'OTA_BROWSER_TEST_PG_PORT',
  'test:ota-bundle-download-browser':'OTA_BROWSER_TEST_PG_PORT',
  'test:ota-value-filter-browser':'OTA_BROWSER_TEST_PG_PORT',
  'test:ota-time-browser':'OTA_TIME_TEST_PG_PORT',
  'test:ota-search-metadata-browser':'OTA_SEARCH_META_TEST_PG_PORT',
  'test:ota-value-types-browser':'OTA_VALUE_TYPES_TEST_PG_PORT',
 };
 const scripts=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).scripts;
 const cases=Object.entries(scripts).filter(([name])=>name.startsWith('test:ota-')&&name.endsWith('-browser')).map(([label,command])=>{
  const match=/^(?:python3 scripts\/run-reaped\.py )?node (scripts\/[a-z0-9-]+\.mjs)$/.exec(command);
  if(!match||!Object.hasOwn(ports,label))throw new Error(`Unsupported harness entry: ${label}`);
  return reportBrowserPreflight(label,command,ports[label],readFileSync(new URL('../'+match[1],import.meta.url),'utf8'));
 }).filter(([label])=>!process.env.OTA_HARNESS_FILTER||new RegExp(process.env.OTA_HARNESS_FILTER).test(label));
 if(!cases.length)throw new Error('No harness cases selected');
 for(const [label,script,portEnv] of cases){
  if(process.env.OTA_HARNESS_PREFLIGHT==='1'){check(`${label}: script command and PostgreSQL override agree`,true);continue;}
  const run=spawnSync('python3',['scripts/run-reaped.py',process.execPath,script],{env:{...process.env,[portEnv]:String(listener.address().port)},encoding:'utf8',timeout:30000});
  const output=run.stdout+run.stderr;
  check(`${label}: occupied PostgreSQL port aborts real browser startup`,!run.error&&output.includes('Address already in use')&&output.includes('FAIL suite aborted'));
  check(`${label}: incomplete cleanup retains nonzero exit without timeout or signal`,run.status!==null&&run.status!==0&&!run.signal&&!run.error);
  check(`${label}: aborted suite cannot count application PASS assertions`,!/^PASS /m.test(output));
  if(run.error||run.status===0||run.signal)console.log(JSON.stringify({label,status:run.status,signal:run.signal,error:run.error?.message,output}));
 }

}finally{await new Promise(resolve=>listener.close(resolve));}
process.exitCode=failures?1:0;
