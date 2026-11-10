// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55801, WEB_PORT = 4200, API_PORT = 3000;
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
  await call(P,{customStatuses:['APPROVED']},token,'PATCH');
  const reviewed=await put('reviewed.target','en','Source not reviewed');await put('reviewed.target','he','Needle');
  const translated=await put('reviewed.source.only','en','Reviewed source');await put('reviewed.source.only','he','Needle');
  const custom=await put('custom.target','he','Needle');
  const longer=await put('longer.reviewed','he','Longer Needle text');
  const other=await put('wrong.text','he','Unrelated');
  const status=async(k,locale,value)=>call(`${P}/keys/${k.id}/translations/${locale}/status`,{status:value},token,'PATCH');
  await status(reviewed,'he','REVIEWED');await status(translated,'en','REVIEWED');await status(translated,'he','TRANSLATED');await status(custom,'he','APPROVED');await status(longer,'he','REVIEWED');await status(other,'he','REVIEWED');
  let reads=[],writes=[],held=null;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push({method:req.method(),path:u.pathname,search:u.search});if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');
  check('built-in and project custom statuses load without a key search',await page.$eval('[name=savedSearchStatus]',e=>[...e.options].map(o=>o.value).join('|')==='|UNVERIFIED|TRANSLATED|REVIEWED|APPROVED')&&!reads.some(r=>r.path===`/api${P}/keys`));
  await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','needle');await page.select('[name=savedSearchStatus]','REVIEWED');
  check('status selection does not search automatically',!reads.some(r=>r.path===`/api${P}/keys`));
  const names=()=>page.$$eval('[name=savedSearchResult] code',nodes=>nodes.map(e=>e.textContent).sort());
  const search=async()=>{await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchCount]');};
  reads=[];await search();check('actual status and value predicates intersect in selected locale not reviewed source',JSON.stringify(await names())===JSON.stringify(['longer.reviewed','reviewed.target']));
  check('manual filter uses one existing scoped key GET and zero writes',reads.length===1&&reads[0].method==='GET'&&new URLSearchParams(reads[0].search).get('status')==='REVIEWED'&&new URLSearchParams(reads[0].search).get('locale')==='he'&&writes.length===0);
  check('result count names loaded status filter',await page.$eval('[name=savedSearchCount]',e=>e.textContent.includes('REVIEWED')));
  await page.select('[name=savedSearchMatch]','exact');await search();check('whole-value mode combines with selected status',JSON.stringify(await names())===JSON.stringify(['reviewed.target']));
  await page.screenshot({path:'/downloads/saved-search-status-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/saved-search-status-mobile.png'});check('390px status control and results fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.select('[name=savedSearchStatus]','APPROVED');check('status edit clears previous private values before explicit search',!await page.$('[name=savedSearchResult]')&&!await page.$('[name=savedSearchCount]'));await search();check('actual custom status matches only custom target row',JSON.stringify(await names())===JSON.stringify(['custom.target']));
  await page.select('[name=savedSearchStatus]','');reads=[];await search();check('any status restores matches and omits status query',JSON.stringify(await names())===JSON.stringify(['custom.target','reviewed.source.only','reviewed.target'])&&!new URLSearchParams(reads[0].search).has('status'));
  let started;const ready=new Promise(r=>started=r);held={started};await page.click('[name=runSavedSearch]');await ready;const old=held.request;held=null;await page.select('[name=savedSearchStatus]','UNVERIFIED');await old.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'private-old',name:'PRIVATE_OLD_STATUS',translations:[{localeCode:'he',value:'needle'},{localeCode:'en',value:'PRIVATE_OLD_SOURCE'}]}])});await new Promise(r=>setTimeout(r,200));check('late previous-status response cannot restore results',!await page.$('[name=savedSearchResult]')&&!await page.$('[name=savedSearchCount]'));await search();check('selected status with no matches shows empty state',!!await page.$('[name=savedSearchEmpty]')&&writes.length===0);
  check('no status-filter runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
