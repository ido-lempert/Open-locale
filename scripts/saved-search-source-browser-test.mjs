// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55799, WEB_PORT = 4200, API_PORT = 3000;
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
  await put('with.source','en','Source <img src=x onerror=alert(1)> context');await put('with.source','he','Needle target');await put('empty.source','en','');await put('empty.source','he','Needle empty source');await put('missing.source','he','Needle missing source');
  let reads=[],writes=[];await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push({method:req.method(),path:u.pathname,search:u.search});if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','needle');reads=[];await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchCount]');
  const article=await page.$('[name=savedSearchResult]');check('source context uses only one actual existing key read and no writes',reads.length===1&&reads[0].method==='GET'&&reads[0].path===`/api${P}/keys`&&writes.length===0);
  check('actual saved source and matched target carry distinct locale labels and escaped text',await page.$$eval('[name=savedSearchResult]',rows=>{const row=rows.find(e=>e.querySelector('code').textContent==='with.source');return row.querySelector('[name=savedSearchSource]').textContent.includes('Saved source (en)')&&row.querySelector('[name=savedSearchSource]').textContent.includes('Source <img src=x')&&!row.querySelector('img')&&row.querySelector('[name=savedSearchMatched]').textContent.includes('Matched saved value (he)')&&row.querySelector('[name=savedSearchMatched]').textContent.includes('Needle target');}));
  check('actual empty and absent source rows remain visibly different',await page.$$eval('[name=savedSearchResult]',rows=>{const get=n=>rows.find(e=>e.querySelector('code').textContent===n).querySelector('[name=savedSearchSource]').textContent;return get('empty.source').includes('Saved source value is empty.')&&get('missing.source').includes('No saved source translation row');}));
  await page.screenshot({path:'/downloads/saved-search-source-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/saved-search-source-mobile.png'});await page.$$eval('[name=savedSearchResult]',rows=>rows.find(e=>e.querySelector('code').textContent==='with.source').scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-source-mobile-context.png'});check('390px source/result layout fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.select('[name=savedSearchLocale]','en');check('locale change clears all old private source context',!await page.$('[name=savedSearchSource]')&&!await page.$('[name=savedSearchResult]'));await page.$eval('[name=savedSearchText]',e=>{e.value='Source';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchCount]');check('base-locale matches do not duplicate their own source',!await page.$('[name=savedSearchSource]')&&await page.$eval('[name=savedSearchMatched]',e=>e.textContent.includes('Matched saved value (en)'))&&writes.length===0);
  check('no source-context runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
