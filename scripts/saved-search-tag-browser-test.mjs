// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55803, WEB_PORT = 4200, API_PORT = 3000;
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
  const tagged=await put('tagged.target','he','Needle');const noTag=await put('untagged.target','he','Needle');const wrongStatus=await put('tagged.other.status','he','Needle');const wrongText=await put('tagged.other.text','he','Unrelated');const punctuation=await put('literal.punctuation','he','Needle');
  const tags=async(k,values)=>call(`${P}/keys/${k.id}/tags`,{tags:values},token,'PATCH');
  const status=async(k,value)=>call(`${P}/keys/${k.id}/translations/he/status`,{status:value},token,'PATCH');
  await tags(tagged,['Release']);await tags(wrongStatus,['Release']);await tags(wrongText,['Release']);await tags(punctuation,['_%\\']);for(const k of [tagged,noTag,wrongText,punctuation])await status(k,'REVIEWED');
  let reads=[],writes=[],held=null;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push({method:req.method(),path:u.pathname,search:u.search});if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');await page.select('[name=savedSearchLocale]','he');await page.select('[name=savedSearchStatus]','REVIEWED');await page.select('[name=savedSearchMatch]','exact');await page.type('[name=savedSearchText]','needle');await page.type('[name=savedSearchTag]','Release');
  check('optional exact tag is bounded40 and edits do not search automatically',await page.$eval('[name=savedSearchTag]',e=>e.maxLength===40)&&!reads.some(r=>r.path===`/api${P}/keys`));
  const names=()=>page.$$eval('[name=savedSearchResult] code',nodes=>nodes.map(e=>e.textContent).sort());const search=async()=>{await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchCount]');};const tag=async value=>page.$eval('[name=savedSearchTag]',(e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  reads=[];await search();check('actual tag status locale and whole-value predicates intersect',JSON.stringify(await names())===JSON.stringify(['tagged.target']));check('tag search uses one existing key GET with exact tag and zero writes',reads.length===1&&reads[0].method==='GET'&&new URLSearchParams(reads[0].search).get('tag')==='Release'&&new URLSearchParams(reads[0].search).get('status')==='REVIEWED'&&new URLSearchParams(reads[0].search).get('valueMatch')==='exact'&&writes.length===0);check('count names current tag scope',await page.$eval('[name=savedSearchCount]',e=>e.textContent.includes('tag: Release')));
  await page.screenshot({path:'/downloads/saved-search-tag-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/saved-search-tag-mobile.png'});await page.$eval('[name=savedSearchResult]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-tag-mobile-context.png'});check('390px exact tag controls fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await tag('release');check('tag edit clears old private results',!await page.$('[name=savedSearchResult]')&&!await page.$('[name=savedSearchCount]'));await search();check('exact tag membership is case-sensitive',!!await page.$('[name=savedSearchEmpty]'));
  await tag('Release ');await search();check('tag spaces are not silently trimmed',!!await page.$('[name=savedSearchEmpty]'));
  await tag('_%\\');await search();check('tag punctuation is literal membership not a wildcard',JSON.stringify(await names())===JSON.stringify(['literal.punctuation']));
  await tag('');reads=[];await search();check('blank tag omits parameter and restores any-tag matches',JSON.stringify(await names())===JSON.stringify(['literal.punctuation','tagged.target','untagged.target'])&&!new URLSearchParams(reads[0].search).has('tag'));
  let started;const ready=new Promise(r=>started=r);held={started};await page.click('[name=runSavedSearch]');await ready;const old=held.request;held=null;await tag('missing');await old.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'private-old',name:'PRIVATE_OLD_TAG',translations:[{localeCode:'he',value:'needle'}]}])});await new Promise(r=>setTimeout(r,200));check('held old-tag result cannot restore private values',!await page.$('[name=savedSearchResult]')&&!await page.$('[name=savedSearchCount]')&&writes.length===0);check('no tag-filter runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
