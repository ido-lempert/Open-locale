// Real local browser -> Snapshots screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SNAPSHOT_BROWSER_TEST_PG_PORT ?? 56136), WEB_PORT = 4200, API_PORT = 3000;
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

  await call(`${P}/snapshots`,{label:'Malformed metadata fixture'},token);await call(`${P}/snapshots`,{label:'Neighbor capture'},token);
  let reads=0,writes=0,damaged=true,dialogs=[];
  const invalid='<img src=x onerror=fail>-'+'X'.repeat(300);
  await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path===`/api${P}/snapshots`&&req.method()==='GET'){reads++;const rows=await call(`${P}/snapshots`,null,token);const changed=damaged?rows.map((s,i)=>i===0?{...s,createdAt:invalid,automatic:'legacy'}:i===1?{...s,createdAt:'',automatic:null}:s):rows;await req.respond({status:200,contentType:'application/json',body:JSON.stringify(changed)});return;}if(['POST','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});
  page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
  await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=snapshotCaptureTime]');
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-snapshots'));c.label='Unsent capture';c.notice.set('Earlier receipt');c.error.set('Independent');});
  await page.click('[name=snapshotLoadedReview] summary');
  check('malformed capture date does not interrupt full loaded-row rendering',await page.$$eval('[name=snapshotUnknownKind]',es=>es.length===2)&&await page.$$eval('.auto-badge',es=>es.length===1)&&await page.$$eval('[name=snapshotCaptureTime]',es=>es.length===3&&es[0].textContent==='Capture time unavailable'&&es[1].textContent==='Capture time unavailable'&&es[2].textContent!=='Capture time unavailable')&&await page.$eval('[name=snapshotReviewId]',e=>!!e.textContent)&&await page.$eval('[name=snapshotReviewKind]',e=>e.textContent==='unknown loaded kind'));
  check('raw malformed capture metadata stays escaped rather than replaced by fallback',await page.$eval('[name=snapshotReviewCreated]',e=>e.textContent,invalid)===invalid&&await page.$eval('[name=snapshotLoadedReview]',e=>!e.querySelector('img')));
  await page.screenshot({path:'/downloads/snapshot-metadata-fallback-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=snapshotLoadedReview]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-60));await page.screenshot({path:'/downloads/snapshot-metadata-fallback-mobile.png'});
  check('malformed capture metadata review wraps within390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.click('.restore');check('cancel confirmation names raw timestamp and unknown kind without restore request',dialogs.length===1&&dialogs[0].includes(invalid)&&dialogs[0].includes('Loaded kind: unknown loaded kind')&&writes===0&&reads===1);
  await page.select('[name=snapshotKind]','manual');check('unknown kind rows are not silently classified as manual',await page.$$eval('.snapshot-label',es=>es.length===0));await page.select('[name=snapshotKind]','unknown');
  const unknownOnly=()=>page.$$eval('.snapshot-row',es=>es.length===2&&es.every(e=>e.querySelector('[name=snapshotUnknownKind]')?.textContent==='unknown loaded kind'&&!e.querySelector('.auto-badge')));
  check('unknown kind filter isolates nonboolean loaded rows without requests',await unknownOnly()&&reads===1&&writes===0);
  await page.$eval('[name=snapshotUnknownKind]',e=>e.textContent='');check('negative missing unknown-kind marker detected',!await unknownOnly());await page.$eval('[name=snapshotUnknownKind]',e=>e.textContent='unknown loaded kind');check('unknown kind rows restored after isolated probe',await unknownOnly());
  await page.setViewport({width:1280,height:900});await page.$eval('[name=snapshotKind]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/snapshot-unknown-kind-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=snapshotKind]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/snapshot-unknown-kind-mobile.png'});
  await page.$eval('[name=snapshotSearch]',e=>{e.value='No matching label';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForSelector('[name=snapshotListEmpty]');check('unknown kind combines local label search without clean-history claim',await page.$eval('[name=snapshotListEmpty]',e=>e.textContent.includes('kind filter and label search'))&&reads===1&&writes===0);await page.$eval('[name=clearAllSnapshotFilters]',e=>e.click());
  check('fallback does not clear draft receipts or cause writes',writes===0&&reads===1&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-snapshots'));return c.label==='Unsent capture'&&c.notice()==='Earlier receipt'&&c.error()==='Independent';}));
  await page.select('[name=snapshotKind]','unknown');damaged=false;await page.click('[name=refreshSnapshots]');await page.waitForSelector('[name=snapshotListEmpty]');check('current read keeps unknown filter and excludes now known kinds',reads===2&&writes===0&&await page.$eval('[name=snapshotKind]',e=>e.value==='unknown'));await page.select('[name=snapshotKind]','');await page.waitForFunction(()=>{const el=document.querySelector('[name=snapshotCaptureTime]');return !!el&&el.textContent!=='Capture time unavailable';});await page.click('[name=snapshotLoadedReview] summary');
  check('explicit reread replaces fallback with valid server time and manual kind',reads===2&&writes===0&&await page.$eval('[name=snapshotReviewKind]',e=>e.textContent==='manual')&&await page.$eval('[name=snapshotReviewCreated]',e=>e.textContent.startsWith('2026-')));
  await page.setViewport({width:1280,height:900});await page.screenshot({path:'/downloads/snapshot-metadata-fallback-recovered-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=snapshotLoadedReview]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-60));await page.screenshot({path:'/downloads/snapshot-metadata-fallback-recovered-mobile.png'});
  check('no snapshot restore runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;
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
