// Real local browser -> Diagnostic history timestamp fallback -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SYNC_HISTORY_ORDER_TEST_PG_PORT ?? 56278), WEB_PORT = 4200, API_PORT = 3000;
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


  for(let i=0;i<6;i++)await call(`${P}/sync/preview-records`,{branch:'main',locale:'en',baselineJson:'{}',remoteJson:'{"key":"PRIVATE VALUE"}',remoteSha:'a'.repeat(40)},token);
  const data=await call(`${P}/sync/preview-records`,null,token),names=['late','bad','tie-a','tie-b','empty','old'],times=['2026-11-23T09:00:00.500Z','invalid','2026-11-23T11:00:00+02:00','2026-11-23T09:00:00.000Z','','2020-01-01T00:00:00Z'];
  const records=data.records.map((r,i)=>({...r,branch:names[i],createdAt:times[i],summary:{total:1,conflict:i===2||i===3?0:1,manual:i===2||i===3?1:0}}));
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path===`/api${P}/sync/preview-records`&&req.method()==='GET'){reads++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({...data,records})});}if(['POST','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});
  await page.goto(`${WEB}${P}/sync/history`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=syncHistoryOrder]');
  const branches=()=>page.$$eval('article h2',es=>es.map(e=>e.textContent.trim().split(' / ')[0]).join(','));
  const select=async value=>{await page.select('[name=syncHistoryOrder]',value);await new Promise(r=>setTimeout(r,70));};
  check('loaded default and diagnostic-only scope preserved',await branches()==='late,bad,tie-a,tie-b,empty,old'&&await page.$eval('[name=syncHistoryOrder]',e=>e.value==='loaded')&&await page.$eval('.notice',e=>e.textContent.includes('No record can apply changes')));
  await select('oldest');check('oldest uses full instants and stable offset-equivalent ties, unavailable last',await branches()==='old,tie-a,tie-b,late,bad,empty'&&reads===1&&writes===0);
  await select('newest');check('newest retains subseconds and stable unavailable ordering',await branches()==='late,tie-a,tie-b,old,bad,empty');
  await page.select('[name=syncHistoryAttention]','conflict');await new Promise(r=>setTimeout(r,70));check('recorded attention combines with local order',await branches()==='late,old,bad,empty');
  await page.$eval('[name=syncHistorySearch]',e=>{e.value='OLD';e.dispatchEvent(new Event('input',{bubbles:true}));});await new Promise(r=>setTimeout(r,70));check('literal search combines with attention/order without reads',await branches()==='old'&&reads===1&&writes===0);
  await page.evaluate(()=>{window.__diagnosticsDownload=null;URL.createObjectURL=blob=>{blob.text().then(t=>window.__diagnosticsDownload=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});
  await page.click('[name=downloadSyncHistory]');await page.waitForFunction(()=>!!window.__diagnosticsDownload);
  check('download includes all loaded rows in source order with original times and no apply claim',await page.evaluate(()=>{const d=window.__diagnosticsDownload;return d.records.map(r=>r.branch).join(',')==='late,bad,tie-a,tie-b,empty,old'&&d.records[1].createdAt==='invalid'&&d.canApply===false&&d.remoteVerified===false&&!JSON.stringify(d).includes('PRIVATE VALUE');}));
  await page.$eval('[name=syncHistorySearch]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.select('[name=syncHistoryAttention]','');await select('oldest');
  await page.screenshot({path:'/downloads/sync-history-order-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=syncHistoryOrder]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/sync-history-order-mobile.png'});check('390px ordering guidance fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await select('loaded');check('loaded view restores original source order',await branches()==='late,bad,tie-a,tie-b,empty,old');await select('oldest');
  await page.$eval('[name=syncHistoryRefresh]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=syncHistoryRefresh]');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-sync-history')).loading());check('explicit refresh retains local order without writes',reads===2&&writes===0&&await branches()==='old,tie-a,tie-b,late,bad,empty');
  const second=await call('/projects',{name:'Other',slug:'other',locales:['en']},token);await page.evaluate(id=>ng.getComponent(document.querySelector('ol-sync-history')).load(id),second.id);check('different project resets local order',await page.$eval('[name=syncHistoryOrder]',e=>e.value==='loaded')&&writes===0);
  check('no diagnostic runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;
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
