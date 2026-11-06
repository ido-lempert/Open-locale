// Real local browser -> Tasks screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55676, WEB_PORT = 4200, API_PORT = 3000;
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

  const task=await call(`${P}/tasks`,{title:'Current task'},token);await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Status for Current task"]');let writes=0,reads=0,failRead=false;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/tasks`){reads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:'{}'});}if(['PATCH','DELETE'].includes(req.method())&&path===`/api${P}/tasks/${task.id}`){writes++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}req.continue();});
  await page.type('[name=taskTitle]','Keep draft');await page.select('[aria-label="Status for Current task"]','DONE');await page.waitForSelector('[name=taskActionUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=taskUpdating]'));await page.click('[aria-label="Delete task Current task"]');check('unknown update blocks delete replay without automatic read',writes===1&&reads===0&&await page.$eval('[aria-label="Status for Current task"]',e=>e.disabled)&&!(await page.content()).includes('PRIVATE')&&(await call(`${P}/tasks`,null,token)).find(t=>t.id===task.id)?.status==='OPEN');
  await page.select('[aria-label="Filter by status"]','DONE');await page.waitForSelector('[name=taskListEmpty]');check('successful filtered empty read keeps replay paused',reads===1&&!!await page.$('[name=taskActionUnknown]'));failRead=true;await page.click('[name=recoverTaskActions]');await page.waitForSelector('[name=retryTaskList]');check('failed explicit all-task read keeps block and clears filters',reads===2&&!!await page.$('[name=taskActionUnknown]')&&await page.$eval('[aria-label="Filter by status"]',e=>e.value===''));await page.screenshot({path:'/downloads/task-action-unknown.png',fullPage:false});failRead=false;await page.click('[name=recoverTaskActions]');await page.waitForFunction(()=>!document.querySelector('[name=taskActionUnknown]'));check('successful explicit all-task recovery unlocks without replay and retains draft',reads===3&&writes===1&&await page.$eval('[name=taskTitle]',e=>e.value==='Keep draft')&&!await page.$eval('[aria-label="Delete task Current task"]',e=>e.disabled));
  await page.click('[aria-label="Delete task Current task"]');await page.waitForSelector('[name=taskActionUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=taskDeleting]'));await page.select('[aria-label="Status for Current task"]','DONE');check('unknown delete blocks update replay without automatic read',writes===2&&reads===3&&await page.$eval('[aria-label="Delete task Current task"]',e=>e.disabled)&&(await call(`${P}/tasks`,null,token)).some(t=>t.id===task.id));await page.click('[name=recoverTaskActions]');await page.waitForFunction(()=>!document.querySelector('[name=taskActionUnknown]'));check('delete explicit recovery uses only read',writes===2&&reads===4&&!await page.$eval('[aria-label="Status for Current task"]',e=>e.disabled));
  await page.evaluate(()=>{window.tc=ng.getComponent(document.querySelector('ol-tasks'));window.tr=window.tc.tasks().find(t=>t.title==='Current task');});
  let heldWrite,heldRead,hold=true;page.removeAllListeners('request');page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='PATCH'&&path===`/api${P}/tasks/${task.id}`){writes++;heldWrite=req;return;}if(req.method()==='GET'&&path===`/api${P}/tasks`){reads++;if(hold){heldRead=req;return;}}req.continue();});
  await page.select('[aria-label="Status for Current task"]','DONE');await page.waitForSelector('[name=taskUpdating]');await page.evaluate(()=>{void window.tc.fetch(true);});await page.waitForSelector('[name=taskListLoading]');for(let n=0;n<100&&(!heldRead||!heldWrite);n++)await new Promise(r=>setTimeout(r,20));await heldWrite.respond({status:503,contentType:'application/json',body:'{}'});await page.waitForSelector('[name=taskActionUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=taskUpdating]'));await heldRead.continue();await page.waitForFunction(()=>!document.querySelector('[name=taskListLoading]'));check('real read begun during pending write cannot clear later unknown result',writes===3&&reads===5&&!!await page.$('[name=taskActionUnknown]'));await page.evaluate(async()=>{await window.tc.update(window.tr,{status:'DONE'});await window.tc.remove(window.tr);});check('captured old handlers cannot bypass unknown replay guard',writes===3);hold=false;await page.click('[name=recoverTaskActions]');await page.waitForFunction(()=>!document.querySelector('[name=taskActionUnknown]'));check('later explicit unfiltered read unlocks pending-read uncertainty without replay',writes===3&&reads===6&&!await page.$eval('[aria-label="Status for Current task"]',e=>e.disabled));
  check('no task row runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
