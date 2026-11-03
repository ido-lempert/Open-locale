// Real local browser -> Activity screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55536, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-activity-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('activity_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/activity_browser`;
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
  await prisma.activityEvent.createMany({data:Array.from({length:55},(_,i)=>({projectId:project.id,actorId:owner.user.id,action:'translation.value',keyName:`event-${i}`,detail:{previousValue:'before',value:'after'}}))});
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  await page.setViewport({width:480,height:900});
  await page.goto(`${WEB}/projects/${project.id}/activity`,{waitUntil:'networkidle0'});await page.waitForSelector('.load-more');
  const initial=await page.$$eval('.activity-row',rows=>rows.length);check('actual activity has first page and more cursor',initial===50);
  let olderHeld=false,releaseOlder,olderReads=0;const olderGate=new Promise(r=>releaseOlder=r);await page.setRequestInterception(true);
  const holdOlder=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(req.url()).searchParams.has('cursor')){olderHeld=true;olderReads++;await olderGate;}return req.continue();};page.on('request',holdOlder);
  await page.click('.load-more');for(let n=0;n<50&&!olderHeld;n++)await new Promise(r=>setTimeout(r,20));if(!olderHeld)throw new Error('older page not held');
  await page.click('.load-more');await new Promise(r=>setTimeout(r,100));
  check('held older page disables repeated load more and makes one actual request',olderReads===1&&await page.$eval('.load-more',e=>e.disabled)&&await page.$$eval('.activity-row',rows=>rows.length===50)&&!!await page.$('[name=activityLoading]'));
  await page.$eval('[name=actKey]',e=>{e.value='event-1';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');const latestRows=await page.$$eval('.activity-row',rows=>rows.map(r=>r.textContent));
  const olderResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(r.url()).searchParams.has('cursor'));releaseOlder();await olderResponse;await new Promise(r=>setTimeout(r,100));page.off('request',holdOlder);await page.setRequestInterception(false);
  check('late older activity page cannot append across same-project key filter',latestRows.length===11&&await page.$$eval('.activity-row',(rows,texts)=>JSON.stringify(rows.map(r=>r.textContent))===JSON.stringify(texts),latestRows)&&!(await page.$('.load-more'))&&!(await page.$('[name=activityLoading]')));
  await page.screenshot({path:'/downloads/activity-same-project-race-full.png',fullPage:true});
  await page.$eval('[name=actKey]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForSelector('.load-more');
  let pageReads=0;await page.setRequestInterception(true);const failPage=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(req.url()).searchParams.has('cursor')){pageReads++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-page-error'})});}return req.continue();};page.on('request',failPage);
  await page.click('.load-more');await page.waitForSelector('[name=retryActivity]');
  check('failed activity page retains prior rows without empty-success or raw detail',await page.$$eval('.activity-row',rows=>rows.length)===initial&&!(await page.$('[name=activityEmpty]'))&&!(await page.content()).includes('private-page-error')&&pageReads===1);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await new Promise(r=>setTimeout(r,120));await page.screenshot({path:'/downloads/activity-page-failure-full.png',fullPage:true});page.off('request',failPage);await page.setRequestInterception(false);
  await page.$eval('[name=retryActivity]',e=>e.scrollIntoView({block:'center',behavior:'instant'}));await new Promise(r=>setTimeout(r,120));await page.click('[name=retryActivity]');await page.waitForFunction(()=>document.querySelectorAll('.activity-row').length>50);
  check('real activity page retry appends remaining events once',await page.$$eval('.activity-row',rows=>rows.length===new Set(rows.map(r=>r.textContent)).size)&&!(await page.$('[name=retryActivity]'))&&!(await page.$('.load-more')));
  await call(`${P}/tasks`,{title:'<b>Activity filter task</b>'},token);
  const taskResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(r.url()).searchParams.get('action')==='task.created');await page.select('[aria-label="Filter by action"]','task.created');const taskEvents=await (await taskResponse).json();await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  check('new task action option filters real created-task activity',taskEvents.items.length===1&&taskEvents.items[0].action==='task.created'&&await page.$$eval('.activity-row',rows=>rows.length===1&&rows[0].textContent.includes('created task'))&&await page.$eval('[aria-label="Filter by action"]',e=>e.value==='task.created'));
  check('actual task title snapshot renders as literal text without HTML elements',await page.$eval('.activity-row',e=>e.textContent.includes('<b>Activity filter task</b>')&&!e.querySelector('b')));
  await page.screenshot({path:'/downloads/activity-task-filter-full.png',fullPage:true});
  await call(`${P}/glossary`,{term:'<i>checkout</i>'},token);
  const glossaryResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(r.url()).searchParams.get('action')==='glossary.created');await page.select('[aria-label="Filter by action"]','glossary.created');await glossaryResponse;await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  check('actual glossary term snapshot renders literal text in filtered activity',await page.$$eval('.activity-row',rows=>rows.length===1&&rows[0].textContent.includes('<i>checkout</i>')&&!rows[0].querySelector('i')));
  await page.screenshot({path:'/downloads/activity-glossary-filter-full.png',fullPage:true});
  let held=false,release;const gate=new Promise(r=>release=r);await page.setRequestInterception(true);const hold=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(req.url()).searchParams.get('action')==='translation.value'){held=true;await gate;}return req.continue();};page.on('request',hold);
  await page.select('[aria-label="Filter by action"]','translation.value');for(let n=0;n<50&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('activity not held');
  check('held activity filter clears previous rows and announces loading',!(await page.$('.activity-row'))&&!!await page.$('[name=activityLoading]')&&!(await page.$('[name=activityEmpty]')));
  const next=await call('/projects',{name:'Activity next',slug:'activity-next',locales:['en','fr']},token);
  await page.evaluate(id=>{history.pushState({},'',`/projects/${id}/activity`);window.dispatchEvent(new PopStateEvent('popstate'));},next.id);await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  const currentText=await page.$eval('.activity-list',e=>e.textContent);const late=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(r.url()).searchParams.get('action')==='translation.value');release();await late;await new Promise(r=>setTimeout(r,100));page.off('request',hold);await page.setRequestInterception(false);
  check('late activity cannot cross reused project route',await page.$eval('.activity-list',(e,t)=>e.textContent===t,currentText)&&await page.$eval('[aria-label="Filter by action"]',e=>e.value==='')&&await page.$eval('.back',(e,id)=>e.getAttribute('href')===`/projects/${id}`,next.id));
  check('activity recovery fits narrow viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/downloads/activity-recovered-full.png',fullPage:true});
  console.log(failures?'ACTIVITY BROWSER CHECKS FAILED':'ALL ACTIVITY BROWSER CHECKS PASSED');process.exitCode=failures?1:0;
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
