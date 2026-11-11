// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55839, WEB_PORT = 4200, API_PORT = 3000;
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

  const key=await call(`${P}/keys`,{name:'cancel.key',tags:[' exact tag ']},token);await call(`${P}/keys/${key.id}/translations`,{locale:'he',value:'Needle target'},token,'PUT');
  let reads=[],writes=[],held=null;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push(req.method()+u.pathname);if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');await page.select('[name=savedSearchLocale]','he');await page.select('[name=savedSearchMatch]','exact');await page.type('[name=savedSearchText]','Needle target');await page.type('[name=savedSearchTag]',' exact tag ');reads=[];
  const hold=async()=>{let started;const ready=new Promise(r=>started=r);held={started};await page.click('[name=runSavedSearch]');await ready;await page.waitForSelector('[name=savedSearchLoading]');const request=held.request;held=null;return request;};
  const reply=(request,id,value)=>request.respond({status:200,contentType:'application/json',body:JSON.stringify([{id,name:id,tags:[],translations:[{localeCode:'he',value}]}])});
  const filters=()=>page.evaluate(()=>['savedSearchBranch','savedSearchLocale','savedSearchMatch','savedSearchStatus','savedSearchText','savedSearchTag'].map(n=>document.querySelector(`[name=${n}]`).value));
  const original=await filters();const first=await hold();
  check('pending read exposes cancel with honest network scope',!!await page.$('[name=cancelSavedSearch]')&&await page.$eval('[name=savedSearchCancelScope]',e=>e.textContent.includes('network request may still finish')));
  await page.$eval('[name=cancelSavedSearch]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-cancel-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=cancelSavedSearch]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-cancel-mobile.png'});check('390px pending cancel layout fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.focus('[name=cancelSavedSearch]');await page.keyboard.press('Enter');await page.waitForSelector('[name=savedSearchIdle]');await page.waitForFunction(()=>document.activeElement?.getAttribute('name')==='savedSearchText');
  check('keyboard cancel returns focus to text',await page.$eval('[name=savedSearchText]',e=>e===document.activeElement));check('cancel keeps exact query and all scope filters',JSON.stringify(await filters())===JSON.stringify(original));check('cancel does not issue another request or write',reads.length===1&&writes.length===0);check('cancel returns idle without results or download',!await page.$('[name=savedSearchResult]')&&!await page.$('[name=downloadSavedSearch]')&&!await page.$('[name=cancelSavedSearch]'));
  await reply(first,'PRIVATE_OLD','PRIVATE_OLD_VALUE');await new Promise(r=>setTimeout(r,150));check('late canceled private reply cannot restore results',!await page.$('[name=savedSearchResult]')&&!(await page.content()).includes('PRIVATE_OLD'));
  const actual=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.click('[name=runSavedSearch]');await actual;await page.waitForSelector('[name=savedSearchResult]');check('explicit new search loads actual persisted value',await page.$eval('[name=savedSearchMatched] pre',e=>e.textContent==='Needle target'));check('idle has no cancel action',!await page.$('[name=cancelSavedSearch]'));
  const second=await hold();await page.click('[name=cancelSavedSearch]');await page.waitForSelector('[name=savedSearchIdle]');const third=await hold();await reply(second,'STALE','STALE_PRIVATE');await new Promise(r=>setTimeout(r,150));check('late old read cannot settle newer pending search',!!await page.$('[name=savedSearchLoading]')&&!await page.$('[name=savedSearchResult]'));
  await reply(third,'FRESH','Fresh loaded value');await page.waitForSelector('[name=savedSearchResult]');check('newer read alone supplies its result',await page.$eval('[name=savedSearchMatched] pre',e=>e.textContent==='Fresh loaded value'));
  const failed=await hold();await page.click('[name=cancelSavedSearch]');await page.waitForSelector('[name=savedSearchIdle]');await failed.respond({status:503,contentType:'application/json',body:'{}'});await new Promise(r=>setTimeout(r,150));check('late canceled failure does not show error',!await page.$('[name=savedSearchError]')&&!!await page.$('[name=savedSearchIdle]'));check('cancel flow never writes',writes.length===0);check('no cancel runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
