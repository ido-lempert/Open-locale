// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55823, WEB_PORT = 4200, API_PORT = 3000;
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
  const described=await put('with.description','he','Needle target');await put('with.description','en','Source context');
  await call(`${P}/keys/${described.id}`,{description:'Button label <img src=x onerror=alert(1)>\nUse on checkout'},token,'PATCH');
  await put('empty.description','he','Needle empty description');
  const notMatching=await put('description.only','he','Unrelated target');await call(`${P}/keys/${notMatching.id}`,{description:'Needle exists only in description'},token,'PATCH');
  let reads=[],writes=[],held=null;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push({method:req.method(),path:u.pathname,search:u.search});if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');
  await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','Needle');reads=[];
  const search=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.click('[name=runSavedSearch]');await response;await page.waitForNetworkIdle({idleTime:100});await page.waitForSelector('[name=savedSearchCount]');};await search();
  const description=n=>page.$$eval('[name=savedSearchResult]',(rows,n)=>rows.find(e=>e.querySelector('code').textContent===n).querySelector('[name=savedSearchDescription]').textContent,n);
  check('description context uses one actual scoped key read and zero writes',reads.length===1&&reads[0].method==='GET'&&writes.length===0);
  check('description is escaped multiline text beside matching source and target',(await description('with.description')).includes('Button label <img src=x onerror=alert(1)>\nUse on checkout')&&!await page.$('[name=savedSearchDescription] img'));
  check('actual empty description is labeled distinctly',(await description('empty.description')).includes('No saved key description.'));
  check('description-only occurrence is not treated as saved value match',await page.$$eval('[name=savedSearchResult] code',r=>r.length===2&&!r.some(e=>e.textContent==='description.only')));
  check('scope names loaded descriptions as context not searched/newer state',await page.$eval('[name=savedSearchScope]',e=>e.textContent.includes('loaded context only')&&e.textContent.includes('not searched')));
  await page.$eval('[name=savedSearchResult]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-description-desktop.png'});await page.setViewport({width:390,height:844});await page.$$eval('[name=savedSearchResult]',rows=>rows.find(e=>e.querySelector('code').textContent==='with.description').scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-description-mobile.png'});check('390px description and context fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await call(`${P}/keys/${described.id}`,{description:'New server context'},token,'PATCH');check('loaded description is not silently presented as newer server change',!(await description('with.description')).includes('New server context'));await search();check('explicit new search loads current actual description',(await description('with.description')).includes('New server context'));
  let started;const ready=new Promise(r=>started=r);held={started};await page.click('[name=runSavedSearch]');await ready;await page.waitForSelector('[name=savedSearchLoading]');check('pending search clears private old description',!await page.$('[name=savedSearchDescription]'));const old=held.request;held=null;await page.click('[name=clearSavedSearchFilters]');await page.waitForSelector('[name=savedSearchIdle]');await old.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'private-old',name:'PRIVATE_OLD',description:'PRIVATE_DESCRIPTION',translations:[{localeCode:'he',value:'Needle'}]}])});await new Promise(r=>setTimeout(r,200));check('late cleared response cannot restore private descriptions',!await page.$('[name=savedSearchDescription]')&&!await page.$('[name=savedSearchResult]'));
  await page.type('[name=savedSearchText]','Needle');let missingStarted;const missingReady=new Promise(r=>missingStarted=r);held={started:missingStarted};await page.click('[name=runSavedSearch]');await missingReady;await page.waitForSelector('[name=savedSearchLoading]');const missing=held.request;held=null;await missing.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'missing-description',name:'missing.description',translations:[{localeCode:'he',value:'Needle'}]}])});await page.waitForSelector('[name=savedSearchDescription]');check('absent description response is unavailable not fabricated empty',(await description('missing.description')).includes('Description unavailable in these results.'));
  check('description interactions perform no writes',writes.length===0);check('no description runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
