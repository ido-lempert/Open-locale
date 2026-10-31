// Preflight negative checks must fail before opening a database/browser.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const root=mkdtempSync(join(tmpdir(),'ol-visual-config-'));
const sourceHash=createHash('sha256').update(readFileSync('scripts/e2e-visual.mjs')).digest('hex');
let failures=0;
const check=(name,env,expected)=>{
 const result=spawnSync(process.execPath,['scripts/e2e-visual.mjs'],{env:{...process.env,VISUAL_STAGE:'',VISUAL_CHECKPOINT_DIR:'',...env},encoding:'utf8',timeout:10000});
 const output=result.stdout+result.stderr;
 const ok=result.status!==0&&!result.error&&output.includes(expected)&&!output.includes('E2E_RC=0')&&!output.includes('PASS API up');
 console.log(`${ok?'PASS':(failures++,'FAIL')} ${name}`);
};
try{
 check('invalid stage fails before startup',{VISUAL_STAGE:'third',VISUAL_CHECKPOINT_DIR:root},'Set VISUAL_STAGE');
 check('stage requires explicit absolute checkpoint',{VISUAL_STAGE:'first',VISUAL_CHECKPOINT_DIR:'relative'},'absolute VISUAL_CHECKPOINT_DIR');
 check('checkpoint alone cannot imply full run',{VISUAL_CHECKPOINT_DIR:root},'requires VISUAL_STAGE');
 const pub=join(root,'public');mkdirSync(pub);chmodSync(pub,0o755);
 check('second stage rejects public checkpoint',{VISUAL_STAGE:'second',VISUAL_CHECKPOINT_DIR:pub},'owned private directory');
 const dir=join(root,'private');mkdirSync(dir,{mode:0o700});
 const state=join(dir,'state.json');writeFileSync(state,JSON.stringify({sourceHash:'wrong',checks:116,failures:0}),{mode:0o600});
 check('second stage rejects changed source',{VISUAL_STAGE:'second',VISUAL_CHECKPOINT_DIR:dir},'source mismatch');
 writeFileSync(state,JSON.stringify({sourceHash,checks:116,failures:1}));
 check('failed first stage cannot resume',{VISUAL_STAGE:'second',VISUAL_CHECKPOINT_DIR:dir},'failed first stage');
 chmodSync(state,0o644);
 check('second stage rejects public state',{VISUAL_STAGE:'second',VISUAL_CHECKPOINT_DIR:dir},'state must be private');
 const link=join(root,'link');symlinkSync(dir,link);
 check('second stage rejects symlink checkpoint',{VISUAL_STAGE:'second',VISUAL_CHECKPOINT_DIR:link},'owned private directory');
 check('first stage refuses an existing checkpoint',{VISUAL_STAGE:'first',VISUAL_CHECKPOINT_DIR:dir},'EEXIST');
}finally{rmSync(root,{recursive:true,force:true});}
process.exitCode=failures?1:0;
