// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55815, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-task-receipt-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('task_receipt_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/task_receipt_browser`;
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

  const put=async(name,locale,value)=>{let k=(await call(`${P}/keys`,null,token)).find(k=>k.name===name);if(!k)k=await call(`${P}/keys`,{name},token);await call(`${P}/keys/${k.id}/translations`,{locale,value},token,'PUT');return k;};
  const customText='APPROVED';
  await call(P,{customStatuses:[customText]},token,'PATCH');
  const reviewed=await put('reviewed.target','en','Unreviewed source');await put('reviewed.target','he','Needle target');
  const translated=await put('reviewed.source.only','en','Reviewed source');await put('reviewed.source.only','he','Needle other');
  const custom=await put('custom.target','he','Needle custom');
  const status=async(k,locale,value)=>call(`${P}/keys/${k.id}/translations/${locale}/status`,{status:value},token,'PATCH');
  await status(reviewed,'he','REVIEWED');await status(translated,'en','REVIEWED');await status(translated,'he','TRANSLATED');await status(custom,'he',customText);
  let reads=[],writes=[],held=null;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push({method:req.method(),path:u.pathname,search:u.search});if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');
  check('initial clear is disabled and options load without a key search',await page.$eval('[name=clearSavedSearchFilters]',e=>e.disabled)&&!reads.some(r=>r.path===`/api${P}/keys`));
  await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','Needle target');await page.type('[name=savedSearchTag]','private');await page.select('[name=savedSearchStatus]','REVIEWED');await page.select('[name=savedSearchMatch]','exact');
  reads=[];await page.click('[name=clearSavedSearchFilters]');await page.waitForFunction(()=>document.querySelector('[name=savedSearchText]').value==='');
  const cleared=()=>page.evaluate(()=>document.querySelector('[name=savedSearchText]').value===''&&document.querySelector('[name=savedSearchTag]').value===''&&document.querySelector('[name=savedSearchStatus]').value===''&&document.querySelector('[name=savedSearchMatch]').value==='contains'&&document.querySelector('[name=savedSearchLocale]').value==='he'&&document.querySelector('[name=savedSearchBranch]').value==='main');
  check('clear resets all four actual controls and preserves branch locale',await cleared());check('local clear makes zero requests or writes',reads.length===0&&writes.length===0);
  check('clear scope text states retained branch locale and no automatic search',await page.$eval('[name=savedSearchClearScope]',e=>e.textContent.includes('Keeps this branch and locale')&&e.textContent.includes('without searching')));
  const search=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.click('[name=runSavedSearch]');await response;await page.waitForNetworkIdle({idleTime:100});await page.waitForSelector('[name=savedSearchCount]');};
  await page.type('[name=savedSearchText]','Needle');await search();check('explicit search after clear reads actual selected-locale values',await page.$$eval('[name=savedSearchResult]',rows=>rows.length===3)&&await page.$eval('[name=savedSearchRowStatus]',e=>e.textContent.includes('Loaded saved status')));
  await page.screenshot({path:'/downloads/saved-search-clear-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=clearSavedSearchFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-clear-mobile.png'});check('390px clear action and scope fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  reads=[];await page.click('[name=clearSavedSearchFilters]');await page.waitForSelector('[name=savedSearchIdle]');check('clear removes loaded private values statuses and download control',!await page.$('[name=savedSearchResult]')&&!await page.$('[name=savedSearchRowStatus]')&&!await page.$('[name=downloadSavedSearch]')&&await cleared()&&reads.length===0);
  await page.type('[name=savedSearchText]','Needle');let started;const ready=new Promise(r=>started=r);held={started};await page.click('[name=runSavedSearch]');await ready;await page.waitForSelector('[name=savedSearchLoading]');check('clear remains available while request is pending',!await page.$eval('[name=clearSavedSearchFilters]',e=>e.disabled));await page.click('[name=clearSavedSearchFilters]');await page.waitForSelector('[name=savedSearchIdle]');const old=held.request;held=null;await old.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'private-old',name:'PRIVATE_OLD',translations:[{localeCode:'he',value:'PRIVATE',status:'REVIEWED'}]}])});await new Promise(r=>setTimeout(r,200));check('late held read cannot restore cleared private values or count',!await page.$('[name=savedSearchResult]')&&!await page.$('[name=savedSearchCount]')&&await cleared());
  await page.type('[name=savedSearchText]','Needle');let failedStarted;const failedReady=new Promise(r=>failedStarted=r);held={started:failedStarted};await page.click('[name=runSavedSearch]');await failedReady;await page.waitForSelector('[name=savedSearchLoading]');const failed=held.request;held=null;await failed.respond({status:503,contentType:'application/json',body:'{}'});await page.waitForSelector('[name=savedSearchError]');reads=[];await page.click('[name=clearSavedSearchFilters]');await page.waitForSelector('[name=savedSearchIdle]');check('clear recovers local idle state from error without retry',!await page.$('[name=savedSearchError]')&&await cleared()&&reads.length===0&&await page.$eval('[name=runSavedSearch]',e=>e.disabled));
  check('entire clear interaction makes zero writes',writes.length===0);check('no clear-search runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
