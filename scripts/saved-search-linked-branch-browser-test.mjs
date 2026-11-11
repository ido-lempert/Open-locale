// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55859, WEB_PORT = 4200, API_PORT = 3000;
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

  const put=async(name,value,branch='main')=>{const key=await call(`${P}/keys`,{name,branch},token);await call(`${P}/keys/${key.id}/translations`,{locale:'en',value},token,'PUT');};await call(`${P}/branches`,{name:'release'},token);await put('main.match','Needle main');await put('release.match','Needle release','release');
  let reads=[],writes=[],held=null,failBranches=false;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(failBranches&&u.pathname===`/api${P}/branches`){failBranches=false;req.respond({status:503,contentType:'application/json',body:'{}'});return;}if(u.pathname.startsWith('/api/')){reads.push(req.method()+u.pathname+u.search);if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=branch]');await page.select('[name=branch]','release');await page.waitForNetworkIdle({idleTime:100});const link=await page.$eval('[name=findSavedText]',e=>e.href);check('editor link carries selected branch only',new URL(link).searchParams.get('branch')==='release'&&[...new URL(link).searchParams.keys()].join(',')==='branch');reads=[];await page.click('[name=findSavedText]');await page.waitForSelector('[name=savedSearchIdle]');await page.waitForNetworkIdle({idleTime:100});check('click opens current release branch without automatic key read',await page.$eval('[name=savedSearchBranch]',e=>e.value==='release')&&!reads.some(r=>r.includes('/keys'))&&writes.length===0);check('locale remains explicit base default not inferred import-export locale',await page.$eval('[name=savedSearchLocale]',e=>e.value==='en'));
  await page.type('[name=savedSearchText]','Needle');const search=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.$eval('[name=runSavedSearch]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=runSavedSearch]');await response;await page.waitForSelector('[name=savedSearchCount]');await page.waitForNetworkIdle({idleTime:100});};await search();check('manual release search excludes main result',await page.$$eval('[name=savedSearchResult] code',rows=>rows.length===1&&rows[0].textContent==='release.match'));
  await page.$eval('[name=savedSearchCount]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-linked-branch-result-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=savedSearchCount]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-linked-branch-result-mobile.png'});await page.setViewport({width:1280,height:900});
  const navigate=async(branch,wait=true)=>{await page.evaluate(async({branch,P})=>{const anchor=document.querySelector('header a'),directive=window.ng.getDirectives(anchor).find(d=>d.router);await directive.router.navigateByUrl(P+'/find?branch='+encodeURIComponent(branch));},{branch,P});if(wait)await page.waitForNetworkIdle({idleTime:100});};
  await page.evaluate(()=>document.querySelector('ol-saved-search').dataset.reuse='same-component');reads=[];await navigate('main');await page.waitForSelector('[name=savedSearchIdle]');check('query-only router navigation reuses component and resets private result/query',await page.$eval('ol-saved-search',e=>e.dataset.reuse==='same-component')&&await page.$eval('[name=savedSearchBranch]',e=>e.value==='main')&&await page.$eval('[name=savedSearchText]',e=>e.value==='')&&!await page.$('[name=savedSearchResult]')&&!reads.some(r=>r.includes('/keys')));
  await navigate('missing');await page.waitForSelector('[name=savedSearchLinkedBranchUnavailable]');check('unavailable linked branch never silently selects main',await page.$eval('[name=savedSearchBranch]',e=>e.value===''&&!e.disabled));check('missing branch blocks saved-value search',await page.$eval('[name=runSavedSearch]',e=>e.disabled)&&!reads.some(r=>r.includes('/keys')));
  await page.screenshot({path:'/downloads/saved-search-linked-branch-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=savedSearchLinkedBranchUnavailable]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-linked-branch-mobile.png'});check('390px branch warning fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.select('[name=savedSearchBranch]','release');await page.waitForFunction(()=>!document.querySelector('[name=savedSearchLinkedBranchUnavailable]'));await page.type('[name=savedSearchText]','Needle');await search();check('explicit branch choice recovers manual release result',await page.$$eval('[name=savedSearchResult] code',rows=>rows.length===1&&rows[0].textContent==='release.match'));
  let started;const ready=new Promise(r=>started=r);held={started};await page.$eval('[name=runSavedSearch]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=runSavedSearch]');await ready;await page.waitForSelector('[name=savedSearchLoading]');await navigate('main',false);await page.waitForSelector('[name=savedSearchIdle]');const old=held.request;held=null;await old.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'old',name:'private.old',translations:[{localeCode:'en',value:'Needle'}]}])});await new Promise(r=>setTimeout(r,100));check('query-only scope navigation fences held previous branch result',await page.$eval('[name=savedSearchBranch]',e=>e.value==='main')&&!await page.$('[name=savedSearchResult]')&&!await page.$('[name=savedSearchLoading]'));
  failBranches=true;await navigate('release');await page.waitForSelector('[name=retrySavedOptions]');await page.click('[name=retrySavedOptions]');await page.waitForSelector('[name=savedSearchIdle]');check('option failure retry keeps explicit linked release branch',await page.$eval('[name=savedSearchBranch]',e=>e.value==='release')&&await page.$eval('[name=savedSearchText]',e=>e.value===''));
  check('branch handoff never writes',writes.length===0);check('no linked branch runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
