// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55847, WEB_PORT = 4200, API_PORT = 3000;
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

  const key=await call(`${P}/keys`,{name:'context.key'},token);await call(`${P}/keys/${key.id}/translations`,{locale:'he',value:'Needle target'},token,'PUT');await call(`${P}/keys/${key.id}/comments`,{body:'PRIVATE_SOURCE_COMMENT',locale:'en'},token);await call(`${P}/keys/${key.id}/comments`,{body:'PRIVATE_TARGET_COMMENT',locale:'he'},token);
  await prisma.screenshot.create({data:{keyId:key.id,projectId:project.id,filename:'fixture.png',mimeType:'image/png',byteSize:1,data:Buffer.from([0])}}); // Count-only DB fixture; not a valid uploaded image or upload acceptance claim.
  const empty=await call(`${P}/keys`,{name:'empty.context'},token);await call(`${P}/keys/${empty.id}/translations`,{locale:'he',value:'Needle empty'},token,'PUT');
  let reads=[],writes=[],held=null;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push(req.method()+u.pathname);if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','Needle');reads=[];
  const search=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.$eval('[name=runSavedSearch]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=runSavedSearch]');await response;await page.waitForSelector('[name=savedSearchCount]');await page.waitForNetworkIdle({idleTime:100});};await search();
  const counts=name=>page.$$eval('[name=savedSearchResult]',(rows,name)=>rows.find(e=>e.querySelector('code').textContent===name).querySelector('[name=savedSearchContextCounts]').textContent,name);
  check('context counts use same one key GET and zero writes',reads.length===1&&writes.length===0);check('actual persisted comments count is key-wide not matching locale',(await counts('context.key')).includes('comments 2; screenshots 1'));check('actual zero counts are not unavailable',(await counts('empty.context')).includes('comments 0; screenshots 0'));check('scope states loaded key-wide not contents or newer server state',(await counts('context.key')).includes('Not matching-locale counts or newer server changes; contents are not loaded here'));check('private comment bodies are not shown',!(await page.content()).includes('PRIVATE_SOURCE_COMMENT')&&!(await page.content()).includes('PRIVATE_TARGET_COMMENT'));
  await page.$$eval('[name=savedSearchResult]',rows=>rows.find(e=>e.querySelector('code').textContent==='context.key').scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-context-counts-desktop.png'});await page.setViewport({width:390,height:844});await page.$$eval('[name=savedSearchResult]',rows=>rows.find(e=>e.querySelector('code').textContent==='context.key').querySelector('[name=savedSearchContextCounts]').scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-context-counts-mobile.png'});check('390px context counts fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await call(`${P}/keys/${key.id}/comments`,{body:'NEW_PRIVATE_COMMENT'},token);check('loaded count does not claim newer comments',(await counts('context.key')).includes('comments 2;'));await search();check('explicit search reads actual newer count',(await counts('context.key')).includes('comments 3;'));
  let started;const ready=new Promise(r=>started=r);held={started};await page.$eval('[name=runSavedSearch]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=runSavedSearch]');await ready;await page.waitForSelector('[name=savedSearchLoading]');check('pending read clears old counts',!await page.$('[name=savedSearchContextCounts]'));const old=held.request;held=null;await page.click('[name=clearSavedSearchFilters]');await old.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'old',name:'old',_count:{comments:999,screenshots:999},translations:[{localeCode:'he',value:'Needle'}]}])});await new Promise(r=>setTimeout(r,150));check('late cleared reply cannot restore counts',!await page.$('[name=savedSearchContextCounts]'));
  await page.type('[name=savedSearchText]','Needle');let missingStarted;const missingReady=new Promise(r=>missingStarted=r);held={started:missingStarted};await page.click('[name=runSavedSearch]');await missingReady;const missing=held.request;held=null;await missing.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'missing',name:'missing',translations:[{localeCode:'he',value:'Needle'}]}])});await page.waitForSelector('[name=savedSearchContextCounts]');check('missing counts are unavailable not fabricated zero',(await counts('missing')).includes('comments unavailable; screenshots unavailable'));check('entire counts flow never writes',writes.length===0);check('no context count runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
