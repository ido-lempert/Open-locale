// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.OTA_SEARCH_META_TEST_PG_PORT ?? 56348), WEB_PORT = 4200, API_PORT = 3000;
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

  await call(`${P}/import/en`,{entries:{valid:'Release [A]'}},token);const pub=await call(`${P}/ota/publish`,{},token);await page.goto(`${WEB}${P}/ota/1/en?branch=main&publicationId=${pub.id}`,{waitUntil:'networkidle0'});await page.waitForSelector('.bundle-row');let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/'))req.method()==='GET'?reads++:writes++;req.continue();});
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-ota-bundle')),translations={raw:null,number:42,bool:true,object:{},array:[],empty:'',spaces:'  ',valid:'Release [A]'};c.bundle.set({...c.bundle(),translations});c.rows.set(Object.entries(translations));});
  const search=async value=>{await page.$eval('[name=bundleSearch]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));};await search('[a]');await page.waitForFunction(()=>document.querySelector('[name=bundleMatches]')?.textContent.startsWith('1 of 8'));check('literal valid retained text survives malformed values',await page.$eval('.bundle-value',e=>e.textContent==='Release [A]')&&reads===0&&writes===0);
  for(const value of ['42','true','[object']){await search(value);await page.waitForSelector('[name=bundleEmpty]');check('nonstring retained value not coerced into search '+value,await page.$eval('[name=bundleMatches]',e=>e.textContent.startsWith('0 of 8'))&&reads===0&&writes===0);}
  await page.screenshot({path:'/downloads/ota-search-metadata-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/ota-search-metadata-mobile.png',fullPage:true});check('390px search and retained-only empty guidance fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__report=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.$eval('[name=downloadBundle]',e=>e.click());await page.waitForFunction(()=>!!window.__report);check('full retained download preserves raw numeric null and array values',await page.evaluate(()=>{const t=window.__report.bundle.translations;return Object.keys(t).length===8&&t.raw===null&&t.number===42&&Array.isArray(t.array);})&&reads===0&&writes===0);
  await search('RAW');check('valid key remains searchable independently of malformed value',await page.$eval('.bundle-key',e=>e.textContent==='raw'));await search('');await page.select('[name=bundleValueFilter]','empty');await page.waitForFunction(()=>document.querySelector('[name=bundleMatches]')?.textContent.startsWith('1 of 8'));check('exact empty classification unchanged',await page.$eval('.bundle-key',e=>e.textContent==='empty')&&reads===0&&writes===0);await page.select('[name=bundleValueFilter]','');await page.waitForFunction(()=>document.querySelectorAll('.bundle-row').length===8);check('clear restores full raw loaded set without repair or reread',reads===0&&writes===0&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-ota-bundle')).rows()[1][1]===42));check('no retained value search runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

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
