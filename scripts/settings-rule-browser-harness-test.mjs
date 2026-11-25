// Real occupied-port startup abort must never report a successful test run.
import {createServer} from 'node:net';
import {spawnSync} from 'node:child_process';
let failures=0;
const check=(name,ok)=>console.log(`${ok?'PASS':(failures++,'FAIL')} ${name}`);
const listener=createServer();
await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'0.0.0.0',resolve);});
try{
 const cases=[["test:settings-rule-refresh-browser", "scripts/settings-rule-refresh-browser-test.mjs", "SETTINGS_RULE_TEST_PG_PORT"], ["test:settings-rule-name-discard-browser", "scripts/settings-rule-name-discard-browser-test.mjs", "SETTINGS_RULE_TEST_PG_PORT"], ["test:settings-rule-pending-draft-browser", "scripts/settings-rule-pending-draft-browser-test.mjs", "SETTINGS_RULE_TEST_PG_PORT"], ["test:settings-rule-name-validation-browser", "scripts/settings-rule-name-validation-browser-test.mjs", "SETTINGS_RULE_TEST_PG_PORT"]].filter(([label])=>!process.env.SETTINGS_RULE_HARNESS_FILTER||new RegExp(process.env.SETTINGS_RULE_HARNESS_FILTER).test(label));
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
