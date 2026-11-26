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
  'test:reports-refresh-browser':'REPORT_QA_BROWSER_TEST_PG_PORT',
  'test:qa-branches-browser':'REPORT_QA_BROWSER_TEST_PG_PORT',
  'test:qa-browser':'REPORT_QA_BROWSER_TEST_PG_PORT',
  'test:reports-download-browser':'REPORT_QA_BROWSER_TEST_PG_PORT',
  'test:qa-type-browser':'REPORT_QA_BROWSER_TEST_PG_PORT',
  'test:qa-download-browser':'REPORT_QA_BROWSER_TEST_PG_PORT',
  'test:qa-search-browser':'REPORT_QA_BROWSER_TEST_PG_PORT',
  'test:reports-project-download-browser':'REPORT_QA_BROWSER_TEST_PG_PORT',
  'test:reports-locale-search-browser':'REPORT_QA_BROWSER_TEST_PG_PORT',
  'test:qa-search-metadata-browser':'QA_SEARCH_META_TEST_PG_PORT',
  'test:reports-locale-metadata-browser':'REPORT_LOCALE_META_TEST_PG_PORT',
  'test:reports-own-count-browser':'REPORT_OWN_COUNT_TEST_PG_PORT',
  'test:reports-table-layout-browser':'REPORT_TABLE_LAYOUT_TEST_PG_PORT',
  'test:qa-unknown-type-browser':'QA_UNKNOWN_TYPE_TEST_PG_PORT',
  'test:qa-table-scroll-browser':'QA_TABLE_SCROLL_TEST_PG_PORT',
  'test:qa-clear-browser':'QA_CLEAR_TEST_PG_PORT',
 };
 const scripts=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).scripts;
 const cases=Object.entries(scripts).filter(([name])=>(name.startsWith('test:reports-')||name.startsWith('test:qa-'))&&name.endsWith('-browser')).map(([label,command])=>{
  const match=/^(?:python3 scripts\/run-reaped\.py )?node (scripts\/[a-z0-9-]+\.mjs)$/.exec(command);
  if(!match||!Object.hasOwn(ports,label))throw new Error(`Unsupported harness entry: ${label}`);
  return reportBrowserPreflight(label,command,ports[label],readFileSync(new URL('../'+match[1],import.meta.url),'utf8'));
 }).filter(([label])=>!process.env.REPORT_QA_HARNESS_FILTER||new RegExp(process.env.REPORT_QA_HARNESS_FILTER).test(label));
 if(!cases.length)throw new Error('No harness cases selected');
 for(const [label,script,portEnv] of cases){
  if(process.env.REPORT_QA_HARNESS_PREFLIGHT==='1'){check(`${label}: script command and PostgreSQL override agree`,true);continue;}
  const run=spawnSync('python3',['scripts/run-reaped.py',process.execPath,script],{env:{...process.env,[portEnv]:String(listener.address().port)},encoding:'utf8',timeout:30000});
  const output=run.stdout+run.stderr;
  check(`${label}: occupied PostgreSQL port aborts real browser startup`,!run.error&&output.includes('Address already in use')&&output.includes('FAIL suite aborted'));
  check(`${label}: incomplete cleanup retains nonzero exit without timeout or signal`,run.status!==null&&run.status!==0&&!run.signal&&!run.error);
  check(`${label}: aborted suite cannot count application PASS assertions`,!/^PASS /m.test(output));
  if(run.error||run.status===0||run.signal)console.log(JSON.stringify({label,status:run.status,signal:run.signal,error:run.error?.message,output}));
 }

}finally{await new Promise(resolve=>listener.close(resolve));}
process.exitCode=failures?1:0;
