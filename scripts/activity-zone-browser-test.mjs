// Real local browser -> Activity screen -> built API + PostgreSQL.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.ACTIVITY_ZONE_TEST_PG_PORT ?? 56356), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-activity-label-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('activity_label_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/activity_label_browser`;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  const values=['2026-11-25T09:00:59Z','2026-11-25T11:00:59+02:00','2026-11-25T09:00:58Z','not-a-time',null],rows=values.map((createdAt,i)=>({id:'row'+i,actor:{displayName:'Owner'},action:'key.created',keyName:'Title'+i,localeCode:'en',createdAt}));let reads=0,writes=0;
  await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname===`/api${P}/activity`&&req.method()==='GET'){reads++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({items:rows,nextCursor:null})});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});await page.goto(`${WEB}${P}/activity`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.querySelectorAll('[name=activityTime]').length===5);
  check('equivalent instants share explicit zone while different seconds stay distinct',await page.$$eval('[name=activityTime]',es=>es[0].textContent===es[1].textContent&&es[0].textContent!==es[2].textContent&&/GMT|UTC/.test(es[0].textContent)));check('datetime preserves raw valid source and invalids omit attribute',await page.$$eval('[name=activityTime]',(es,vs)=>es.every((e,i)=>i<3?e.getAttribute('datetime')===vs[i]:!e.hasAttribute('datetime')&&e.textContent==='Activity time unavailable'),values));await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/activity-zone-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.$eval('.activity-list',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-zone-mobile.png'});check('390px explicit medium time wraps within rows',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.select('[name=activityOrder]','oldest');check('second-level time order preserves equal source instants',await page.$$eval('.activity-key',es=>es.map(e=>e.textContent).join(',')==='Title2,Title0,Title1,Title3,Title4'));
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__report=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.$eval('[name=downloadActivity]',e=>e.click());await page.waitForFunction(()=>!!window.__report);check('download retains exact raw loaded order and timestamps',await page.evaluate(vs=>JSON.stringify(window.__report.entries.map(r=>r.createdAt))===JSON.stringify(vs),values));check('display and order make no extra read or mutation',reads===1&&writes===0);check('no activity timezone runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;

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
