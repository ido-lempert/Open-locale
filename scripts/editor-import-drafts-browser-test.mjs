// Real local browser -> import local drafts -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55618, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-import-drafts-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('import_drafts_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/import_drafts_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  let held,imports=0,reads=0,puts=0,failImport=false;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='POST'&&path.includes(`/api${P}/import/`)){imports++;if(failImport)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_IMPORT_ERROR'})});held=req;return;}if(req.method()==='PUT'&&path.endsWith('/translations'))puts++;if(req.method()==='GET'&&path===`/api${P}/keys`)reads++;req.continue();});
  const pick=async()=>page.evaluate(()=>{const input=document.querySelector('[name=importFile]'),data=new DataTransfer();data.items.add(new File(['{"alpha":"Imported"}'],'draft.json',{type:'application/json'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.$eval('[aria-label="alpha in en"]',e=>{e.value='Existing local draft';e.dispatchEvent(new Event('input',{bubbles:true}));});await pick();await page.waitForFunction(()=>document.querySelector('.error')?.textContent.includes('Import unavailable'));check('existing dirty draft blocks real import before request',imports===0&&puts===0&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Existing local draft'));await page.screenshot({path:'/downloads/editor-import-draft-blocked.png',fullPage:false});
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');await pick();for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('import not held');await page.waitForSelector('[name=importPending]');await page.click('[aria-label="alpha in en"]');await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type('Typed during import');await page.click('[name=newKey]');check('typing during import cannot blur-save across pending write',puts===0&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Typed during import'));const before=reads;await held.continue();await page.waitForSelector('[name=retryKeys]');const keys=await call(`${P}/keys`,null,token);check('confirmed import keeps newer local draft and offers retained copy before reload',reads===before&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Typed during import')&&keys[0].translations.find(t=>t.localeCode==='en').value==='Imported'&&await page.$eval('.notice',e=>e.textContent.includes('Import confirmed'))&&!!await page.$('[name=retainedKeyDrafts]'));await page.screenshot({path:'/downloads/editor-import-draft-retained.png',fullPage:false});
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');failImport=true;await pick();await page.waitForFunction(()=>document.querySelector('.error')?.textContent.includes('Import result could not be confirmed'));await pick();await page.waitForFunction(()=>document.querySelector('.error')?.textContent.includes('Import unavailable'));check('unknown import marks grid unconfirmed and blocks blind replay',imports===2&&!!await page.$('[name=retryKeys]')&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  check('no import draft runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??String(e)}`);process.exitCode=1;}
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
process.exit(failures?1:0);
