// Local browser -> loaded diagnostic-history search -> real API/Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55701, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;const downloadDir=mkdtempSync(join(tmpdir(),'ol-qa-download-'));
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-list-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_list_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_list_browser`;
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


  const save=()=>call(`${P}/sync/preview-records`,{branch:'main',locale:'he',baselineJson:'{}',remoteJson:'{"title":"PRIVATE translation value"}',remoteSha:'a'.repeat(40)},token);
  await save();await call(`${P}/sync/preview-records`,{branch:'main',locale:'en',baselineJson:'{}',remoteJson:'{"other":"PRIVATE second value"}',remoteSha:'b'.repeat(40)},token);
  const expected=(await call(`${P}/sync/preview-records`,undefined,token)).records.map(({id,branch,locale,fingerprint,remoteSha,createdAt,summary})=>({id,branch,locale,fingerprint,remoteSha,createdAt,summary:{total:summary.total,conflict:summary.conflict,manual:summary.manual}}));
  const second=await call('/projects',{name:'Second scope',slug:'second-scope',locales:['en']},token);
  await page.goto(`${WEB}${P}/sync/history`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  let reads=0,writes=0,held,fail=false;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.endsWith('/sync/preview-records')){if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});held=req;return;}}req.continue();});
  const file=join(downloadDir,'sync-diagnostics.json');const readDownload=async()=>{for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));if(!existsSync(file))throw new Error('download did not finish');return JSON.parse(readFileSync(file,'utf8'));};
  await page.type('[name=syncHistorySearch]','zz-unmatched');await page.waitForFunction(()=>document.querySelectorAll('article').length===0);await save();
  await page.click('[name=downloadSyncHistory]');const report=await readDownload();await page.waitForSelector('[name=syncHistoryDownloadNotice]');
  check('actual downloaded full diagnostic set matches loaded API whitelist despite no-match search and newer unread record',isDeepStrictEqual(report,{schemaVersion:1,projectId:project.id,scope:'all-loaded-diagnostics',canApply:false,baselineVerified:false,remoteVerified:false,records:expected})&&report.records.length===2);
  check('local export makes no account requests, excludes translation text and keeps diagnostic limits explicit',reads===0&&writes===0&&!JSON.stringify(report).includes('PRIVATE')&&await page.$eval('[name=syncHistoryDownloadScope]',e=>e.textContent.includes('regardless of search')&&e.textContent.includes('unverified')&&e.textContent.includes('accepted baselines'))&&await page.$eval('[name=syncHistoryDownloadNotice]',e=>e.textContent.includes('does not confirm')));
  await page.click('[name=clearSyncHistorySearch]');await page.waitForFunction(()=>document.querySelectorAll('article').length===2);await page.screenshot({path:'/downloads/sync-history-download-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/sync-history-download-mobile.png',fullPage:true});check('narrow download scope and metadata wrap without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));rmSync(file);
  await page.click('[name=syncHistoryRefresh]');await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-sync-history')).loading());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>document.querySelector('[name=downloadSyncHistory]')?.disabled&&!document.querySelector('[name=syncHistoryDownloadNotice]'));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-sync-history')).download());check('held read disables export and captured handler cannot download stale diagnostics',reads===1&&readdirSync(downloadDir).length===0);
  await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-sync-history')).loading());await page.click('[name=downloadSyncHistory]');const fresh=await readDownload();check('explicit current read updates full downloadable diagnostic set without apply claim',fresh.records.length===3&&fresh.canApply===false&&fresh.baselineVerified===false&&fresh.remoteVerified===false&&reads===1&&writes===0);rmSync(file);
  fail=true;await page.click('[name=syncHistoryRefresh]');await page.waitForSelector('[role=alert]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-sync-history')).download());check('failed read blocks download without raw error or saved-success feedback',reads===2&&await page.$eval('[name=downloadSyncHistory]',e=>e.disabled)&&readdirSync(downloadDir).length===0&&!await page.$('[name=syncHistoryDownloadNotice]')&&!(await page.content()).includes('PRIVATE'));
  fail=false;await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${second.id}/sync/history`);await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-sync-history')).loading());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-sync-history')).loading());await page.click('[name=downloadSyncHistory]');const empty=await readDownload();check('successful empty new project exports current scope not prior diagnostics',empty.projectId===second.id&&empty.records.length===0&&empty.canApply===false&&reads===3&&writes===0);rmSync(file);
  await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('PRIVATE');};ng.getComponent(document.querySelector('ol-sync-history')).download();});await page.waitForFunction(()=>document.querySelector('[name=syncHistoryDownloadNotice]')?.textContent.includes('could not be started'));check('local download failure stays fixed without raw detail',!(await page.content()).includes('PRIVATE'));
  await page.evaluate(()=>{window.departedHistory=ng.getComponent(document.querySelector('ol-sync-history'));window.createdAfterDestroy=0;URL.createObjectURL=()=>{window.createdAfterDestroy++;return 'blob:local';};history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-sync-history'));await page.evaluate(()=>window.departedHistory.download());check('departed handler cannot export diagnostic history',await page.evaluate(()=>window.createdAfterDestroy===0)&&readdirSync(downloadDir).length===0);check('no diagnostic download runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
