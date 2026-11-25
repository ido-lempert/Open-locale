// Real local browser -> Webhook recorded-success metadata -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SNAPSHOT_ZONE_TEST_PG_PORT ?? 56358), WEB_PORT = 4200, API_PORT = 3000;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);




  const values=['2026-11-25T09:00:59Z','2026-11-25T11:00:59+02:00','2026-11-25T09:00:58Z','invalid',null],rows=values.map((createdAt,i)=>({id:'r'+i,label:'Capture '+i,keyCount:1,translationCount:1,automatic:false,createdAt}));let reads=0,writes=0,dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname===`/api${P}/snapshots`&&req.method()==='GET'){reads++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify(rows)});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForSelector('.snapshot-row');check('capture labels distinguish seconds with explicit displayed zone',await page.$$eval('[name=snapshotCaptureTime]',es=>es[0].textContent===es[1].textContent&&es[0].textContent!==es[2].textContent&&/GMT|UTC/.test(es[0].textContent)));check('valid capture datetime stays raw invalid source omitted',await page.$$eval('[name=snapshotCaptureTime]',(es,vs)=>es.every((e,i)=>i<3?e.getAttribute('datetime')===vs[i]:!e.hasAttribute('datetime')&&e.textContent==='Capture time unavailable'),values));await page.$eval('[name=snapshotLoadedReview]',e=>e.open=true);check('expanded identity retains exact loaded capture string',await page.$eval('[name=snapshotReviewCreated]',e=>e.textContent==='2026-11-25T09:00:59Z'));await page.$eval('[name=snapshotLoadedReview]',e=>e.open=false);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/snapshot-zone-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.$eval('.snapshot-row',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/snapshot-zone-mobile.png'});check('390px longer capture labels fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.$eval('.restore',e=>e.click());check('cancel restore retains raw identity and sends no request',dialogs.length===1&&dialogs[0].includes('Snapshot ID: r0')&&dialogs[0].includes('Loaded capture time: '+values[0])&&writes===0);await page.select('[name=snapshotOrder]','oldest');check('equal instants stable and precise-second order retained',await page.$$eval('.snapshot-label',es=>es.map(e=>e.textContent).join(',')==='Capture 2,Capture 0,Capture 1,Capture 3,Capture 4'));
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__report=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.$eval('[name=downloadSnapshots]',e=>e.click());await page.waitForFunction(()=>!!window.__report);check('nonrestorable inventory preserves exact loaded times/order',await page.evaluate(vs=>window.__report.restorable===false&&JSON.stringify(window.__report.snapshots.map(r=>r.createdAt))===JSON.stringify(vs),values));check('display order and cancelled restore make no extra request',reads===1&&writes===0);check('no capture timezone runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;

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
