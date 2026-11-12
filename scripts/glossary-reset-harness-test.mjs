// Actual PostgreSQL startup failure must remain a failure after cleanup.
import {createServer} from 'node:net';
import {spawnSync} from 'node:child_process';
let failures=0;
const listener=createServer();
await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});
try{
 const run=spawnSync('python3',['scripts/run-reaped.py',process.execPath,'scripts/glossary-new-term-reset-browser-test.mjs'],{env:{...process.env,GLOSSARY_NEW_TERM_RESET_TEST_PG_PORT:String(listener.address().port)},encoding:'utf8',timeout:30000});
 const output=run.stdout+run.stderr;
 const check=(name,ok)=>console.log(`${ok?'PASS':(failures++,'FAIL')} ${name}`);
 check('real occupied PostgreSQL port triggers startup abort',!run.error&&output.includes('Address already in use')&&output.includes('FAIL suite aborted'));
 check('incomplete cleanup cannot mask abort as exit zero',run.status!==null&&run.status!==0&&!run.signal);
 check('abort cannot count any application PASS assertions',!/^PASS /m.test(output));
 if(failures)console.log(JSON.stringify({status:run.status,signal:run.signal,error:run.error?.message,output}));
}finally{await new Promise(resolve=>listener.close(resolve));}
process.exitCode=failures?1:0;
