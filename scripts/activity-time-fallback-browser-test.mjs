// Real local browser -> Snapshots screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.ACTIVITY_TIME_TEST_PG_PORT ?? 56260), WEB_PORT = 4200, API_PORT = 3000;
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

  await prisma.activityEvent.createMany({data:['First','Second','Third'].map((keyName,i)=>({projectId:project.id,actorId:owner.user.id,action:'translation.value',keyName,detail:{value:'Recorded value'},createdAt:new Date(Date.UTC(2026,10,23,7,i))}))});
  let reads=0,writes=0,damaged=true;const invalid='<img src=x onerror=fail>-'+'X'.repeat(300);
  await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path===`/api${P}/activity`&&req.method()==='GET'){reads++;const data=await call(`${P}/activity`,null,token);const items=damaged?data.items.map((s,i)=>i===0?{...s,createdAt:invalid}:i===1?{...s,createdAt:''}:s):data.items;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({...data,items})});}if(['POST','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});
  await page.goto(`${WEB}${P}/activity`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=activityTime]');
  check('invalid and empty recorded times preserve all real loaded activity rows',await page.$$eval('[name=activityTime]',es=>es.length>=3&&es[0].textContent==='Activity time unavailable'&&es[1].textContent==='Activity time unavailable'&&es[2].textContent!=='Activity time unavailable')&&await page.$$eval('.activity-row',es=>es.length>=3));
  check('malformed timestamp never becomes markup or leaks raw payload',await page.$eval('.activity-list',e=>!e.querySelector('img'))&&!(await page.content()).includes(invalid)&&reads===1&&writes===0);
  await page.setViewport({width:1280,height:900});await page.screenshot({path:'/downloads/activity-time-fallback-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=activityTime]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-time-fallback-mobile.png'});check('390px fallback remains readable without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const search=async value=>page.$eval('[name=activitySearch]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await search('translation.value');check('local metadata search still works without reads or writes',await page.$$eval('.activity-row',es=>es.length===3)&&reads===1&&writes===0);await search('');
  damaged=false;await page.$eval('[name=refreshActivity]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=refreshActivity]');await page.waitForFunction(()=>!document.querySelector('[name=activityLoading]')&&![...document.querySelectorAll('[name=activityTime]')].some(e=>e.textContent==='Activity time unavailable'));
  check('explicit read replaces fallback with valid current response times',reads===2&&writes===0&&await page.$$eval('[name=activityTime]',es=>es.length>=3&&es.every(e=>!!e.textContent&&e.textContent!=='Activity time unavailable')));
  check('no date-pipe or activity runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;
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
