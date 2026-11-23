// Real local browser -> Tasks screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56152, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-task-receipt-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('task_receipt_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/task_receipt_browser`;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  const task=await call(`${P}/tasks`,{title:'Loaded title',description:'Stored description',dueDate:'2026-12-12T17:45:00.123Z'},token),other=await call(`${P}/tasks`,{title:'Other task'},token);
  await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Edit details for Loaded title"]');await page.type('[name=taskTitle]','UNSENT NEW TASK');
  let writes=0,reads=0,posts=0;const sent=[];
  page.on('request',req=>{const p=new URL(req.url()).pathname;if(req.method()==='PATCH'&&p.includes('/tasks/')){writes++;sent.push({path:p,body:JSON.parse(req.postData())});}if(req.method()==='GET'&&p===`/api${P}/tasks`)reads++;if(req.method()==='POST'&&p===`/api${P}/tasks`)posts++;});
  const click=async selector=>{const button=await page.$(selector);if(!button)throw new Error('Missing button '+selector);await button.evaluate(e=>e.scrollIntoView({block:'center'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await button.click();};
  const fill=async(selector,value)=>{await page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  const open=async title=>{await click(`[aria-label="Edit details for ${title}"]`);await page.waitForSelector('[name=editTaskTitle]');await page.waitForFunction(()=>document.activeElement?.getAttribute('name')==='editTaskTitle');};
  await open('Loaded title');
  check('open loads exact title description and project task identity without request',writes===0&&reads===0&&await page.$eval('[name=editTaskTitle]',e=>e.value==='Loaded title')&&await page.$eval('[name=editTaskDescription]',e=>e.value==='Stored description')&&await page.$eval('[name=taskDetailsScope]',(e,ids)=>ids.every(id=>e.textContent.includes(id)),[project.id,task.id]));
  check('scope labels local not autosaved text and unrelated fields',await page.$eval('[name=taskDetailsScope]',e=>e.textContent.includes('Status, assignments, dependencies and locks are not sent')&&e.textContent.includes('not saved automatically'))&&await page.$eval('[name=saveTaskDetails]',e=>e.disabled));
  await fill('[name=editTaskTitle]','x'.repeat(201));await fill('[name=editTaskDescription]','Private local description');await page.waitForSelector('[name=taskDetailsInvalid]');await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-tasks')).saveDetails());
  check('invalid text retained and direct save does not write',writes===0&&await page.$eval('[name=editTaskTitle]',e=>e.value.length===201)&&await page.$eval('[name=saveTaskDetails]',e=>e.disabled));
  await fill('[name=editTaskTitle]','  Edited title  ');await fill('[name=editTaskDescription]','  Edited <markup> description  ');await page.$eval('[name=editTaskTitle]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/task-due-date-edit-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[aria-label="Edit loaded task details"]',e=>e.scrollIntoView({block:'start'}));await page.evaluate(()=>window.scrollBy(0,-110));await page.screenshot({path:'/downloads/task-due-date-edit-mobile.png'});await page.$eval('[name=saveTaskDetails]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/task-due-date-edit-mobile-bottom.png'});
  check('390px local editor inputs fit their panel width',await page.$eval('[aria-label="Edit loaded task details"]',e=>e.scrollWidth<=e.clientWidth&&[...e.querySelectorAll('input,textarea')].every(x=>x.getBoundingClientRect().right<=innerWidth)));
  await click('[name=cancelTaskDetails]');await page.waitForFunction(()=>!document.querySelector('[name=editTaskTitle]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-tasks')).saveDetails());
  check('close discards only edit text without requests and keeps new-task draft',writes===0&&reads===0&&!await page.$('[name=editTaskTitle]')&&await page.$eval('[name=taskTitle]',e=>e.value==='UNSENT NEW TASK'));
  await page.setViewport({width:1280,height:900});await open('Loaded title');await fill('[name=editTaskTitle]','Stale retained title');await click('[name=refreshTaskList]');await page.waitForSelector('[name=taskDetailsStale]');await page.waitForFunction(()=>!document.querySelector('[name=taskListLoading]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-tasks')).saveDetails());
  check('real list refresh retains edit text but rejects stale save',writes===0&&reads===1&&await page.$eval('[name=editTaskTitle]',e=>e.value==='Stale retained title')&&await page.$eval('[name=saveTaskDetails]',e=>e.disabled));
  await click('[name=cancelTaskDetails]');await open('Loaded title');await fill('[name=editTaskTitle]',' Edited title ');await fill('[name=editTaskDescription]',' Edited <markup> description ');
  let mode='hold',held;await page.setRequestInterception(true);page.on('request',req=>{const p=new URL(req.url()).pathname;if(req.method()==='PATCH'&&p===`/api${P}/tasks/${task.id}`){if(mode==='hold'){held=req;return;}if(mode==='fail')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_FAILURE'})});}if(mode==='read-fail'&&req.method()==='GET'&&p===`/api${P}/tasks`)return req.respond({status:503,contentType:'application/json',body:'{}'});return req.continue();});
  await click('[name=saveTaskDetails]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Save not held');await page.waitForSelector('[name=taskDetailsSaving]');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));c.closeDetails();await c.saveDetails();});
  check('pending real PATCH blocks duplicate save close and text changes',writes===1&&await page.$eval('[name=editTaskTitle]',e=>e.disabled)&&await page.$eval('[name=cancelTaskDetails]',e=>e.disabled)&&await page.$eval('[name=saveTaskDetails]',e=>e.disabled)&&!await page.$('[name=taskDetailsStale]'));
  mode='live';await held.continue();held=null;await page.waitForSelector('[aria-label="Edit details for Edited title"]');await page.waitForFunction(()=>!document.querySelector('[name=editTaskTitle]')&&!document.querySelector('[name=taskListLoading]'));
  let stored=(await call(`${P}/tasks`,null,token)).find(t=>t.id===task.id);
  check('explicit save persists only exact trimmed title description through real API',writes===1&&sent[0].path===`/api${P}/tasks/${task.id}`&&JSON.stringify(sent[0].body)===JSON.stringify({title:'Edited title',description:'Edited <markup> description'})&&stored.title==='Edited title'&&stored.description==='Edited <markup> description'&&stored.dueDate===task.dueDate&&stored.status===task.status);
  check('confirmed save keeps unrelated task and local new-task form',posts===0&&(await call(`${P}/tasks`,null,token)).some(t=>t.id===other.id)&&await page.$eval('[name=taskTitle]',e=>e.value==='UNSENT NEW TASK')&&await page.$eval('[name=taskActionNotice]',e=>e.textContent.includes('details were updated')));
  await open('Edited title');await fill('[name=editTaskDescription]','');await click('[name=saveTaskDetails]');await page.waitForFunction(()=>!document.querySelector('[name=editTaskTitle]')&&!document.querySelector('[name=taskListLoading]'));stored=(await call(`${P}/tasks`,null,token)).find(t=>t.id===task.id);
  check('empty description explicitly clears server description without changing title',writes===2&&stored.title==='Edited title'&&stored.description==='');
  await open('Edited title');check('date editor loads UTC calendar day',await page.$eval('[name=editTaskDueDate]',e=>e.value==='2026-12-12'));await fill('[name=editTaskDueDate]','2027-02-28');await click('[name=saveTaskDetails]');await page.waitForFunction(()=>!document.querySelector('[name=editTaskTitle]')&&!document.querySelector('[name=taskListLoading]'));stored=(await call(`${P}/tasks`,null,token)).find(t=>t.id===task.id);
  check('explicit date save persists midnight UTC only when changed',writes===3&&sent[2].body.dueDate==='2027-02-28T00:00:00.000Z'&&stored.dueDate==='2027-02-28T00:00:00.000Z');
  await open('Edited title');await fill('[name=editTaskDueDate]','');await click('[name=saveTaskDetails]');await page.waitForFunction(()=>!document.querySelector('[name=editTaskTitle]')&&!document.querySelector('[name=taskListLoading]'));stored=(await call(`${P}/tasks`,null,token)).find(t=>t.id===task.id);
  check('empty date explicitly clears server due date',writes===4&&sent[3].body.dueDate===null&&stored.dueDate===null);
  await open('Edited title');await fill('[name=editTaskTitle]','Failed retained title');mode='fail';await click('[name=saveTaskDetails]');await page.waitForSelector('[name=taskActionUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=taskDetailsSaving]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-tasks')).saveDetails());
  check('real failed PATCH keeps edit text pauses retry and hides private error',writes===5&&await page.$eval('[name=editTaskTitle]',e=>e.value==='Failed retained title')&&await page.$eval('[name=saveTaskDetails]',e=>e.disabled)&&!(await page.content()).includes('PRIVATE_FAILURE'));
  mode='live';await click('[name=recoverTaskActions]');await page.waitForFunction(()=>!document.querySelector('[name=taskActionUnknown]')&&!document.querySelector('[name=taskListLoading]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-tasks')).saveDetails());
  check('explicit recovery reads server but does not replay stale edit',writes===5&&await page.$('[name=taskDetailsStale]')&&await page.$eval('[name=editTaskTitle]',e=>e.value==='Failed retained title')&&(await call(`${P}/tasks`,null,token)).find(t=>t.id===task.id).title==='Edited title');
  await click('[name=cancelTaskDetails]');await open('Edited title');await fill('[name=editTaskTitle]','Confirmed despite read failure');mode='read-fail';await click('[name=saveTaskDetails]');await page.waitForSelector('[name=taskListError]');
  check('successful PATCH plus failed follow-up read stays confirmed without keeping a retryable editor',writes===6&&!await page.$('[name=editTaskTitle]')&&!await page.$('[name=taskActionUnknown]')&&await page.$eval('[name=taskActionNotice]',e=>e.textContent.includes('were updated'))&&(await call(`${P}/tasks`,null,token)).find(t=>t.id===task.id).title==='Confirmed despite read failure');
  mode='live';await click('[name=retryTaskList]');await page.waitForSelector('[aria-label="Edit details for Confirmed despite read failure"]');await page.$eval('[name=taskActionNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/task-due-date-edit-result.png'});await page.$eval('[aria-label="Edit details for Confirmed despite read failure"]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/task-due-date-edit-result-row.png'});
  check('no task details runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(failures?1:0);
