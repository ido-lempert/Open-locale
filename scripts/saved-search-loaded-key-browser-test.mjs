// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55843, WEB_PORT = 4200, API_PORT = 3000;
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

  for(const name of ['A_%\\key','other','<literal> key']){const key=await call(`${P}/keys`,{name:'fixture.'+Math.random().toString(16).slice(2),description:'Private context'},token);await prisma.key.update({where:{id:key.id},data:{name}});await call(`${P}/keys/${key.id}/translations`,{locale:'he',value:'Needle target'},token,'PUT');}
  let reads=[],writes=[],held=null;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push(req.method()+u.pathname);if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','Needle');reads=[];
  const search=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.click('[name=runSavedSearch]');await response;await page.waitForSelector('[name=savedSearchCount]');await page.waitForNetworkIdle({idleTime:100});};await search();
  const names=()=>page.$$eval('[name=savedSearchResult] code',nodes=>nodes.map(n=>n.textContent));
  const filter=async value=>{await page.$eval('[name=savedSearchLoadedKey]',(e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.waitForFunction(value=>document.querySelector('[name=savedSearchLoadedKey]').value===value,{},value);await new Promise(r=>setTimeout(r,50));};
  check('initial local count names all loaded matches',(await names()).length===3&&await page.$eval('[name=savedSearchLoadedKeyCount]',e=>e.textContent.startsWith('3 of 3')));
  reads=[];await filter('a_%\\');check('literal case-insensitive punctuation filter narrows actual key rows',JSON.stringify(await names())===JSON.stringify(['A_%\\key']));check('local filter does not make requests or writes',reads.length===0&&writes.length===0);check('loaded server count stays distinct from visible count',await page.$eval('[name=savedSearchCount]',e=>e.textContent.startsWith('3 matching'))&&await page.$eval('[name=savedSearchLoadedKeyCount]',e=>e.textContent.startsWith('1 of 3')));
  await page.screenshot({path:'/downloads/saved-search-loaded-key-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=savedSearchLoadedKey]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-loaded-key-mobile.png'});check('390px local filter fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'deny'});await page.evaluate(()=>{window.__report=null;URL.createObjectURL=blob=>{window.__report=blob;return 'blob:local-test';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.click('[name=downloadSavedSearch]');await page.waitForFunction(()=>window.__report!==null);const report=await page.evaluate(async()=>JSON.parse(await window.__report.text()));check('download still includes all three loaded rows not just local subset',report.matches.length===3&&report.matches.some(r=>r.key==='other')&&!Object.hasOwn(report.filters,'loadedKeyQuery'));check('download scope explicitly ignores local key-name filter',await page.$eval('[name=savedSearchDownloadScope]',e=>e.textContent.includes('regardless of the local key-name filter')));
  await filter('Needle');check('local filter never searches matched text',!!await page.$('[name=savedSearchEmpty]')&&await page.$eval('[name=savedSearchEmpty]',e=>e.textContent.includes('No loaded key names')));await filter(' key');check('spaces are retained in local key-name matching',JSON.stringify(await names())===JSON.stringify(['<literal> key']));check('markup-looking key remains literal',!await page.$('[name=savedSearchResult] literal'));
  await page.click('[name=clearSavedSearchLoadedKey]');await page.waitForFunction(()=>document.querySelector('[name=savedSearchLoadedKey]').value==='');check('clear local filter restores all rows with no GET',(await names()).length===3&&reads.length===0);await filter('other');await search();check('explicit new saved search resets local filter',await page.$eval('[name=savedSearchLoadedKey]',e=>e.value==='')&&(await names()).length===3);
  await filter('other');await page.type('[name=savedSearchText]','x');await page.waitForSelector('[name=savedSearchIdle]');check('saved query edit removes local controls and private rows',!await page.$('[name=savedSearchLoadedKey]')&&!await page.$('[name=savedSearchResult]'));check('local narrowing never writes',writes.length===0);check('no local key filter runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
