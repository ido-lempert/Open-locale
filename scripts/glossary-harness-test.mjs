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
  "test:glossary-save-unknown-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-delete-confirm-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-search-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-delete-local-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-create-local-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-create-unknown-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-draft-download-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-local-text-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-reset-local-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-new-term-draft-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-new-term-reset-browser": "GLOSSARY_NEW_TERM_RESET_TEST_PG_PORT",
  "test:glossary-new-term-download-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-attention-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-create-validation-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-term-edit-browser": "GLOSSARY_BROWSER_TEST_PG_PORT",
  "test:glossary-search-metadata-browser": "GLOSSARY_SEARCH_META_TEST_PG_PORT"
};
 const scripts=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).scripts;
 const cases=Object.entries(scripts).filter(([name])=>name.startsWith('test:glossary-')&&name.endsWith('-browser')).map(([label,command])=>{
  const match=/^(?:python3 scripts\/run-reaped\.py )?node (scripts\/[a-z0-9-]+\.mjs)$/.exec(command);
  if(!match||!Object.hasOwn(ports,label))throw new Error(`Unsupported harness entry: ${label}`);
  return [label,match[1],ports[label]];
 }).filter(([label])=>!process.env.GLOSSARY_HARNESS_FILTER||new RegExp(process.env.GLOSSARY_HARNESS_FILTER).test(label));
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
