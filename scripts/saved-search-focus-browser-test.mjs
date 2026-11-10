// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55819, WEB_PORT = 4200, API_PORT = 3000;
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
  const focusName=()=>page.evaluate(()=>document.activeElement?.getAttribute('name'));
  const waitFocus=name=>page.waitForFunction(n=>document.activeElement?.getAttribute('name')===n,{},name);
  const enterText=async text=>{await page.focus('[name=savedSearchText]');await page.$eval('[name=savedSearchText]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.type('[name=savedSearchText]',text);};
  await page.select('[name=savedSearchLocale]','he');await enterText('Needle');reads=[];await page.focus('[name=runSavedSearch]');await page.keyboard.press('Enter');await waitFocus('savedSearchCount');
  check('keyboard search lands actual result count with selected-locale matches',await focusName()==='savedSearchCount'&&await page.$$eval('[name=savedSearchResult]',r=>r.length===3));
  check('focus landing adds no read or write',reads.length===1&&reads[0].method==='GET'&&writes.length===0);
  await page.screenshot({path:'/downloads/saved-search-focus-desktop.png'});await page.setViewport({width:390,height:844});await page.focus('[name=clearSavedSearchFilters]');await page.keyboard.press('Enter');await waitFocus('savedSearchText');
  check('keyboard clear returns to text and clears old result/download without search',await focusName()==='savedSearchText'&&!await page.$('[name=savedSearchResult]')&&!await page.$('[name=downloadSavedSearch]')&&reads.length===1);await page.screenshot({path:'/downloads/saved-search-focus-mobile.png'});check('390px keyboard landing has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await enterText('NoSuchSavedText');await page.focus('[name=runSavedSearch]');await page.keyboard.press('Enter');await waitFocus('savedSearchCount');check('empty successful search lands count with explicit empty explanation',await page.$eval('[name=savedSearchCount]',e=>e.textContent.startsWith('0 matching'))&&!!await page.$('[name=savedSearchEmpty]'));
  await enterText('Needle');let started;const ready=new Promise(r=>started=r);held={started};await page.focus('[name=runSavedSearch]');await page.keyboard.press('Enter');await ready;await page.waitForSelector('[name=savedSearchLoading]');const failed=held.request;held=null;await failed.respond({status:503,contentType:'application/json',body:'{}'});await waitFocus('savedSearchError');check('failed manual query lands fixed error text without hidden private detail',await page.$eval('[name=savedSearchError]',e=>e.textContent.includes('No results are shown')&&!e.textContent.includes('PRIVATE')));
  let nextStarted;const nextReady=new Promise(r=>nextStarted=r);held={started:nextStarted};await page.focus('[name=runSavedSearch]');await page.keyboard.press('Enter');await nextReady;await page.waitForSelector('[name=savedSearchLoading]');await page.focus('[name=clearSavedSearchFilters]');await page.keyboard.press('Enter');await waitFocus('savedSearchText');const old=held.request;held=null;await old.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'private-old',name:'PRIVATE_OLD',translations:[{localeCode:'he',value:'PRIVATE'}]}])});await new Promise(r=>setTimeout(r,200));check('late cleared response cannot steal returned text focus or restore results',await focusName()==='savedSearchText'&&!await page.$('[name=savedSearchResult]'));
  await enterText('Needle');let scopeStarted;const scopeReady=new Promise(r=>scopeStarted=r);held={started:scopeStarted};await page.focus('[name=runSavedSearch]');await page.keyboard.press('Enter');await scopeReady;await page.waitForSelector('[name=savedSearchLoading]');await page.focus('[name=savedSearchLocale]');await page.select('[name=savedSearchLocale]','en');const stale=held.request;held=null;await stale.respond({status:200,contentType:'application/json',body:'[]'});await new Promise(r=>setTimeout(r,200));check('late prior-locale response cannot steal scope control focus',await focusName()==='savedSearchLocale'&&!await page.$('[name=savedSearchCount]'));
  check('keyboard focus flow performs no writes',writes.length===0);check('no keyboard landing runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
