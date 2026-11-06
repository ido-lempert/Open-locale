// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55636, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tm-apply-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('tm_apply_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/tm_apply_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Source',beta:'Source'}},token);const keys=await call(`${P}/keys`,null,token),a=keys.find(k=>k.name==='alpha'),b=keys.find(k=>k.name==='beta');await call(`${P}/keys/${a.id}/translations`,{locale:'he',value:'Stored memory'},token,'PUT');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="beta in he"]');
  let held,puts=0,imports=0;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='POST'&&path.includes(`/api${P}/import/`)){imports++;held=req;return;}if(req.method()==='PUT'&&path.endsWith('/translations'))puts++;req.continue();});
  await page.evaluate(()=>{const input=document.querySelector('[name=importFile]'),d=new DataTransfer();d.items.add(new File(['{"alpha":"Source","beta":"Source"}'],'saved.json',{type:'application/json'}));input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));});for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('import not held');await page.waitForSelector('[name=importPending]');await page.focus('[aria-label="beta in he"]');await page.waitForSelector('.tm-pick');await page.waitForFunction(()=>document.querySelector('.tm-pick')?.disabled);await page.$eval('.tm-pick',e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));const unchanged=(await call(`${P}/keys`,null,token)).find(k=>k.id===b.id);check('pending import disables memory apply before local target mutation and sends no PUT',puts===0&&imports===1&&await page.$eval('[aria-label="beta in he"]',e=>e.value==='')&&await page.$eval('.tm-pick',e=>e.disabled)&&!!await page.$('[name=tmApplyBlocked]')&&!unchanged.translations.some(t=>t.localeCode==='he'&&t.value));await page.screenshot({path:'/downloads/editor-tm-apply-blocked.png',fullPage:false});await held.continue();await page.waitForFunction(()=>!document.querySelector('[name=importPending]')&&!document.querySelector('[name=keysLoading]'));await page.focus('[aria-label="beta in en"]');await page.focus('[aria-label="beta in he"]');await page.waitForFunction(()=>!!document.querySelector('.tm-pick')&&!document.querySelector('.tm-pick')?.disabled);await page.focus('.tm-pick');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[aria-label="beta in he"]')?.value==='Stored memory'&&!document.querySelector('.tm-pick'));for(let n=0;n<100;n++){const k=(await call(`${P}/keys`,null,token)).find(k=>k.id===b.id);if(k.translations.find(t=>t.localeCode==='he')?.value==='Stored memory')break;await new Promise(r=>setTimeout(r,20));}const saved=(await call(`${P}/keys`,null,token)).find(k=>k.id===b.id).translations.find(t=>t.localeCode==='he');check('after explicit ready selection keyboard apply persists once unverified',puts===1&&saved?.value==='Stored memory'&&saved?.status==='UNVERIFIED');await page.screenshot({path:'/downloads/editor-tm-apply-saved.png',fullPage:false});
  check('no TM apply runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
