// Real occupied-port startup abort must never report a successful test run.
import {createServer} from 'node:net';
import {spawnSync} from 'node:child_process';
let failures=0;
const check=(name,ok)=>console.log(`${ok?'PASS':(failures++,'FAIL')} ${name}`);
const listener=createServer();
await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'0.0.0.0',resolve);});
try{
 const run=spawnSync('python3',['scripts/run-reaped.py',process.execPath,'scripts/tasks-details-edit-browser-test.mjs'],{env:{...process.env,TASK_DETAILS_TEST_PG_PORT:String(listener.address().port)},encoding:'utf8',timeout:30000});
 const output=run.stdout+run.stderr;
 check('occupied PostgreSQL port aborts real details-browser startup',!run.error&&output.includes('Address already in use')&&output.includes('FAIL suite aborted'));
 check('incomplete cleanup retains nonzero exit without timeout or signal',run.status!==null&&run.status!==0&&!run.signal&&!run.error);
 check('aborted suite cannot count application PASS assertions',!/^PASS /m.test(output));
 if(failures)console.log(JSON.stringify({status:run.status,signal:run.signal,error:run.error?.message,output}));
}finally{await new Promise(resolve=>listener.close(resolve));}
process.exitCode=failures?1:0;
