// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55855, WEB_PORT = 4200, API_PORT = 3000;
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

  const put=async(name,value,locale='en',branch='main')=>{const key=await call(`${P}/keys`,{name,branch},token);await call(`${P}/keys/${key.id}/translations`,{locale,value},token,'PUT');};
  await call(`${P}/branches`,{name:'release'},token);await put('one.space',' ');await put('three.spaces','   ');await put('text.spaces','x   y');await put('empty.value','');await put('other.locale','   ','he');await put('other.branch','   ','en','release');
  const exact=async q=>call(`${P}/keys?valueSearch=${encodeURIComponent(q)}&valueMatch=exact&locale=en&branch=main`,null,token);
  check('actual PostgreSQL exact spaces distinguish one versus three and exclude nonempty/empty/other scope',(await exact(' ')).map(k=>k.name).join(',')==='one.space'&&(await exact('   ')).map(k=>k.name).join(',')==='three.spaces');
  let reads=[],writes=[],held=null;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push(req.method()+u.pathname+u.search);if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');await page.type('[name=savedSearchText]','   ');reads=[];
  check('default whitespace-only substring remains disabled',await page.$eval('[name=runSavedSearch]',e=>e.disabled)&&reads.length===0);await page.select('[name=savedSearchMatch]','exact');await page.waitForFunction(()=>!document.querySelector('[name=runSavedSearch]').disabled);check('whole value enables nonempty whitespace without automatic query',reads.length===0);
  const search=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.$eval('[name=runSavedSearch]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=runSavedSearch]');await response;await page.waitForSelector('[name=savedSearchCount]');await page.waitForNetworkIdle({idleTime:100});};
  await page.focus('[name=savedSearchText]');const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.keyboard.press('Enter');await response;await page.waitForSelector('[name=savedSearchCount]');await page.waitForNetworkIdle({idleTime:100});
  check('actual Enter search finds only three-space base value',await page.$$eval('[name=savedSearchResult] code',rows=>rows.length===1&&rows[0].textContent==='three.spaces'));check('exact query sends all three spaces in one GET with no writes',reads.length===1&&new URL(reads[0].slice(3),WEB).searchParams.get('valueSearch')==='   '&&new URL(reads[0].slice(3),WEB).searchParams.get('valueMatch')==='exact'&&writes.length===0);check('whitespace-only result has explicit code-unit count',await page.$eval('[name=savedSearchWhitespaceValue]',e=>e.textContent.includes('3 UTF-16 code units')));
  const context=await browser.defaultBrowserContext();await context.overridePermissions(WEB,['clipboard-read','clipboard-sanitized-write']);await page.click('[name=copySavedSearchValue]');await page.waitForSelector('[name=savedSearchCopyNotice]');check('copy retains exact three spaces',await page.evaluate(async()=>await navigator.clipboard.readText()==='   '));
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'deny'});await page.evaluate(()=>{window.__report=null;URL.createObjectURL=blob=>{window.__report=blob;return 'blob:local-test';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.click('[name=downloadSavedSearch]');await page.waitForFunction(()=>window.__report!==null);const report=await page.evaluate(async()=>JSON.parse(await window.__report.text()));check('report preserves whitespace query and value exactly',report.filters.query==='   '&&report.filters.match==='exact'&&report.matches.length===1&&report.matches[0].value==='   ');
  await page.$eval('[name=savedSearchWhitespaceValue]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-whitespace-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=savedSearchWhitespaceValue]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-whitespace-mobile.png'});check('390px whitespace result label fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.select('[name=savedSearchMatch]','contains');await page.waitForSelector('[name=savedSearchIdle]');check('switching back clears private rows and disables whitespace substring',!await page.$('[name=savedSearchResult]')&&await page.$eval('[name=runSavedSearch]',e=>e.disabled));await page.select('[name=savedSearchMatch]','exact');
  let started;const ready=new Promise(r=>started=r);held={started};await page.$eval('[name=runSavedSearch]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=runSavedSearch]');await ready;await page.waitForSelector('[name=savedSearchLoading]');await page.select('[name=savedSearchMatch]','contains');const old=held.request;held=null;await old.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'old',name:'private.old',translations:[{localeCode:'en',value:'   '}]}])});await new Promise(r=>setTimeout(r,100));check('mode edit fences held whitespace result',!await page.$('[name=savedSearchResult]')&&!await page.$('[name=savedSearchLoading]'));
  await page.select('[name=savedSearchMatch]','exact');await page.click('[name=clearSavedSearchFilters]');await page.waitForFunction(()=>document.querySelector('[name=savedSearchText]').value===''&&document.querySelector('[name=savedSearchMatch]').value==='contains'&&document.querySelector('[name=runSavedSearch]').disabled);check('clear resets exact whitespace query to empty substring',await page.$eval('[name=savedSearchText]',e=>e.value==='')&&await page.$eval('[name=savedSearchMatch]',e=>e.value==='contains')&&await page.$eval('[name=runSavedSearch]',e=>e.disabled));check('whole whitespace flow never writes',writes.length===0);check('no whitespace-search runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
