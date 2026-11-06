// Real local browser -> Reports screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55678, WEB_PORT = 4200, API_PORT = 3000;
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

  await call(`${P}/branches`,{name:'release'},token);await page.goto(`${WEB}${P}/reports`,{waitUntil:'networkidle0'});await page.waitForSelector('.progress-table');await page.select('[name=reportBranch]','release');await page.select('[name=usageDays]','7');await page.waitForFunction(()=>!document.querySelector('[name=branchReportLoading]')&&!document.querySelector('[name=usageLoading]')&&!document.querySelector('[name=tasksLoading]'));await page.evaluate(()=>window.rc=ng.getComponent(document.querySelector('ol-reports')));const initial=await page.evaluate(()=>({keys:window.rc.report().totalKeys,events:window.rc.usage().totalEvents,tasks:window.rc.taskReport().total}));
  await call(`${P}/keys`,{name:'fresh.release.key',branch:'release'},token);await call(`${P}/tasks`,{title:'Fresh report task'},token);let calls={progress:0,quality:0,usage:0,tasks:0},held=[],hold='branch';await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;const name=Object.keys(calls).find(n=>path===`/api${P}/reports/${n}`);if(name){calls[name]++;if((hold==='branch'&&['progress','quality'].includes(name))||hold===name){held.push(req);return;}}req.continue();});
  await page.click('[name=refreshBranchReports]');await page.waitForSelector('[name=branchReportLoading]');await page.evaluate(()=>window.rc.refreshBranch());for(let n=0;n<100&&held.length<2;n++)await new Promise(r=>setTimeout(r,20));check('branch refresh captures selected release and guards duplicate without sibling reads',calls.progress===1&&calls.quality===1&&calls.usage===0&&calls.tasks===0&&held.every(r=>new URL(r.url()).searchParams.get('branch')==='release')&&await page.$eval('[name=refreshBranchReports]',e=>e.disabled)&&await page.evaluate(i=>window.rc.usage().totalEvents===i.events&&window.rc.taskReport().total===i.tasks,initial));hold='';for(const r of held)await r.continue();held=[];await page.waitForSelector('.progress-table');check('branch refresh displays real newly persisted release key without changing project dashboard scope',await page.evaluate(i=>window.rc.report().totalKeys===i.keys+1&&window.rc.branch()==='release'&&window.rc.usage().totalEvents===i.events&&window.rc.taskReport().total===i.tasks,initial));
  hold='usage';await page.click('[name=refreshUsageReport]');await page.waitForSelector('[name=usageLoading]');await page.evaluate(()=>window.rc.refreshUsage());for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));check('usage refresh keeps selected seven-day window and independent sibling figures',calls.usage===1&&calls.tasks===0&&calls.progress===1&&new URL(held[0].url()).searchParams.get('days')==='7'&&await page.$eval('[name=refreshUsageReport]',e=>e.disabled)&&await page.evaluate(()=>!!window.rc.report()&&!!window.rc.taskReport()));hold='';await held[0].continue();held=[];await page.waitForFunction(()=>!document.querySelector('[name=usageLoading]'));check('usage refresh displays fresh real activity',await page.evaluate(i=>window.rc.usage().totalEvents>i.events&&window.rc.usageDays()===7,initial));
  hold='tasks';await page.click('[name=refreshTaskReport]');await page.waitForSelector('[name=tasksLoading]');await page.evaluate(()=>window.rc.refreshTasks());for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));check('task refresh duplicate is guarded and other dashboard figures stay visible',calls.tasks===1&&calls.usage===1&&calls.progress===1&&await page.$eval('[name=refreshTaskReport]',e=>e.disabled)&&await page.evaluate(()=>!!window.rc.report()&&!!window.rc.usage()));hold='';await held[0].continue();held=[];await page.waitForFunction(()=>!document.querySelector('[name=tasksLoading]'));check('task refresh displays newly persisted task without resetting branch/window',await page.evaluate(i=>window.rc.taskReport().total===i.tasks+1&&window.rc.branch()==='release'&&window.rc.usageDays()===7,initial));await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:0,behavior:'instant'});});await page.waitForFunction(()=>scrollY===0);await page.$eval('main',e=>e.scrollTop=0);await page.screenshot({path:'/downloads/reports-refresh.png',fullPage:true});
  check('no report refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
