// Real local browser -> Snapshots screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SNAPSHOT_BROWSER_TEST_PG_PORT ?? 56134), WEB_PORT = 4200, API_PORT = 3000;
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

  await call(`${P}/snapshots`,{label:'Before new key'},token);await call(`${P}/snapshots`,{label:'Before new key'},token);await call(`${P}/keys`,{name:'after-snapshot'},token);if(await prisma.key.count({where:{projectId:project.id,name:'after-snapshot'}})!==1)throw new Error('missing discriminating new key');
  await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForSelector('.restore');
  await page.evaluate(()=>{window.snapshotComponent=ng.getComponent(document.querySelector('ol-snapshots'));window.oldSnapshot=window.snapshotComponent.items()[0];});
  let reads=0,restores=0,heldRead,dialogs=0,messages=[],acceptDialog=false,restoredPath;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/snapshots`){reads++;heldRead=req;return;}if(req.method()==='POST'&&path.endsWith('/restore')){restores++;restoredPath=path;}req.continue();});page.on('dialog',async d=>{dialogs++;messages.push(d.message());if(acceptDialog)await d.accept();else await d.dismiss();});
  await page.click('[name=refreshSnapshots]');await page.waitForSelector('[name=snapshotListLoading]');await page.evaluate(()=>window.snapshotComponent.restore(window.oldSnapshot));check('stale handler while real list refresh pending cannot confirm or POST',reads===1&&restores===0&&dialogs===0&&!(await page.$('.restore')));
  await heldRead.respond({status:503,contentType:'application/json',body:'{}'});await page.waitForSelector('[name=retrySnapshotList]');await page.evaluate(()=>window.snapshotComponent.restore(window.oldSnapshot));check('failed current list cannot restore captured old snapshot',restores===0&&dialogs===0&&!(await page.$('.restore')));await page.screenshot({path:'/downloads/snapshot-restore-read-guard.png',fullPage:false});
  await page.click('[name=retrySnapshotList]');await page.waitForSelector('[name=snapshotListLoading]');await heldRead.continue();await page.waitForSelector('.restore');await page.evaluate(()=>window.snapshotComponent.restore(window.oldSnapshot));check('replaced list rejects older row identity even with same snapshot ID',reads===2&&restores===0&&dialogs===0);
  const selected=await page.evaluate(()=>ng.getComponent(document.querySelector('ol-snapshots')).items()[0]);
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-snapshots'));c.label='Unsent capture';c.notice.set('Earlier receipt');c.error.set('Independent');});
  await page.click('[name=snapshotLoadedReview] summary');
  check('same-label rows expose exact loaded snapshot and project identifiers',await page.$$eval('.snapshot-label',es=>es.filter(e=>e.textContent==='Before new key').length)===2&&await page.$eval('[name=snapshotReviewId]',e=>e.textContent)===selected.id&&await page.$eval('[name=snapshotReviewProjectId]',e=>e.textContent)===project.id);
  check('row review shows raw capture time kind and explicit local metadata limits',await page.$eval('[name=snapshotReviewCreated]',e=>e.textContent)===selected.createdAt&&await page.$eval('[name=snapshotReviewKind]',e=>e.textContent)==='manual'&&await page.$eval('[name=snapshotLoadedReview]',e=>e.textContent.includes('not snapshot contents, newer server values, current permission')&&e.textContent.includes('not the current project or a total restore-impact count')));
  check('opening identity details preserves capture draft and receipts without requests',restores===0&&reads===2&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-snapshots'));return c.label==='Unsent capture'&&c.notice()==='Earlier receipt'&&c.error()==='Independent';}));
  await page.screenshot({path:'/downloads/snapshot-restore-identity-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=snapshotLoadedReview]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/snapshot-restore-identity-mobile.png'});check('390px loaded snapshot identity review fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});
  await page.click('.restore');await new Promise(r=>setTimeout(r,100));check('native confirmation exact loaded identity does not use unsent capture label',dialogs===1&&messages[0].includes('Project ID: '+project.id)&&messages[0].includes('Snapshot ID: '+selected.id)&&messages[0].includes(selected.createdAt)&&messages[0].includes('Loaded kind: manual')&&messages[0].includes('not contents, current permission or a current-project impact scan')&&!messages[0].includes('Unsent capture'));
  check('native cancel makes no restore or follow-up read and keeps draft',restores===0&&reads===2&&await page.$eval('[name=label]',e=>e.value==='Unsent capture'));
  acceptDialog=true;
  await page.evaluate(()=>{window.nativeSnapshotConfirm=window.confirm;window.confirm=message=>{const accepted=window.nativeSnapshotConfirm(message);const c=ng.getComponent(document.querySelector('ol-snapshots'));c.items.set(c.items().map(s=>({...s})));return accepted;};});
  await page.click('.restore');await new Promise(r=>setTimeout(r,100));check('accepted dialog with replaced loaded row cannot POST or remove discriminating key',dialogs===2&&restores===0&&await prisma.key.count({where:{projectId:project.id,name:'after-snapshot'}})===1);
  await page.evaluate(()=>window.confirm=window.nativeSnapshotConfirm);
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-snapshots'));window.originalSnapshotItems=c.items();c.items.set(c.items().map((s,i)=>i? s:{...s,id:'snapshot-<img onerror=fail>-'+'X'.repeat(300),automatic:true,keyCount:0,translationCount:0}));});
  await page.click('[name=snapshotLoadedReview] summary');await page.setViewport({width:390,height:844});await page.$eval('[name=snapshotLoadedReview]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-60));await page.screenshot({path:'/downloads/snapshot-restore-identity-long-mobile.png'});
  check('long escaped loaded metadata wraps as text with zero counts and automatic kind',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=snapshotLoadedReview]',e=>!e.querySelector('img')&&e.textContent.includes('snapshot-<img onerror=fail>-')&&e.textContent.includes('automatic')));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-snapshots'));c.items.set(window.originalSnapshotItems);});await page.setViewport({width:1280,height:900});
  await page.click('.restore');await page.waitForFunction(()=>document.querySelector('.notice')?.textContent.startsWith('Restored:'));for(let n=0;n<100&&reads<3;n++)await new Promise(r=>setTimeout(r,20));await heldRead.continue();await page.waitForSelector('.restore');const keys=await call(`${P}/export/en?flat=true`,null,token);check('fresh explicit restore confirms once and applies captured snapshot',dialogs===3&&restores===1&&restoredPath===`/api${P}/snapshots/${selected.id}/restore`&&!('after-snapshot' in keys)&&await prisma.key.count({where:{projectId:project.id,name:'after-snapshot'}})===0);
  await page.screenshot({path:'/downloads/snapshot-restore-identity-result-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/snapshot-restore-identity-result-mobile.png'});
  check('no snapshot restore runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
