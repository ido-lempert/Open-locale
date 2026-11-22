// Real local browser -> Tasks screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56140, WEB_PORT = 4200, API_PORT = 3000;
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
  await call(`${P}/tasks`,{title:'Actual task recovery'},token);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  const task=await call(`${P}/tasks`,{title:'Delete candidate'},token),other=await call(`${P}/tasks`,{title:'Keep other task'},token);
  const next=await call('/projects',{name:'Other project',slug:'other-project',locales:['en']},token);
  await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Delete task Delete candidate"]');await page.type('[name=taskTitle]','Local new-task draft');
  let writes=0,reads=0,deletePath='';page.on('request',req=>{const p=new URL(req.url()).pathname;if(req.method()==='DELETE'&&p.includes('/tasks/')){writes++;deletePath=p;}if(req.method()==='GET'&&p===`/api${P}/tasks`)reads++;});
  const ask=async()=>{await page.click('[aria-label="Delete task Delete candidate"]');await page.waitForSelector('[name=confirmTaskDelete]');};
  await ask();
  check('first delete click only reviews loaded exact project task ID and title',writes===0&&reads===0&&await page.$eval('[name=taskDeleteProjectId]',e=>e.textContent)===project.id&&await page.$eval('[name=taskDeleteId]',e=>e.textContent)===task.id&&await page.$eval('[name=taskDeleteTitle]',e=>e.textContent)==='Delete candidate');
  check('confirmation labels loaded identity and incomplete impact review',await page.$eval('[name=taskDeleteScope]',e=>e.textContent.includes('not a fresh permission check or newer server state')&&e.textContent.includes('No deletion has run'))&&await page.$eval('[aria-label="Confirm task deletion"]',e=>e.textContent.includes('Linked-task and lock effects are not previewed here')));
  await page.screenshot({path:'/downloads/task-delete-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/task-delete-confirm-mobile.png'});
  check('390px confirmation fits with both choices reachable',await page.evaluate(()=>{const e=document.querySelector('[aria-label="Confirm task deletion"]'),r=e.getBoundingClientRect(),b=document.querySelector('[name=cancelTaskDelete]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth&&b.bottom<=r.bottom;}));
  await page.click('[name=cancelTaskDelete]');await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-tasks')).confirmRemove());
  check('cancel and stale confirmation send no write or read and retain draft and task',writes===0&&reads===0&&await page.$eval('[name=taskTitle]',e=>e.value==='Local new-task draft')&&(await call(`${P}/tasks`,null,token)).some(t=>t.id===task.id));
  await ask();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));window.capturedTaskDelete=c.pendingTaskDelete();});await page.$eval('[name=refreshTaskList]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=taskListLoading]')&&!document.querySelector('[name=confirmTaskDelete]'));
  await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));c.pendingTaskDelete.set(window.capturedTaskDelete);await c.confirmRemove();});
  check('new actual list invalidates even restored captured confirmation',writes===0&&reads===1&&!await page.$('[name=confirmTaskDelete]'));
  await ask();const route=async id=>page.evaluate(id=>{history.pushState({},'',`/projects/${id}/tasks`);window.dispatchEvent(new PopStateEvent('popstate'));},id);
  await route(next.id);await page.waitForSelector('[name=taskListEmpty]');await route(project.id);await page.waitForSelector('[aria-label="Delete task Delete candidate"]');
  await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));c.pendingTaskDelete.set(window.capturedTaskDelete);await c.confirmRemove();});
  check('repeated project visit rejects old captured delete without write',writes===0&&!await page.$('[name=confirmTaskDelete]'));
  await page.type('[name=taskTitle]','Current visit draft');await ask();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-tasks')),p=c.pendingTaskDelete();c.pendingTaskDelete.set({...p,projectId:'<img onerror=fail>-'+'P'.repeat(160),id:'<img onerror=fail>-'+'I'.repeat(160),title:'<img onerror=fail>-'+'T'.repeat(180)});});
  await page.screenshot({path:'/downloads/task-delete-confirm-long-mobile.png'});
  check('long markup-like identity stays escaped and wraps',await page.$eval('[aria-label="Confirm task deletion"]',e=>!e.querySelector('img')&&e.textContent.includes('<img onerror=fail>')&&e.scrollWidth<=e.clientWidth));
  await page.$eval('[aria-label="Confirm task deletion"]',e=>e.scrollTop=e.scrollHeight);await page.click('[name=cancelTaskDelete]');check('long fixture canceled without deletion',writes===0);
  await page.setViewport({width:1280,height:900});await ask();await page.click('[name=confirmTaskDelete]');await page.waitForFunction(()=>!document.querySelector('[aria-label="Delete task Delete candidate"]')&&!document.querySelector('[name=taskListLoading]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-tasks')).confirmRemove());
  const remaining=await call(`${P}/tasks`,null,token);
  check('explicit confirmation deletes exact reviewed task once and keeps other task',writes===1&&deletePath===`/api${P}/tasks/${task.id}`&&!remaining.some(t=>t.id===task.id)&&remaining.some(t=>t.id===other.id));
  check('confirmed deletion preserves local new-task form and existing receipt',await page.$eval('[name=taskTitle]',e=>e.value==='Current visit draft')&&await page.$eval('[name=taskActionNotice]',e=>e.textContent.includes('was deleted')));
  await page.screenshot({path:'/downloads/task-delete-confirm-result.png'});check('no task deletion confirmation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
