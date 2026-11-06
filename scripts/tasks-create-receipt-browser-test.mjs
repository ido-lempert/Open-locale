// Real local browser -> Tasks screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55640, WEB_PORT = 4200, API_PORT = 3000;
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

  await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForSelector('.task-row');await page.select('[aria-label="Filter by status"]','DONE');await page.waitForSelector('[name=taskListEmpty]');
  let held,posts=0,reads=0,failReads=false;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname===`/api${P}/tasks`){if(req.method()==='POST'){posts++;held=req;return;}if(req.method()==='GET'){reads++;if(failReads)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_TASK_READ'})});}}req.continue();});
  await page.type('[name=taskTitle]','Created off-filter');await page.click('.task-form button[type=submit]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('create not held');await page.waitForSelector('[name=taskCreating]');await page.$eval('[name=taskTitle]',e=>{e.value='Newer task draft';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.$eval('.task-form',e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check('held create guards duplicate while newer title remains editable',posts===1&&await page.$eval('.task-form button[type=submit]',e=>e.disabled));failReads=true;await held.continue();held=null;await page.waitForSelector('[name=taskListError]');await page.waitForSelector('[name=taskCreateNotice]');await page.waitForFunction(()=>!document.querySelector('[name=taskCreating]'));check('confirmed receipt survives failed filtered refresh with newer draft',await page.$eval('[name=taskCreateNotice]',e=>e.textContent.includes('Task "Created off-filter" was created.')&&e.textContent.includes('without creating the task again'))&&await page.$eval('[name=taskTitle]',e=>e.value==='Newer task draft')&&await page.$eval('[aria-label="Filter by status"]',e=>e.value==='DONE')&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));await page.screenshot({path:'/downloads/tasks-create-receipt-read-error.png',fullPage:false});
  failReads=false;await page.click('[name=retryTaskList]');await page.waitForSelector('[name=taskListEmpty]');const all=await call(`${P}/tasks`,null,token);check('read-only retry retains confirmed receipt and hidden-filter truth with one persisted create',posts===1&&reads===2&&all.filter(t=>t.title==='Created off-filter').length===1&&!!await page.$('[name=taskCreateNotice]')&&await page.$eval('[name=taskListEmpty]',e=>e.textContent==='No tasks match these filters'));await page.screenshot({path:'/downloads/tasks-create-receipt-filtered.png',fullPage:false});await page.select('[aria-label="Filter by status"]','');await page.waitForFunction(()=>document.querySelector('.task-list')?.textContent.includes('Created off-filter'));check('clearing filter reveals original created task without resubmission',posts===1&&await page.$eval('[name=taskTitle]',e=>e.value==='Newer task draft'));
  check('no task receipt runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
