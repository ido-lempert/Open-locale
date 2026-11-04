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
