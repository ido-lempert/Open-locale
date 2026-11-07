// Real local browser -> snapshot inventory -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55716, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
const downloadDir=mkdtempSync(join(tmpdir(),'ol-snapshots-download-'));
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-snapshots-download-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('snapshots_download_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/snapshots_download_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  await call(`${P}/import/en`,{entries:{private:'PRIVATE_TRANSLATION'}},token);await call(`${P}/snapshots`,{label:'Snapshot [A]'},token);await call(`${P}/snapshots`,{label:'Snapshot B'},token);const initial=await call(`${P}/snapshots`,undefined,token),emptyProject=await call('/projects',{name:'Empty',slug:'empty',locales:['en']},token);
  const projectRows=rows=>rows.map(s=>({id:s.id,label:s.label,keyCount:s.keyCount,translationCount:s.translationCount,automatic:s.automatic,createdAt:s.createdAt}));
  await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForFunction(n=>document.querySelectorAll('.snapshot-row').length===n,{},initial.length);const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  const file=join(downloadDir,'snapshot-inventory.json'),readDownload=async()=>{for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));if(!existsSync(file))throw new Error('download not finished');return JSON.parse(readFileSync(file,'utf8'));};
  let reads=0,writes=0,held,hold=false,fail=false,unknown=false;await page.setRequestInterception(true);page.on('request',async req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.endsWith('/snapshots')&&req.method()==='GET'){if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_API'})});if(hold){held=req;return;}}if(unknown&&req.method()==='POST'&&u.pathname.endsWith('/snapshots')){await call(`${P}/snapshots`,JSON.parse(req.postData()),token);return req.abort('failed');}}req.continue();});
  await page.type('[name=snapshotSearch]','[a]');await page.waitForFunction(()=>document.querySelectorAll('.snapshot-row').length===1);await call(`${P}/snapshots`,{label:'Newer unread'},token);await page.click('[name=downloadSnapshots]');const report=await readDownload();check('actual JSON exact all loaded snapshot metadata despite search/newer unread snapshot',isDeepStrictEqual(report,{schemaVersion:1,projectId:project.id,scope:'all-loaded-snapshot-metadata',restorable:false,snapshots:projectRows(initial)})&&report.snapshots.length===initial.length);await page.waitForSelector('[name=snapshotDownloadNotice]');check('local inventory has zero API effects, excludes translation contents and makes no restore/save claim',reads===0&&writes===0&&!JSON.stringify(report).includes('PRIVATE_TRANSLATION')&&await page.$eval('[name=snapshotDownloadScope]',e=>e.textContent.includes('not a restorable backup'))&&await page.$eval('[name=snapshotDownloadNotice]',e=>e.textContent.includes('does not confirm')));await page.screenshot({path:'/downloads/snapshots-download-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/snapshots-download-mobile.png',fullPage:true});check('narrow metadata scope/button/feedback fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));rmSync(file);
  hold=true;await page.$eval('[name=refreshSnapshots]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=downloadSnapshots]')?.disabled&&!document.querySelector('[name=snapshotDownloadNotice]'));for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-snapshots')).download());check('pending read rejects captured inventory and clears earlier notice',reads===1&&readdirSync(downloadDir).length===0);hold=false;await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=snapshotListLoading]')&&!document.querySelector('[name=downloadSnapshots]')?.disabled);await page.$eval('[name=downloadSnapshots]',e=>e.click());const fresh=await readDownload();check('explicit refresh includes newer snapshot without resetting local search',fresh.snapshots.length===initial.length+1&&fresh.snapshots.some(s=>s.label==='Newer unread')&&reads===1&&writes===0&&await page.$eval('[name=snapshotSearch]',e=>e.value==='[a]'));rmSync(file);
  unknown=true;await page.type('[name=label]','Uncertain committed');await page.$eval('.snapshot-create button',e=>e.click());await page.waitForSelector('[name=snapshotCaptureUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=snapshotCreating]'));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-snapshots')).download());check('real committed capture then dropped response blocks inventory without automatic reread',writes===1&&reads===1&&await page.$eval('[name=downloadSnapshots]',e=>e.disabled)&&!await page.$('[name=snapshotDownloadNotice]')&&readdirSync(downloadDir).length===0&&(await call(`${P}/snapshots`,undefined,token)).some(s=>s.label==='Uncertain committed'));
  unknown=false;await page.$eval('[name=refreshSnapshots]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=snapshotCaptureUnknown]')&&!document.querySelector('[name=snapshotListLoading]')&&!document.querySelector('[name=downloadSnapshots]')?.disabled);
  fail=true;await page.$eval('[name=refreshSnapshots]',e=>e.click());await page.waitForSelector('[name=retrySnapshotList]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-snapshots')).download());check('failed read rejects stale/false-empty inventory without raw errors',await page.$eval('[name=downloadSnapshots]',e=>e.disabled)&&readdirSync(downloadDir).length===0&&!(await page.content()).includes('PRIVATE_API')&&!await page.$('[name=snapshotListEmpty]'));
  fail=false;await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${emptyProject.id}/snapshots`);await page.waitForSelector('[name=snapshotListEmpty]');await page.waitForFunction(()=>!document.querySelector('[name=downloadSnapshots]')?.disabled);await page.$eval('[name=downloadSnapshots]',e=>e.click());const empty=await readDownload();check('empty new project exports exact current scope without previous metadata',isDeepStrictEqual(empty,{schemaVersion:1,projectId:emptyProject.id,scope:'all-loaded-snapshot-metadata',restorable:false,snapshots:[]}));rmSync(file);
  await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('PRIVATE_DOWNLOAD');};ng.getComponent(document.querySelector('ol-snapshots')).download();});await page.waitForFunction(()=>document.querySelector('[name=snapshotDownloadNotice]')?.textContent.includes('could not be started'));check('local failure gives fixed guidance only',!(await page.content()).includes('PRIVATE_DOWNLOAD'));
  await page.evaluate(()=>{window.oldSnapshots=ng.getComponent(document.querySelector('ol-snapshots'));window.afterDestroy=0;URL.createObjectURL=()=>{window.afterDestroy++;return 'blob:local';};history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-snapshots'));await page.evaluate(()=>window.oldSnapshots.download());check('departed handler cannot export',await page.evaluate(()=>window.afterDestroy===0)&&readdirSync(downloadDir).length===0);
  check('no snapshot inventory runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
finally {
  await browser?.close();rmSync(downloadDir,{recursive:true,force:true});
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
