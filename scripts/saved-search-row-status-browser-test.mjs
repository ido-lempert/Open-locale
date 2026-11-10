// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55811, WEB_PORT = 4200, API_PORT = 3000;
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
  await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','needle');reads=[];
  const search=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.click('[name=runSavedSearch]');await response;await page.waitForNetworkIdle({idleTime:100});await page.waitForSelector('[name=savedSearchCount]');};
  await search();await page.waitForSelector('[name=savedSearchRowStatus]');
  const getStatus=n=>page.$$eval('[name=savedSearchResult]',(rows,n)=>rows.find(e=>e.querySelector('code').textContent===n).querySelector('[name=savedSearchRowStatus]').textContent,n);
  check('one scoped actual key GET and no writes for Any status rows',reads.length===1&&reads[0].method==='GET'&&!new URLSearchParams(reads[0].search).has('status')&&writes.length===0);
  check('actual reviewed target and translated target do not inherit opposite source status',(await getStatus('reviewed.target')).includes('Loaded saved status: REVIEWED.')&&(await getStatus('reviewed.source.only')).includes('Loaded saved status: TRANSLATED.'));
  check('actual custom saved status is displayed as text',(await getStatus('custom.target')).includes(customText)&&!await page.$('[name=savedSearchRowStatus] img'));
  check('loaded status explicitly denies live review confirmation',await page.$$eval('[name=savedSearchRowStatus]',rows=>rows.every(e=>e.textContent.includes('Not a live review confirmation.'))));
  await page.$eval('[name=savedSearchResult]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-row-status-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=savedSearchRowStatus]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-row-status-mobile.png'});
  check('390px status and value remain within viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await status(reviewed,'he','TRANSLATED');check('already loaded status does not claim later server state',(await getStatus('reviewed.target')).includes('Loaded saved status: REVIEWED.'));await search();check('explicit new search loads newer actual saved status',(await getStatus('reviewed.target')).includes('Loaded saved status: TRANSLATED.'));
  let started;const ready=new Promise(r=>started=r);held={started};await page.click('[name=runSavedSearch]');await ready;await page.waitForSelector('[name=savedSearchLoading]');check('pending search removes previous row status',!await page.$('[name=savedSearchRowStatus]'));const old=held.request;held=null;await page.select('[name=savedSearchLocale]','en');await old.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'private-old',name:'PRIVATE_OLD_STATUS',translations:[{localeCode:'he',value:'needle',status:'PRIVATE_STATUS'}]}])});await new Promise(r=>setTimeout(r,200));check('late prior-locale response cannot restore private status',!await page.$('[name=savedSearchResult]')&&!await page.$('[name=savedSearchRowStatus]'));
  let nextStarted;const nextReady=new Promise(r=>nextStarted=r);held={started:nextStarted};await page.click('[name=runSavedSearch]');await nextReady;const missing=held.request;held=null;await missing.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'missing-status',name:'missing.status',translations:[{localeCode:'en',value:'needle'}]}])});await page.waitForFunction(()=>document.querySelector('[name=savedSearchResult] code')?.textContent==='missing.status');check('missing status response is labeled unavailable rather than fabricated unverified',(await getStatus('missing.status')).includes('not available in these results')&&!(await getStatus('missing.status')).includes('UNVERIFIED'));
  let escapedStarted;const escapedReady=new Promise(r=>escapedStarted=r);held={started:escapedStarted};await page.click('[name=runSavedSearch]');await escapedReady;await page.waitForSelector('[name=savedSearchLoading]');const escaped=held.request;held=null;await escaped.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'escaped-status',name:'escaped.status',translations:[{localeCode:'en',value:'needle',status:'<img src=x onerror=alert(1)>'}]}])});await page.waitForFunction(()=>document.querySelector('[name=savedSearchResult] code')?.textContent==='escaped.status');check('adversarial returned status is escaped text and cannot create HTML',(await getStatus('escaped.status')).includes('<img src=x onerror=alert(1)>')&&!await page.$('[name=savedSearchRowStatus] img'));
  check('read-only flow makes zero writes',writes.length===0);check('no loaded-status runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
