// Preflight rejection and fail-closed runtime checks for the staged browser harness.
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,symlinkSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
const root=mkdtempSync(join(tmpdir(),'ol-sync-stage-config-'));let failures=0;
const sourceHash=createHash('sha256').update(readFileSync('scripts/sync-browser-test.mjs')).digest('hex');
const check=(name,env,expected)=>{const r=spawnSync(process.execPath,['scripts/sync-browser-test.mjs'],{env:{...process.env,SYNC_BROWSER_STAGE:'',SYNC_BROWSER_CHECKPOINT_DIR:'',...env},encoding:'utf8',timeout:15000});const out=r.stdout+r.stderr;const ok=r.status!==0&&!r.error&&out.includes(expected)&&!out.includes('ALL SYNC BROWSER CHECKS PASSED')&&!out.includes('SYNC_BROWSER_STAGE_FIRST_RC=0');console.log(`${ok?'PASS':(failures++,'FAIL')} ${name}`);if(!ok)console.log(JSON.stringify({status:r.status,error:r.error?.message,out}));};
try{
 check('invalid stage rejected before startup',{SYNC_BROWSER_STAGE:'third',SYNC_BROWSER_CHECKPOINT_DIR:root},'Set SYNC_BROWSER_STAGE');
 check('relative checkpoint rejected',{SYNC_BROWSER_STAGE:'first',SYNC_BROWSER_CHECKPOINT_DIR:'relative'},'absolute SYNC_BROWSER_CHECKPOINT_DIR');
 check('checkpoint alone cannot select staged mode',{SYNC_BROWSER_CHECKPOINT_DIR:root},'requires SYNC_BROWSER_STAGE');
 const pub=join(root,'public');mkdirSync(pub,{mode:0o755});check('public checkpoint rejected',{SYNC_BROWSER_STAGE:'second',SYNC_BROWSER_CHECKPOINT_DIR:pub},'owned private directory');
 const dir=join(root,'private');mkdirSync(dir,{mode:0o700});const state=join(dir,'state.json');writeFileSync(state,'{}',{mode:0o600});
 check('changed source rejected',{SYNC_BROWSER_STAGE:'second',SYNC_BROWSER_CHECKPOINT_DIR:dir},'source mismatch');
 chmodSync(state,0o644);check('public metadata rejected',{SYNC_BROWSER_STAGE:'second',SYNC_BROWSER_CHECKPOINT_DIR:dir},'state must be private');chmodSync(state,0o600);
 const link=join(root,'link');symlinkSync(dir,link);check('symlink directory rejected',{SYNC_BROWSER_STAGE:'second',SYNC_BROWSER_CHECKPOINT_DIR:link},'owned private directory');
 rmSync(state);const target=join(root,'target.json');writeFileSync(target,'{}',{mode:0o600});symlinkSync(target,state);check('symlink metadata rejected',{SYNC_BROWSER_STAGE:'second',SYNC_BROWSER_CHECKPOINT_DIR:dir},'state must be private');rmSync(state);
 check('existing first-stage checkpoint rejected',{SYNC_BROWSER_STAGE:'first',SYNC_BROWSER_CHECKPOINT_DIR:dir},'EEXIST');
 // Discover a valid app hash without changing application files: import only the
 // helper declarations extracted from the harness, never execute the harness.
 const source=readFileSync('scripts/sync-browser-test.mjs','utf8');const helpers=source.slice(source.indexOf('const digestTree='),source.indexOf('let resume=null'));
 const getHash=new Function('createHash','readFileSync','readdirSync','lstatSync','join',helpers.replace(/const sourceHash=.*?;\n/,'')+'return appHash();');
 const fs=await import('node:fs');const appHash=getHash(createHash,readFileSync,fs.readdirSync,fs.lstatSync,join);
 const valid={sourceHash,appHash,checks:95,failures:0,owner:{user:{id:'owner'},accessToken:'fixture-owner'},member:{user:{id:'member'},accessToken:'fixture-member'},project:{id:'project'},second:{id:'second'},repositoryCalls:0,repositoryJson:'{}',viewport:{width:480,height:900},databaseHash:'wrong'};
 for(const [name,changes,expected] of [['failed first stage',{failures:1},'failed first stage'],['wrong first-stage assertion count',{checks:94},'source mismatch'],['changed app binding',{appHash:'wrong'},'source mismatch'],['missing fixture identity',{owner:null},'metadata invalid']]){writeFileSync(state,JSON.stringify({...valid,...changes}),{mode:0o600});check(name,{SYNC_BROWSER_STAGE:'second',SYNC_BROWSER_CHECKPOINT_DIR:dir},expected);}
 mkdirSync(join(dir,'postgres'));writeFileSync(join(dir,'postgres','fixture'),'bytes');writeFileSync(state,JSON.stringify(valid),{mode:0o600});check('changed database bytes rejected',{SYNC_BROWSER_STAGE:'second',SYNC_BROWSER_CHECKPOINT_DIR:dir},'database mismatch');
 symlinkSync(target,join(dir,'postgres','link'));check('database symlink rejected',{SYNC_BROWSER_STAGE:'second',SYNC_BROWSER_CHECKPOINT_DIR:dir},'cannot contain symlinks');
 const listener=createServer();await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(55479,'127.0.0.1',resolve);});try{check('runtime startup failure cannot exit green',{SYNC_BROWSER_STAGE:'first',SYNC_BROWSER_CHECKPOINT_DIR:join(root,'occupied')},'FAIL suite aborted');}finally{await new Promise(r=>listener.close(r));}
}finally{rmSync(root,{recursive:true,force:true});}
process.exitCode=failures?1:0;
