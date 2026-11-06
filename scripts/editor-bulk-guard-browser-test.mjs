// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55597, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-bulk-guard-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('bulk_guard_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/bulk_guard_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  await page.select('[aria-label="Filter by review status"]','UNVERIFIED');await page.waitForFunction(()=>!document.querySelector('[name=keysLoading]'));
  let held,holdWrite=false,bulkCalls=0,writes=0,dialogs=0;page.on('dialog',async d=>{dialogs++;await d.accept();});await page.setRequestInterception(true);page.on('request',req=>{if(req.method()==='POST'&&new URL(req.url()).pathname.endsWith('/bulk-status')){bulkCalls++;if(held===true || (holdWrite&&!JSON.parse(req.postData()??'{}').dryRun)){held=req;holdWrite=false;return;}}if(req.method()==='PUT'&&new URL(req.url()).pathname.endsWith('/translations'))writes++;req.continue();});
  const edit=async text=>{await page.click('[aria-label="alpha in en"]');await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type(text);};
  await edit('Local draft');await page.waitForFunction(()=>document.querySelector('[name=bulkMark]')?.disabled);
  check('local unsaved text disables bulk review with guidance and zero preview calls',!!await page.$('[name=bulkReviewBlocked]')&&bulkCalls===0&&dialogs===0&&writes===0);await page.screenshot({path:'/downloads/editor-bulk-draft-blocked.png',fullPage:false});
  // Synthetic click cannot bypass Angular handler guard; keep input focused to avoid blur-save.
  await page.$eval('[name=bulkMark]',e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));await new Promise(r=>setTimeout(r,100));check('handler blocks bulk preview even if disabled button event dispatched',bulkCalls===0&&dialogs===0);
  await page.click('[name=saveCellDraft]');await page.waitForFunction(()=>!document.querySelector('[name=saveCellDraft]'));await page.waitForFunction(()=>!document.querySelector('[name=bulkMark]')?.disabled);
  held=true;await page.click('[name=bulkMark]');for(let n=0;n<100&&held===true;n++)await new Promise(r=>setTimeout(r,20));if(!held?.continue)throw new Error('bulk preview not held');await edit('Typed during preview');await page.waitForFunction(()=>!!document.querySelector('[name=bulkReviewBlocked]'));const preview=held;held=false;await preview.continue();await page.waitForFunction(()=>document.querySelector('[name=bulkMark]')?.textContent==='Mark all');
  check('new draft during preview cancels confirm and status write',bulkCalls===1&&dialogs===0&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Typed during preview'));await page.screenshot({path:'/downloads/editor-bulk-preview-cancelled.png',fullPage:false});
  await page.click('[name=saveCellDraft]');await page.waitForFunction(()=>!document.querySelector('[name=saveCellDraft]'));await page.waitForFunction(()=>!document.querySelector('[name=bulkMark]')?.disabled);await page.click('[name=bulkMark]');await page.waitForFunction(()=>document.querySelector('.notice')?.textContent?.includes('Marked 1'));await page.waitForFunction(()=>!document.querySelector('[name=keysLoading]'));const row=(await call(`${P}/keys`,null,token))[0].translations.find(t=>t.localeCode==='en');check('clean explicit bulk review confirms and persists status without losing saved wording',dialogs===1&&bulkCalls===3&&row.value==='Typed during preview'&&row.status==='REVIEWED');await page.screenshot({path:'/downloads/editor-bulk-reviewed.png',fullPage:false});
  await page.select('[aria-label="Filter by review status"]','REVIEWED');await page.waitForFunction(()=>!document.querySelector('[name=keysLoading]'));await page.select('[aria-label="Bulk set status"]','TRANSLATED');holdWrite=true;await page.click('[name=bulkMark]');for(let n=0;n<100&&!held?.continue;n++)await new Promise(r=>setTimeout(r,20));if(!held?.continue)throw new Error('bulk write not held');await edit('Typed during bulk write');await page.waitForFunction(()=>document.querySelector('[name=saveCellDraft]')?.disabled);const writesAtHold=writes;await page.click('[name=newKey]');check('pending bulk write blocks blur content write and explicit draft save',writes===writesAtHold&&await page.$eval('[name=saveCellDraft]',e=>e.disabled));const write=held;held=false;await write.continue();await page.waitForFunction(()=>document.querySelector('.notice')?.textContent?.includes('Local values were kept'));const after=(await call(`${P}/keys`,null,token))[0].translations.find(t=>t.localeCode==='en');check('completed bulk write retains new local draft without list reload and requires reload',after.status==='TRANSLATED'&&after.value==='Typed during preview'&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Typed during bulk write')&&!!await page.$('[name=reloadAfterSave]'));await page.screenshot({path:'/downloads/editor-bulk-retained.png',fullPage:false});
  check('no bulk guard runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
