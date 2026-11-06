// Real local browser -> Tasks option recovery -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55682, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-list-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_list_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_list_browser`;
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


  await call(`${P}/tasks`,{title:'Persisted task'},token);
  await call(`${P}/groups`,{name:'Real translators',role:'MEMBER',allowedLocales:['he']},token);
  const key=await call(`${P}/keys`,{name:'real.lock.key'},token);
  const reads={members:0,groups:0,keys:0,tasks:0};let writes=0;
  const failing=new Set(['members','groups','keys']);let held;
  await page.setRequestInterception(true);
  page.on('request',req=>{const path=new URL(req.url()).pathname;const kind=Object.keys(reads).find(k=>path===`/api${P}/${k}`);if(req.method()!=='GET')writes++;if(kind&&req.method()==='GET'){reads[kind]++;if(failing.has(kind))return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE-OPTIONS'})});if(kind==='members'){held=req;return;}}req.continue();});
  await page.goto(`${WEB}/projects/${project.id}/tasks`,{waitUntil:'networkidle0'});
  await page.waitForSelector('[name=taskMembersError]');await page.waitForSelector('[name=taskGroupsError]');await page.waitForSelector('[name=taskKeysError]');await page.waitForSelector('.task-row');
  check('option failures are explicit while real tasks remain usable',reads.members===1&&reads.groups===1&&reads.keys===1&&reads.tasks===1&&await page.$eval('.task-row',e=>e.textContent.includes('Persisted task'))&&!(await page.content()).includes('PRIVATE-OPTIONS'));
  await page.screenshot({path:'/downloads/tasks-options-failed.png',fullPage:true});
  await page.type('[name=taskTitle]','Keep draft');await page.type('[name=taskDescription]','Keep details');await page.select('[aria-label="Filter by status"]','OPEN');await page.waitForSelector('.task-row');const taskReads=reads.tasks;
  failing.delete('members');await page.click('[name=retryTaskMembers]');await page.waitForSelector('[name=taskMembersLoading]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).loadMembers());
  check('held assignee retry guards duplicate and leaves sibling errors/task rows',reads.members===2&&reads.groups===1&&reads.keys===1&&reads.tasks===taskReads&&!!await page.$('[name=taskGroupsError]')&&!!await page.$('[name=taskKeysError]')&&!!await page.$('.task-row'));
  await held.continue();await page.waitForFunction(()=>!document.querySelector('[name=taskMembersLoading]'));
  check('real member options recover without resetting draft or filter',!await page.$('[name=taskMembersError]')&&await page.$eval('[name=taskAssignee]',e=>[...e.options].some(o=>o.textContent==='Owner'))&&await page.$eval('[name=taskTitle]',e=>e.value==='Keep draft')&&await page.$eval('[name=taskDescription]',e=>e.value==='Keep details')&&await page.$eval('[aria-label="Filter by status"]',e=>e.value==='OPEN'));
  const failedGroupResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/groups`&&r.status()===503);await page.click('[name=retryTaskGroups]');await (await failedGroupResponse).text();await page.waitForFunction(()=>!!document.querySelector('[name=taskGroupsError]')&&!document.querySelector('[name=taskGroupsLoading]'));
  check('failed group retry keeps explicit failure and other state',reads.groups===2&&reads.members===2&&reads.keys===1&&reads.tasks===taskReads&&await page.$eval('[name=taskTitle]',e=>e.value==='Keep draft'));
  failing.delete('groups');await page.click('[name=retryTaskGroups]');await page.waitForFunction(()=>!document.querySelector('[name=taskGroupsLoading]')&&[...document.querySelector('[name=taskAssignee]').options].some(o=>o.textContent.includes('Real translators')));
  check('real group retry recovers only group choices',reads.groups===3&&!await page.$('[name=taskGroupsError]')&&await page.$eval('[name=taskAssignee]',e=>[...e.options].some(o=>o.textContent.includes('Real translators')))&&!!await page.$('[name=taskKeysError]'));
  failing.delete('keys');await page.click('[name=retryTaskKeys]');await page.waitForFunction(()=>!document.querySelector('[name=taskKeysLoading]')&&[...document.querySelector('[name=taskLockKeys]').options].some(o=>o.textContent==='real.lock.key'));
  check('real lockable keys recover without mutation or task reread',reads.keys===2&&reads.tasks===taskReads&&writes===0&&!await page.$('[name=taskKeysError]')&&await page.$eval('[name=taskLockKeys]',e=>[...e.options].some(o=>o.textContent==='real.lock.key'))&&await page.$eval('[name=taskTitle]',e=>e.value==='Keep draft'));
  await page.select('[name=taskLockKeys]',key.id);await page.screenshot({path:'/downloads/tasks-options.png',fullPage:true});
  await page.setViewport({width:390,height:844});check('task options recovery fits narrow viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/downloads/tasks-options-narrow.png',fullPage:true});
  check('no option recovery runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
