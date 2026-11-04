// Real local browser -> Tasks screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55538, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tasks-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('tasks_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/tasks_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  await call(`${P}/import/en`,{entries:{title:'Local title',conflict:'Local edit',remote:'Old text',empty:''}},token);
  await call(`${P}/tasks`,{title:'Actual task recovery'},token);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  await page.setViewport({width:480,height:900});
  await page.goto(`${WEB}/projects/${project.id}/tasks`,{waitUntil:'networkidle0'});await page.waitForSelector('.task-row');
  check('actual task read renders real persisted task',await page.$eval('.task-row',e=>e.textContent.includes('Actual task recovery')));
  let reads=0;await page.setRequestInterception(true);const failRead=req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/tasks`){reads++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-task-error'})});}return req.continue();};page.on('request',failRead);
  await page.select('[aria-label="Filter by status"]','OPEN');await page.waitForSelector('[name=retryTaskList]');
  check('failed filtered task read clears stale rows without empty-success or raw details',reads===1&&!(await page.$('.task-row'))&&!(await page.$('[name=taskListEmpty]'))&&!(await page.content()).includes('private-task-error'));
  await page.screenshot({path:'/downloads/tasks-list-failure-full.png',fullPage:true});page.off('request',failRead);
  let held=false,release;const gate=new Promise(r=>release=r);const holdRead=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/tasks`){reads++;held=true;await gate;}return req.continue();};page.on('request',holdRead);
  await page.click('[name=retryTaskList]');await page.waitForSelector('[name=taskListLoading]');if(!held)throw new Error('task retry not held');
  check('held task retry is loading not empty-success and retains selected filter',!(await page.$('.task-row'))&&!(await page.$('[name=taskListEmpty]'))&&!(await page.$('[name=retryTaskList]'))&&await page.$eval('[aria-label="Filter by status"]',e=>e.value==='OPEN'));
  release();await page.waitForSelector('.task-row');await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  check('actual selected-filter task retry restores real task and clears failure',reads===2&&await page.$$eval('.task-row',rows=>rows.length===1&&rows[0].textContent.includes('Actual task recovery'))&&!(await page.$('[name=taskListError]'))&&!(await page.$('[name=taskListLoading]')));
  check('task recovery fits narrow viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/downloads/tasks-list-recovered-full.png',fullPage:true});page.off('request',holdRead);await page.setRequestInterception(false);
  const next=await call('/projects',{name:'Next task project',slug:'next-task-project',locales:['en','fr']},token);
  await call(`/projects/${next.id}/tasks`,{title:'Current project task'},token);
  let oldHeld=false,releaseOld;const oldGate=new Promise(r=>releaseOld=r);await page.setRequestInterception(true);
  const holdOld=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/tasks`){oldHeld=true;await oldGate;}return req.continue();};page.on('request',holdOld);
  await page.select('[aria-label="Filter by assignee"]','me');await page.waitForSelector('[name=taskListLoading]');if(!oldHeld)throw new Error('old project tasks not held');
  check('held task filter clears old rows before reused route',!(await page.$('.task-row'))&&!(await page.$('[name=taskListEmpty]')));
  await page.evaluate(id=>{history.pushState({},'',`/projects/${id}/tasks`);window.dispatchEvent(new PopStateEvent('popstate'));},next.id);
  await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false'&&document.querySelector('.task-row')?.textContent.includes('Current project task'));
  const latestRows=await page.$eval('.task-list',e=>e.textContent);const oldResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/tasks`);releaseOld();const oldBody=await (await oldResponse).json();await new Promise(r=>setTimeout(r,120));
  check('late actual old-project empty task response cannot replace current project rows or status',oldBody.length===0&&await page.$eval('.task-list',(e,text)=>e.textContent===text,latestRows)&&!(await page.$('[name=taskListLoading]'))&&!(await page.$('[name=taskListError]'))&&!(await page.$('[name=taskListEmpty]'))&&await page.$eval('.back',(e,id)=>e.getAttribute('href')===`/projects/${id}`,next.id)&&await page.$eval('[aria-label="Filter by assignee"]',e=>e.value==='')&&await page.$eval('[aria-label="Filter by status"]',e=>e.value===''));
  check('task reused-route race leaves no browser runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  page.off('request',holdOld);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/tasks-project-race-full.png',fullPage:true});
  let oldKeysHeld=false,oldKeyBytes,releaseKeys;const keysGate=new Promise(r=>releaseKeys=r);await page.setRequestInterception(true);
  const holdFirstKeys=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/keys`&&!oldKeysHeld){oldKeysHeld=true;const response=await fetch(req.url(),{headers:req.headers()});oldKeyBytes=await response.text();await keysGate;return req.respond({status:response.status,contentType:'application/json',body:oldKeyBytes});}return req.continue();};page.on('request',holdFirstKeys);
  const route=async id=>page.evaluate(id=>{history.pushState({},'',`/projects/${id}/tasks`);window.dispatchEvent(new PopStateEvent('popstate'));},id);
  await route(project.id);await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');for(let i=0;i<50&&!oldKeyBytes;i++)await new Promise(r=>setTimeout(r,20));if(!oldKeyBytes)throw new Error('old key response not captured');
  await call(`${P}/keys`,{name:'fresh.second.visit'},token);await route(next.id);await page.waitForFunction(()=>document.querySelector('.task-row')?.textContent.includes('Current project task'));
  await route(project.id);await page.waitForFunction(()=>Array.from(document.querySelector('[name=taskLockKeys]')?.options??[]).some(o=>o.textContent==='fresh.second.visit'));
  const currentKeys=await page.$eval('[name=taskLockKeys]',e=>Array.from(e.options).map(o=>[o.value,o.textContent]));const lateKeys=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/keys`);releaseKeys();await lateKeys;await new Promise(r=>setTimeout(r,120));
  check('actual first-visit key response cannot overwrite newer options after A B A route reuse',!oldKeyBytes.includes('fresh.second.visit')&&currentKeys.some(o=>o[1]==='fresh.second.visit')&&await page.$eval('[name=taskLockKeys]',(e,options)=>JSON.stringify(Array.from(e.options).map(o=>[o.value,o.textContent]))===JSON.stringify(options),currentKeys)&&await page.$eval('.back',(e,id)=>e.getAttribute('href')===`/projects/${id}`,project.id));
  page.off('request',holdFirstKeys);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/tasks-metadata-repeat-project-full.png',fullPage:true});
  await page.select('[aria-label="Filter by assignee"]','');await page.waitForSelector('.task-row');
  await page.type('[name=taskTitle]','Unsaved task draft');
  const currentTask=(await call(`${P}/tasks`,null,token)).find(task=>task.title==='Actual task recovery');await call(`${P}/tasks/${currentTask.id}`,{title:'Fresh task after change'},token,'PATCH');
  let refreshReads=0,metadataReads=0,refreshHeld=false,releaseRefresh;const refreshGate=new Promise(r=>releaseRefresh=r);await page.setRequestInterception(true);
  const holdRefresh=async req=>{const path=new URL(req.url()).pathname;if([`${P}/members`,`${P}/groups`,`${P}/keys`].some(p=>path===`/api${p}`))metadataReads++;if(path===`/api${P}/tasks`){refreshReads++;refreshHeld=true;await refreshGate;}return req.continue();};page.on('request',holdRefresh);
  await page.click('[name=refreshTaskList]');await page.waitForSelector('[name=taskListLoading]');if(!refreshHeld)throw new Error('task refresh not held');await page.click('[name=refreshTaskList]');await new Promise(r=>setTimeout(r,100));
  check('held task refresh suppresses duplicate reads and preserves unsaved draft',refreshReads===1&&metadataReads===0&&await page.$eval('[name=refreshTaskList]',e=>e.disabled)&&await page.$eval('[name=taskTitle]',e=>e.value==='Unsaved task draft')&&!(await page.$('.task-row'))&&!(await page.$('[name=taskListEmpty]')));
  releaseRefresh();await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  check('explicit task refresh shows changed real task with same filter and no metadata reload',refreshReads===1&&metadataReads===0&&await page.$$eval('.task-row',rows=>rows.length===1&&rows[0].textContent.includes('Fresh task after change'))&&await page.$eval('[aria-label="Filter by status"]',e=>e.value==='OPEN')&&await page.$eval('[name=taskTitle]',e=>e.value==='Unsaved task draft'));
  page.off('request',holdRefresh);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/tasks-refresh-full.png',fullPage:true});
  let creates=0,createHeld=false,releaseCreate;const createGate=new Promise(r=>releaseCreate=r);await page.setRequestInterception(true);
  const holdCreate=async req=>{if(new URL(req.url()).pathname===`/api${P}/tasks`&&req.method()==='POST'){creates++;createHeld=true;await createGate;}return req.continue();};page.on('request',holdCreate);
  await page.click('.task-form button[type=submit]');await page.waitForSelector('[name=taskCreating]');if(!createHeld)throw new Error('create not held');await page.click('.task-form button[type=submit]');await new Promise(r=>setTimeout(r,100));
  check('held task creation suppresses duplicate pointer submit and announces pending',creates===1&&await page.$eval('.task-form button[type=submit]',e=>e.disabled)&&await page.$eval('.task-form',e=>e.getAttribute('aria-busy')==='true'));
  await route(next.id);await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');await page.type('[name=taskTitle]','New project unsaved draft');
  const created=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===`/api${P}/tasks`);releaseCreate();await created;await new Promise(r=>setTimeout(r,150));
  const persisted=await call(`${P}/tasks`,null,token);
  check('late actual task creation persists once only in old project without clearing new draft',persisted.filter(t=>t.title==='Unsaved task draft').length===1&&await page.$eval('[name=taskTitle]',e=>e.value==='New project unsaved draft')&&await page.$eval('.task-list',e=>e.textContent.includes('Current project task')&&!e.textContent.includes('Unsaved task draft'))&&!(await page.$('[name=taskCreating]'))&&!await page.$eval('.task-form button[type=submit]',e=>e.disabled));
  page.off('request',holdCreate);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/tasks-create-route-fence-full.png',fullPage:true});
  let failedCreates=0;await page.setRequestInterception(true);
  const failCreate=req=>{if(new URL(req.url()).pathname===`/api/projects/${next.id}/tasks`&&req.method()==='POST'){failedCreates++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-create-detail'})});}return req.continue();};page.on('request',failCreate);
  await page.click('.task-form button[type=submit]');await page.waitForFunction(()=>document.querySelector('[role=alert]')?.textContent.includes('Check the task list before trying again.'));await page.waitForFunction(()=>document.querySelector('.task-form')?.getAttribute('aria-busy')==='false');
  check('actual rejected task create retains draft and shows fixed guidance without raw detail',failedCreates===1&&await page.$eval('[name=taskTitle]',e=>e.value==='New project unsaved draft')&&!(await page.content()).includes('private-create-detail')&&!(await page.$('[name=taskCreating]'))&&!await page.$eval('.task-form button[type=submit]',e=>e.disabled));
  await new Promise(r=>setTimeout(r,200));const currentTasks=await call(`/projects/${next.id}/tasks`,null,token);
  check('rejected task create has no resend during observation and leaves persisted task list unchanged',failedCreates===1&&currentTasks.length===1&&currentTasks[0].title==='Current project task'&&await page.$eval('.task-list',e=>e.textContent.includes('Current project task')&&!e.textContent.includes('New project unsaved draft')));
  page.off('request',failCreate);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/tasks-create-failure-full.png',fullPage:true});
  console.log(failures?'TASKS BROWSER CHECKS FAILED':'ALL TASKS BROWSER CHECKS PASSED');process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
finally {
  await browser?.close();
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
