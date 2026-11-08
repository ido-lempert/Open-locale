// Real local browser -> new-task form reset -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55740, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
const downloadDir=mkdtempSync(join(tmpdir(),'ol-webhook-download-'));
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-webhook-journal-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('webhook_journal_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/webhook_journal_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  const predecessor=await call(`${P}/tasks`,{title:'Predecessor',description:'EXCLUDED_LOADED_TASK_DESCRIPTION'},token),key=await call(`${P}/keys`,{name:'locked.key'},token),second=await call('/projects',{name:'Next',slug:'next-draft',locales:['en']},token);
  await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-tasks')).keysLoading());
  await page.type('[name=taskTitle]','  Draft [A]  ');await page.type('[name=taskDescription]','=Private local "עברית"<b>literal</b>');await page.$eval('[name=taskDue]',e=>{e.value='2026-12-01';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.select('[name=taskAssignee]',owner.user.id);await page.select('[name=taskDependsOn]',predecessor.id);const keyOption=await page.$eval('[name=taskLockKeys]',e=>[...e.options].find(o=>o.textContent==='locked.key').value);await page.select('[name=taskLockKeys]',keyOption);await page.click('[name=taskLockToggle]');
  let reads=0,writes=0,held,hold=false,drop=false,failRead=false;await page.setRequestInterception(true);page.on('request',async req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.endsWith('/tasks')){if(req.method()==='POST'){if(hold){held=req;return;}if(drop){const r=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('fixture create failed');await r.json();return req.abort('failed');}}if(req.method()==='GET'&&failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ'})});}}req.continue();});
  const form=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));return [c.title(),c.description(),c.dueDate(),c.assigneeId(),c.dependsOnId(),c.selectedKeyIds(),c.lockKeys()];});
  const ask=async()=>{await page.waitForFunction(()=>!document.querySelector('[name=resetTaskDraft]')?.disabled);await page.$eval('[name=resetTaskDraft]',e=>e.click());await page.waitForSelector('[name=confirmTaskDraftReset]');};
  const confirm=async()=>{await page.$eval('[name=confirmTaskDraftReset]',e=>e.click());await page.waitForSelector('[name=taskDraftResetNotice]');};
  const original=await form();await ask();check('inline prompt preserves exact whole form without API effects',isDeepStrictEqual(await form(),original)&&reads===0&&writes===0);await page.$eval('[name=keepTaskDraft]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=taskDraftResetConfirm]'));check('Keep retains all text and selections',isDeepStrictEqual(await form(),original));await ask();await page.type('[name=taskDescription]',' newer');await page.waitForFunction(()=>!document.querySelector('[name=taskDraftResetConfirm]'));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).confirmDraftReset());check('stale confirmation cannot clear newer text',(await form())[1].endsWith(' newer')&&writes===0&&reads===0);
  await ask();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/tasks-draft-reset-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/tasks-draft-reset-mobile.png',fullPage:true});check('390px inline reset fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await confirm();check('confirmed reset clears only local whole form without server task or lock effects',isDeepStrictEqual(await form(),['','','','','',[],false])&&writes===0&&reads===0&&(await call(`${P}/tasks`,null,token)).some(t=>t.id===predecessor.id));
  await page.type('[name=taskTitle]','Committed unseen reset');hold=true;await page.$eval('.task-form',e=>e.requestSubmit());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>document.querySelector('[name=resetTaskDraft]')?.disabled);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));c.askDraftReset();c.confirmDraftReset();});check('actual held task creation blocks discard',writes===1&&(await form())[0]==='Committed unseen reset'&&!await page.$('[name=taskDraftResetConfirm]'));hold=false;const response=await fetch(held.url(),{method:'POST',headers:held.headers(),body:held.postData()});if(!response.ok)throw new Error('held fixture commit failed');await response.json();await held.abort('failed');held=null;await page.waitForSelector('[name=taskCreateUnknown]');await ask();await confirm();check('real committed-then-dropped create remains unknown after discard with no read/replay',writes===1&&reads===0&&isDeepStrictEqual(await form(),['','','','','',[],false])&&!!await page.$('[name=taskCreateUnknown]')&&await page.$eval('.task-form button[type=submit]',e=>e.disabled)&&(await call(`${P}/tasks`,null,token)).filter(t=>t.title==='Committed unseen reset').length===1);
  failRead=true;await page.waitForFunction(()=>!document.querySelector('[name=recoverTaskActions]')?.disabled);await page.$eval('[name=recoverTaskActions]',e=>e.click());await page.waitForSelector('[name=taskListError]');await page.type('[name=taskTitle]','Failed-read local');await ask();await confirm();check('failed read permits local discard without unlocking uncertain creation',writes===1&&reads===1&&!!await page.$('[name=taskCreateUnknown]')&&(await form())[0]==='');failRead=false;await page.waitForFunction(()=>!document.querySelector('[name=recoverTaskActions]')?.disabled);await page.$eval('[name=recoverTaskActions]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=taskCreateUnknown]')&&!ng.getComponent(document.querySelector('ol-tasks')).loading());check('explicit current recovery alone resolves uncertainty',writes===1&&reads===2);
  await page.type('[name=taskTitle]','Old project form');await ask();await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${second.id}/tasks`);await page.waitForFunction(()=>document.querySelector('[name=taskTitle]')?.value===''&&!ng.getComponent(document.querySelector('ol-tasks')).loading());await page.type('[name=taskTitle]','New project form');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).confirmDraftReset());check('reused project rejects old confirmation and clears old receipt',(await form())[0]==='New project form'&&!await page.$('[name=taskDraftResetNotice]'));await ask();await page.evaluate(()=>{window.oldTasks=ng.getComponent(document.querySelector('ol-tasks'));history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-tasks'));check('departed captured confirmation keeps local text',await page.evaluate(()=>{window.oldTasks.confirmDraftReset();return window.oldTasks.title()==='New project form'&&!window.oldTasks.draftResetPending();}));check('no reset runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
finally {
  await browser?.close();rmSync(downloadDir,{recursive:true,force:true});
  // Nx serve launches a child server. Reap its process group, not only Nx,
  // so a successful suite does not leave the web listener behind.
  const stopped = [web,api].filter(Boolean).map(child => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('close', resolve);
    if (child === web) { try { process.kill(-child.pid,'SIGKILL'); } catch { child.kill('SIGKILL'); } }
    else child.kill('SIGKILL');
  }));
  await Promise.all(stopped);
  await prisma?.$disconnect();await pg.stop().catch(()=>{});rmSync(dataDir,{recursive:true,force:true});
}
// Some child shutdown callbacks can reset exitCode. Exit with the verified result.
process.exit(process.exitCode??1);
