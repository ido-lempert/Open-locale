// Real local browser -> Tasks screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55706, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tasks-receipt-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('tasks_receipt_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/tasks_receipt_browser`;
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

  await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForSelector('.task-row');await page.waitForFunction(()=>document.querySelector('[name=taskAssignee]')?.options.length>1&&document.querySelector('[name=taskLockKeys]')?.options.length>0);const assignee=await page.$eval('[name=taskAssignee]',e=>e.options[1].value),key=await page.$eval('[name=taskLockKeys]',e=>e.options[0].value),predecessor=await page.$eval('[name=taskDependsOn]',e=>e.options[1].value);
  await page.type('[name=taskTitle]','Committed unseen task');await page.type('[name=taskDescription]','Keep context');await page.$eval('[name=taskDue]',e=>{e.value='2027-01-01';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.select('[name=taskAssignee]',assignee);await page.select('[name=taskDependsOn]',predecessor);await page.select('[name=taskLockKeys]',key);await page.click('[name=taskLockToggle]');await page.select('[aria-label="Filter by status"]','DONE');await page.waitForSelector('[name=taskListEmpty]');await page.type('[name=taskSearch]','hidden');
  const form=()=>page.evaluate(()=>['taskTitle','taskDescription','taskDue','taskAssignee','taskDependsOn','taskLockKeys','taskLockToggle'].map(n=>{const e=document.querySelector(`[name=${n}]`);return e.type==='checkbox'?e.checked:e.multiple?[...e.selectedOptions].map(o=>o.value):e.value;}));const draft=await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));return [c.title(),c.description(),c.dueDate(),c.assigneeId(),c.dependsOnId(),c.selectedKeyIds(),c.lockKeys()];});const model=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));return [c.title(),c.description(),c.dueDate(),c.assigneeId(),c.dependsOnId(),c.selectedKeyIds(),c.lockKeys()];});let posts=0,reads=0,patches=0,drop=true,failRead=false,committed=false;await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path===`/api${P}/tasks`&&req.method()==='POST'){posts++;if(drop){const r=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('forwarded task create failed');await r.json();committed=true;return req.abort('failed');}}if(path.startsWith(`/api${P}/tasks/`)&&req.method()==='PATCH')patches++;if(path===`/api${P}/tasks`&&req.method()==='GET'){reads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}req.continue();});
  await page.click('.task-form button[type=submit]');await page.waitForSelector('[name=taskCreateUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=taskCreating]')&&document.querySelector('.task-form button[type=submit]')?.disabled);const all=await call(`${P}/tasks`,null,token),saved=all.filter(t=>t.title==='Committed unseen task');check('real task committed then response lost with whole form kept, no read or success receipt',committed&&posts===1&&reads===0&&saved.length===1&&saved[0].description==='Keep context'&&saved[0].dueDate.startsWith('2027-01-01')&&saved[0].lockKeys&&saved[0].keys.some(k=>k.keyId===draft[5][0]||k.key?.id===draft[5][0])&&JSON.stringify(await model())===JSON.stringify(draft)&&await page.$eval('[name=taskDependsOn]',e=>e.selectedOptions[0]?.textContent==='Selected predecessor outside list')&&!await page.$('[name=taskCreateNotice]'));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).create());await page.$eval('.task-form',e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check('captured and DOM task creation cannot replay',posts===1&&reads===0);
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).error.set('Independent row error'));await page.waitForFunction(()=>[...document.querySelectorAll('[role=alert]')].some(e=>e.textContent==='Independent row error'));check('independent error stays visible alongside unknown creation',!!await page.$('[name=taskCreateUnknown]'));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).error.set('Task creation failed. Check the task list before trying again.'));
  await page.screenshot({path:'/downloads/tasks-create-unknown-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/tasks-create-unknown-mobile.png',fullPage:true});check('narrow task recovery view has no horizontal overflow or raw detail',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&!(await page.content()).includes('PRIVATE'));
  await page.click('[name=clearTaskSearch]');await page.select('[aria-label="Filter by status"]','');await page.waitForSelector('[aria-label="Status for Actual task recovery"]');check('ordinary unfiltered read shows committed task but cannot unlock creation',reads===1&&await page.$eval('.task-list',e=>e.textContent.includes('Committed unseen task'))&&!!await page.$('[name=taskCreateUnknown]')&&await page.$eval('.task-form button[type=submit]',e=>e.disabled));await page.select('[aria-label="Status for Actual task recovery"]','IN_PROGRESS');await page.waitForFunction(()=>!document.querySelector('[name=taskUpdating]')&&!document.querySelector('[name=taskListLoading]')&&!!document.querySelector('[name=taskActionNotice]'));check('independent task row update remains usable while create paused',patches===1&&!!await page.$('[name=taskCreateUnknown]')&&await page.$eval('.task-form button[type=submit]',e=>e.disabled));
  await page.select('[aria-label="Filter by status"]','DONE');await page.waitForFunction(()=>!document.querySelector('[name=taskListLoading]')&&!!document.querySelector('[name=taskListEmpty]'));await page.type('[name=taskSearch]','hidden');failRead=true;await page.waitForFunction(()=>!document.querySelector('[name=recoverTaskActions]')?.disabled);await page.$eval('[name=recoverTaskActions]',e=>e.click());await page.waitForSelector('[name=taskListError]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).create());check('failed all-task read clears filters/search but keeps creation paused without replay',posts===1&&await page.$eval('[aria-label="Filter by status"]',e=>e.value==='')&&await page.$eval('[name=taskSearch]',e=>e.value==='')&&!!await page.$('[name=taskCreateUnknown]')&&await page.$eval('.task-form button[type=submit]',e=>e.disabled));
  failRead=false;await page.waitForFunction(()=>!document.querySelector('[name=recoverTaskActions]')?.disabled);await page.$eval('[name=recoverTaskActions]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=taskCreateUnknown]')&&!document.querySelector('[name=taskListLoading]')&&document.querySelector('.task-list')?.textContent.includes('Committed unseen task'));check('successful explicit all-task recovery preserves whole form and discovers committed task without replay',posts===1&&JSON.stringify(await model())===JSON.stringify(draft)&&!await page.$eval('.task-form button[type=submit]',e=>e.disabled));
  await page.$eval('[name=taskTitle]',e=>{e.value='Explicit next task';e.dispatchEvent(new Event('input',{bubbles:true}));});drop=false;await page.click('.task-form button[type=submit]');await page.waitForFunction(()=>document.querySelector('[name=taskCreateNotice]')?.textContent.includes('Explicit next task')&&!document.querySelector('[name=taskCreating]'));const final=await call(`${P}/tasks`,null,token);check('explicit next distinct task creates once with no duplicate original',posts===2&&final.filter(t=>t.title==='Committed unseen task').length===1&&final.filter(t=>t.title==='Explicit next task').length===1);
  check('no task create unknown runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
