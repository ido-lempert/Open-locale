// Real local browser -> Webhook journal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55728, WEB_PORT = 4200, API_PORT = 3000;
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
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'new-task-form.json'),readDownload=async()=>{for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const data=JSON.parse(readFileSync(file,'utf8'));rmSync(file);return data;};
  let reads=0,writes=0,held,hold=false,unknown=false,failRead=false;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.endsWith('/tasks')){if(req.method()==='POST'){if(hold){held=req;return;}if(unknown)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_POST'})});}if(req.method()==='GET'&&failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ'})});}}req.continue();});
  await page.$eval('[name=downloadTaskDraft]',e=>e.click());const data=await readDownload();check('actual local form JSON preserves exact raw fields/selected IDs without loaded tasks',isDeepStrictEqual(data,{schemaVersion:1,projectId:project.id,scope:'current-local-new-task-form',serverStateConfirmed:false,importable:false,canCreate:false,selectedIdsVerified:false,createOutcomeUnconfirmed:false,draft:{title:'  Draft [A]  ',description:'=Private local "עברית"<b>literal</b>',dueDate:'2026-12-01',assigneeSelection:owner.user.id,dependsOnId:predecessor.id,keyIds:[key.id],lockKeys:true}})&&!JSON.stringify(data).includes('EXCLUDED_'));check('local form backup has zero API effects and bounded requested notice',reads===0&&writes===0&&await page.$eval('[name=taskDraftDownloadNotice]',e=>e.textContent.includes('does not confirm')));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/tasks-draft-download-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/tasks-draft-download-mobile.png',fullPage:true});check('390px backup controls/scope have no document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.type('[name=taskDescription]',' newer');await page.waitForFunction(()=>!document.querySelector('[name=taskDraftDownloadNotice]'));check('editing current form clears obsolete backup notice',!await page.$('[name=taskDraftDownloadNotice]'));
  hold=true;await page.$eval('.task-form',e=>e.requestSubmit());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>document.querySelector('[name=downloadTaskDraft]')?.disabled);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).downloadDraft());check('pending actual creation fences captured backup with no file',writes===1&&readdirSync(downloadDir).length===0);hold=false;await held.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_POST'})});held=null;await page.waitForSelector('[name=taskCreateUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=downloadTaskDraft]')?.disabled);const beforeReads=reads;await page.$eval('[name=downloadTaskDraft]',e=>e.click());const uncertain=await readDownload();check('uncertain creation permits form backup with explicit flag and no retry/read',uncertain.createOutcomeUnconfirmed&&uncertain.draft.description.endsWith(' newer')&&writes===1&&reads===beforeReads&&await page.$('[name=taskCreateUnknown]')&&!await page.$eval('[name=downloadTasks]',e=>!e.disabled));
  failRead=true;await page.$eval('[name=recoverTaskActions]',e=>e.click());await page.waitForSelector('[name=retryTaskList]');await page.$eval('[name=downloadTaskDraft]',e=>e.click());const failed=await readDownload();check('failed recovery retains local form and uncertain flag without server-state claim',failed.createOutcomeUnconfirmed&&!failed.serverStateConfirmed&&failed.draft.title===data.draft.title&&writes===1&&!(await page.content()).includes('PRIVATE_READ'));
  failRead=false;await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${second.id}/tasks`);await page.waitForFunction(()=>document.querySelector('[name=taskTitle]')?.value===''&&!ng.getComponent(document.querySelector('ol-tasks')).loading());check('reused project clears previous form and backup notice',!await page.$('[name=taskDraftDownloadNotice]'));await page.$eval('[name=downloadTaskDraft]',e=>e.click());const empty=await readDownload();check('new project empty form backup has exact new scope not submission authority',empty.projectId===second.id&&!empty.createOutcomeUnconfirmed&&empty.draft.title===''&&empty.draft.keyIds.length===0&&!empty.canCreate);
  await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('PRIVATE_DOWNLOAD');};ng.getComponent(document.querySelector('ol-tasks')).downloadDraft();});await page.waitForFunction(()=>document.querySelector('[name=taskDraftDownloadNotice]')?.textContent.includes('Copy your form text'));check('bounded local failure has no raw error',!(await page.content()).includes('PRIVATE_DOWNLOAD'));
  await page.evaluate(()=>{window.oldTasks=ng.getComponent(document.querySelector('ol-tasks'));window.afterDestroy=0;URL.createObjectURL=()=>{window.afterDestroy++;return 'blob:local';};history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-tasks'));await page.evaluate(()=>window.oldTasks.downloadDraft());check('departed captured backup cannot export',await page.evaluate(()=>window.afterDestroy===0)&&readdirSync(downloadDir).length===0&&writes===1);check('no form backup runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
