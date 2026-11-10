// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55835, WEB_PORT = 4200, API_PORT = 3000;
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

  const key=await call(`${P}/keys`,{name:'tagged.key'},token);await call(`${P}/keys/${key.id}/translations`,{locale:'he',value:'Needle target'},token,'PUT');await call(`${P}/keys/${key.id}/tags`,{tags:['<img src=x onerror=alert(1)>',' spaced tag ','long_tag_'.repeat(4)]},token,'PATCH');
  const empty=await call(`${P}/keys`,{name:'empty.tags'},token);await call(`${P}/keys/${empty.id}/translations`,{locale:'he',value:'Needle empty'},token,'PUT');
  let reads=[],writes=[],held=null;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push(req.method()+u.pathname);if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','Needle');reads=[];
  const search=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.click('[name=runSavedSearch]');await response;await page.waitForSelector('[name=savedSearchCount]');await page.waitForNetworkIdle({idleTime:100});};await search();
  const tags=n=>page.$$eval('[name=savedSearchResult]',(rows,n)=>rows.find(e=>e.querySelector('code').textContent===n).querySelector('[name=savedSearchTags]').textContent,n);
  check('tags use same one scoped GET and zero writes',reads.length===1&&writes.length===0);
  check('actual persisted tags render literally without markup',(await tags('tagged.key')).includes('<img src=x onerror=alert(1)>')&&!await page.$('[name=savedSearchTags] img'));
  check('empty tag array distinctly labeled',(await tags('empty.tags')).includes('No saved key tags.'));
  check('scope labels displayed tags as loaded context',await page.$eval('[name=savedSearchScope]',e=>e.textContent.includes('displayed tags are loaded context only')));
  await page.$eval('[name=savedSearchTags]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-tags-context-desktop.png'});await page.setViewport({width:390,height:844});await page.$$eval('[name=savedSearchResult]',rows=>rows.find(e=>e.querySelector('code').textContent==='tagged.key').scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-tags-context-mobile.png'});check('390px tag list fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await call(`${P}/keys/${key.id}/tags`,{tags:['NEW_SERVER_TAG']},token,'PATCH');check('loaded tags do not claim newer server changes',!(await tags('tagged.key')).includes('NEW_SERVER_TAG'));await search();check('explicit new search loads actual newer tags',(await tags('tagged.key')).includes('NEW_SERVER_TAG'));
  let started;const ready=new Promise(r=>started=r);held={started};await page.click('[name=runSavedSearch]');await ready;await page.waitForSelector('[name=savedSearchLoading]');check('pending read clears private loaded tags',!await page.$('[name=savedSearchTags]'));const old=held.request;held=null;await page.click('[name=clearSavedSearchFilters]');await old.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'private-old',name:'old',tags:['PRIVATE_TAG'],translations:[{localeCode:'he',value:'Needle'}]}])});await new Promise(r=>setTimeout(r,100));check('late cleared reply cannot restore private tags',!await page.$('[name=savedSearchTags]'));
  await page.type('[name=savedSearchText]','Needle');let missingStarted;const missingReady=new Promise(r=>missingStarted=r);held={started:missingStarted};await page.click('[name=runSavedSearch]');await missingReady;const missing=held.request;held=null;await missing.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'missing',name:'missing.tags',translations:[{localeCode:'he',value:'Needle'}]}])});await page.waitForSelector('[name=savedSearchTags]');check('missing tag response is unavailable not fabricated empty',(await tags('missing.tags')).includes('Tags unavailable in these results.'));check('tag flow never writes',writes.length===0);check('no tag runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
