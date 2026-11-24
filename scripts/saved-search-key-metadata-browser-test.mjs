// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SAVED_SEARCH_KEY_META_TEST_PG_PORT ?? 56346), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  const key=await call(`${P}/keys`,{name:'Valid'},token);await call(`${P}/keys/${key.id}/translations`,{locale:'he',value:'Needle target'},token,'PUT');await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','Needle');await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchCount]');let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/'))req.method()==='GET'?reads++:writes++;req.continue();});
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-saved-search')),row=c.results()[0];c.results.set([...([null,42,true,{},[]].map((key,i)=>({...row,id:'bad'+i,key}))),{...row,id:'valid',key:'Release [A]'}]);});
  const filter=async value=>{await page.$eval('[name=savedSearchLoadedKey]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));};await filter('[a]');await page.waitForFunction(()=>document.querySelector('[name=savedSearchLoadedKeyCount]')?.textContent.startsWith('1 of 6'));check('literal valid key match survives malformed loaded keys',await page.$$eval('[name=savedSearchResult] code',es=>es.length===1&&es[0].textContent==='Release [A]')&&reads===0&&writes===0);
  for(const value of ['42','true','object']){await filter(value);await page.waitForSelector('[name=savedSearchEmpty]');check('nonstring key not coerced into query '+value,await page.$eval('[name=savedSearchLoadedKeyCount]',e=>e.textContent.startsWith('0 of 6'))&&reads===0&&writes===0);}
  await page.$eval('[name=savedSearchLoadedKey]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-key-metadata-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=savedSearchLoadedKey]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-key-metadata-mobile.png'});check('390px local key filter and empty guidance fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__report=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.$eval('[name=downloadSavedSearch]',e=>e.click());await page.waitForFunction(()=>!!window.__report);check('full report preserves raw loaded keys despite zero visible matches',await page.evaluate(()=>window.__report.matches.length===6&&window.__report.matches[1].key===42&&Array.isArray(window.__report.matches[4].key))&&reads===0&&writes===0);
  await page.$eval('[name=clearSavedSearchLoadedKey]',e=>e.click());await page.waitForFunction(()=>document.querySelectorAll('[name=savedSearchResult]').length===6);check('clear restores loaded set without repair or reread',reads===0&&writes===0&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-saved-search')).results()[1].key===42));check('no saved-search key metadata runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(!completed||failures?1:0);
