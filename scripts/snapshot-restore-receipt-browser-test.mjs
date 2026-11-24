// Real local browser -> Snapshot confirmed restore receipts -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SNAPSHOT_RECEIPT_TEST_PG_PORT ?? 56337), WEB_PORT = 4200, API_PORT = 3000;
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




  const row={id:'saved',label:'Saved',keyCount:1,translationCount:1,automatic:false,createdAt:'2026-01-01T00:00:00Z'};let reads=0,writes=0,dialogs=0,result=null,failRead=false;
  page.on('dialog',async d=>{dialogs++;await d.accept();});await page.setRequestInterception(true);page.on('request',req=>{const p=new URL(req.url()).pathname;if(p===`/api${P}/snapshots`&&req.method()==='GET'){reads++;return req.respond({status:failRead?503:200,contentType:'application/json',body:JSON.stringify(failRead?{message:'PRIVATE'}:[row])});}if(p===`/api${P}/snapshots/saved/restore`&&req.method()==='POST'){writes++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify(result)});}req.continue();});
  await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForSelector('.restore');await page.type('[name=label]','Kept capture draft');
  const cases=[[null,'Restored: Recovered value count unavailable, Removed key count unavailable'],[{valuesChanged:{private:'PRIVATE'},keysRemoved:'PRIVATE'},'Restored: Recovered value count unavailable, Removed key count unavailable'],[{valuesChanged:0,keysRemoved:1},'Restored: 0 value(s) recovered, 1 key(s) removed'],[{valuesChanged:2,keysRemoved:-1},'Restored: 2 value(s) recovered, Removed key count unavailable']];
  for(const [body,expected] of cases){result=body;const before=writes;await page.click('.restore');await page.waitForFunction(expected=>document.querySelector('.notice')?.textContent===expected,{},expected);await page.waitForFunction(()=>document.querySelector('.restore')?.disabled===false);check('confirmed success metadata remains bounded '+before,await page.$eval('.notice',(e,v)=>e.textContent===v,expected)&&writes===before+1&&dialogs===writes&&!await page.$('[name=snapshotRestoreUnknown]')&&await page.$eval('[name=label]',e=>e.value==='Kept capture draft')&&!(await page.content()).includes('PRIVATE'));}
  result=null;failRead=true;await page.click('.restore');await page.waitForSelector('[name=snapshotListError]');check('null success plus failed refresh retains confirmation without replay',writes===5&&dialogs===5&&!await page.$('[name=snapshotRestoreUnknown]')&&await page.$eval('.notice',e=>e.textContent==='Restored: Recovered value count unavailable, Removed key count unavailable')&&reads===6);
  await page.$eval('.notice',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/snapshot-restore-receipt-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('.notice',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/snapshot-restore-receipt-mobile.png'});check('390px confirmed receipt fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  failRead=false;await page.click('[name=retrySnapshotList]');await page.waitForSelector('.restore');check('read recovery does not repeat confirmed restore',writes===5&&dialogs===5&&reads===7&&!await page.$('[name=snapshotRestoreUnknown]'));check('no restore receipt runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

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
