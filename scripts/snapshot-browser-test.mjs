// Real local browser -> Snapshots screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55543, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-snapshot-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('snapshot_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/snapshot_browser`;
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


  await call(`${P}/snapshots`,{label:'Persisted snapshot'},token);
  await page.setViewport({width:480,height:900});await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForSelector('.snapshot-row');
  check('snapshot screen renders persisted capture',await page.$eval('.snapshot-list',e=>e.textContent.includes('Persisted snapshot')));
  await page.type('[name=label]','Capture before failed list');let failedReads=0;await page.setRequestInterception(true);const failList=req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/snapshots`){failedReads++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-snapshot-list'})});}return req.continue();};page.on('request',failList);await page.click('.snapshot-create button');await page.waitForSelector('[name=retrySnapshotList]');
  check('failed post-capture list hides stale restore rows and empty success without raw detail',failedReads===1&&!(await page.$('.snapshot-list'))&&!(await page.$('.restore'))&&!(await page.$('[name=snapshotListEmpty]'))&&!(await page.content()).includes('private-snapshot-list')&&await page.$eval('[name=snapshotListError]',e=>e.textContent==='Snapshots unavailable. No snapshots are shown. Retry this read or reload the page.'));
  await page.screenshot({path:'/downloads/snapshots-list-failure-full.png',fullPage:true});page.off('request',failList);let held=false,release;const gate=new Promise(r=>release=r);const holdList=async req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/snapshots`){held=true;await gate;}return req.continue();};page.on('request',holdList);await page.type('[name=label]','Keep retry label');await page.click('[name=retrySnapshotList]');await page.waitForSelector('[name=snapshotListLoading]');if(!held)throw new Error('snapshot retry not held');
  check('pending snapshot retry hides rows empty guidance and retry while retaining label',!(await page.$('.snapshot-list'))&&!(await page.$('[name=snapshotListEmpty]'))&&!(await page.$('[name=retrySnapshotList]'))&&await page.$eval('[name=label]',e=>e.value==='Keep retry label'));await page.screenshot({path:'/downloads/snapshots-retry-loading-full.png',fullPage:true});release();await page.waitForFunction(()=>!document.querySelector('[name=snapshotListLoading]')&&document.querySelector('.snapshot-list')?.textContent.includes('Capture before failed list'));
  check('actual snapshot retry restores persisted rows and label without list error',await page.$eval('.snapshot-list',e=>e.textContent.includes('Persisted snapshot')&&e.textContent.includes('Capture before failed list'))&&await page.$eval('[name=label]',e=>e.value==='Keep retry label')&&!(await page.$('[name=snapshotListError]'))&&!(await page.$('[name=snapshotListEmpty]')));
  check('snapshot recovery has no runtime error or document overflow',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d))&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));page.off('request',holdList);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-list-recovered-full.png',fullPage:true});
  console.log(failures?'SNAPSHOT BROWSER CHECKS FAILED':'ALL SNAPSHOT BROWSER CHECKS PASSED');process.exitCode=failures?1:0;
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
