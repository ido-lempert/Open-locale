// Real local browser -> Task due-date fallback -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.TASK_BROWSER_TEST_PG_PORT ?? 56262), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-snapshot-ready-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('snapshot_ready_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/snapshot_ready_browser`;
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

  for(const title of ['Malformed date','No date','Valid date'])await call(`${P}/tasks`,{title,dueDate:'2026-12-12T23:59:59.123Z'},token);
  let reads=0,writes=0,damaged=true;const invalid='<img src=x onerror=fail>-'+'X'.repeat(300);
  await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path===`/api${P}/tasks`&&req.method()==='GET'){reads++;const data=await call(`${P}/tasks`,null,token);return req.respond({status:200,contentType:'application/json',body:JSON.stringify(damaged?data.map(t=>t.title==='Malformed date'?{...t,dueDate:invalid}:t.title==='No date'?{...t,dueDate:null}:t):data)});}if(['POST','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});
  await page.emulateTimezone('America/Los_Angeles');await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=taskDueDate]');await page.type('[name=taskTitle]','Keep local draft');
  check('malformed due date preserves every loaded row with fixed fallback and no invalid datetime',await page.$$eval('.task-row',es=>es.length===4)&&await page.$$eval('[name=taskDueDate]',es=>es.length===2&&es.some(e=>e.textContent==='Due date unavailable'&&!e.hasAttribute('datetime'))&&es.some(e=>e.textContent==='due Dec 12, 2026 (UTC)'&&e.getAttribute('datetime')==='2026-12-12T23:59:59.123Z')));
  check('null due dates remain absent and raw malformed payload is not rendered',await page.$eval('.task-list',e=>!e.querySelector('img'))&&!(await page.content()).includes(invalid)&&reads===1&&writes===0);
  await page.$eval('[name=taskDueDate]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/tasks-date-fallback-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=taskDueDate]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/tasks-date-fallback-mobile.png'});check('390px fallback fits without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.select('[name=taskOrder]','due');check('ordering remains local with invalid and absent dates after valid date',await page.$$eval('.task-row',es=>es[0].textContent.includes('Valid date'))&&reads===1&&writes===0&&await page.$eval('[name=taskTitle]',e=>e.value==='Keep local draft'));
  damaged=false;await page.$eval('[name=refreshTaskList]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=refreshTaskList]');await page.waitForFunction(()=>!document.querySelector('[name=taskListLoading]')&&document.querySelectorAll('[name=taskDueDate]').length===3);check('explicit reread recovers valid UTC labels without writes or draft loss',reads===2&&writes===0&&await page.$$eval('[name=taskDueDate]',es=>es.every(e=>e.textContent==='due Dec 12, 2026 (UTC)'))&&await page.$eval('[name=taskTitle]',e=>e.value==='Keep local draft'));
  check('no date-pipe or task runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;
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
process.exit(!completed||failures?1:0);
