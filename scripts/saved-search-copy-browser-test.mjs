// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55831, WEB_PORT = 4200, API_PORT = 3000;
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

  const matched='  =Needle <b>literal</b>\nעברית  ';const key=await call(`${P}/keys`,{name:'copy.target',description:'SOURCE_DESCRIPTION_PRIVATE'},token);await call(`${P}/keys/${key.id}/translations`,{locale:'he',value:matched},token,'PUT');await call(`${P}/keys/${key.id}/translations`,{locale:'en',value:'SOURCE_PRIVATE'},token,'PUT');
  await browser.defaultBrowserContext().overridePermissions(WEB,['clipboard-read','clipboard-sanitized-write']);
  let reads=[],writes=[];await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push(req.method()+u.pathname);if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','Needle');
  const search=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/keys`);await page.click('[name=runSavedSearch]');await response;await page.waitForSelector('[name=savedSearchCount]');await page.waitForNetworkIdle({idleTime:100});};await search();reads=[];
  await page.click('[name=copySavedSearchValue]');await page.waitForFunction(()=>document.querySelector('[name=savedSearchCopyNotice]')?.textContent.includes('copied to clipboard'));
  check('actual clipboard receives exact loaded matched value only',await page.evaluate(()=>navigator.clipboard.readText())===matched);
  check('copy performs no extra API read or write',reads.length===0&&writes.length===0);
  check('clipboard scope names private text and noncancelable started copy',await page.$eval('[name=savedSearchCopyScope]',e=>e.textContent.includes('private text')&&e.textContent.includes('does not cancel')));
  await page.screenshot({path:'/downloads/saved-search-copy-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=copySavedSearchValue]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-copy-mobile.png'});check('390px copy control and text fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{window.savedWrite=Object.getOwnPropertyDescriptor(navigator,'clipboard');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('PRIVATE_DENIAL'))}});});await page.click('[name=copySavedSearchValue]');await page.waitForFunction(()=>document.querySelector('[name=savedSearchCopyNotice]')?.textContent.includes('could not be confirmed'));check('denial shows fixed feedback without private failure',await page.$eval('[name=savedSearchCopyNotice]',e=>!e.textContent.includes('PRIVATE_DENIAL')&&e.textContent.includes('manually')));
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise(r=>window.finishCopy=r)}}));await page.click('[name=copySavedSearchValue]');await page.waitForFunction(()=>document.querySelector('[name=copySavedSearchValue]').disabled);check('pending copy control disabled',await page.$eval('[name=copySavedSearchValue]',e=>e.disabled));await search();check('new result cannot overlap still pending copy',await page.$eval('[name=copySavedSearchValue]',e=>e.disabled));await page.evaluate(()=>window.finishCopy());await page.waitForFunction(()=>!document.querySelector('[name=copySavedSearchValue]').disabled);check('late prior-search copy cannot restore success feedback',!await page.$('[name=savedSearchCopyNotice]'));
  await page.evaluate(()=>{window.copyWrites=0;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>{window.copyWrites++;return new Promise(r=>window.finishCopy=r);}}});});await page.click('[name=copySavedSearchValue]');await page.evaluate(()=>document.querySelector('[name=copySavedSearchValue]').click());check('duplicate pending copy performs one clipboard write',await page.evaluate(()=>window.copyWrites===1));await page.click('[name=clearSavedSearchFilters]');await page.evaluate(()=>window.finishCopy());await new Promise(r=>setTimeout(r,100));check('clear fences late notice and removes old copy controls',!await page.$('[name=savedSearchCopyNotice]')&&!await page.$('[name=copySavedSearchValue]'));
  check('copy flow never changes server data',writes.length===0);check('copy flow has no runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
