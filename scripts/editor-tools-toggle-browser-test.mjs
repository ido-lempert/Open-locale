// Real local browser -> failed save recovery -> local retained-grid download.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55889, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
const downloadDir=mkdtempSync(join(tmpdir(),'retained-download-'));
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-export-scope-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('export_scope_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/export_scope_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Saved alpha',beta:'Saved beta'}},token);const keys=await call(`${P}/keys`,null,token),a=keys.find(k=>k.name==='alpha');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  const requests=[];await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/'))requests.push({method:req.method(),path});req.continue();});
  check('tools start expanded with visible creation controls',await page.$eval('[name=toggleEditorTools]',e=>e.getAttribute('aria-expanded')==='true')&&await page.$eval('[name=newKey]',e=>e.getBoundingClientRect().width>0));
  await page.type('[name=newKey]','retained.new.key');await page.type('[name=newLocale]','fr');
  const input=await page.$('[aria-label="beta in en"]');await input.focus();await input.type(' LOCAL_DRAFT');const local=await input.evaluate(e=>e.value);requests.length=0;
  await page.click('[name=toggleEditorTools]');await page.waitForSelector('[name=editorToolsCollapsed]');await new Promise(r=>setTimeout(r,150));
  check('focused pointer hide causes no translation blur save or API request',requests.length===0&&await input.evaluate((e,v)=>e.value===v,local));
  check('tools are actually hidden but DOM drafts and outside grid/backup remain',await page.$eval('#editorTools',e=>getComputedStyle(e).display==='none')&&await page.$eval('[name=newKey]',e=>e.value==='retained.new.key')&&await page.$eval('[name=newLocale]',e=>e.value==='fr')&&await page.$('[name=localGridBackupToggle]')&&await page.$('[aria-label="beta in en"]'));
  check('collapsed guidance explains hidden feedback and independent pending work',await page.$eval('[name=editorToolsCollapsed]',e=>e.textContent.includes('action feedback are hidden')&&e.textContent.includes('Pending work can still finish')&&e.textContent.includes('does not save, cancel or discard')));
  await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/editor-tools-collapsed-mobile.png'});
  check('390px collapsed grid is near viewport and no document overflow',await page.$eval('.grid',e=>e.getBoundingClientRect().top<innerHeight)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.$eval('[name=toggleEditorTools]',e=>e.focus());await page.waitForNetworkIdle({idleTime:250});requests.length=0;await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[name=toggleEditorTools]').getAttribute('aria-expanded')==='true');
  check('keyboard show restores same tool drafts and no request',requests.length===0&&await page.$eval('[name=newKey]',e=>e.value==='retained.new.key'&&e.getBoundingClientRect().width>0)&&await page.$eval('[name=newLocale]',e=>e.value==='fr'));
  await input.focus();requests.length=0;await page.click('[name=toggleEditorTools]');await page.waitForSelector('[name=editorToolsCollapsed]');await new Promise(r=>setTimeout(r,100));
  check('actual 390px pointer hide keeps translation and causes no request',requests.length===0&&await input.evaluate((e,v)=>e.value===v,local)&&await page.$eval('[name=toggleEditorTools]',e=>e.getAttribute('aria-expanded')==='false'));
  await page.click('[name=toggleEditorTools]');await page.waitForFunction(()=>document.querySelector('[name=toggleEditorTools]').getAttribute('aria-expanded')==='true');
  // A real pending saved-server export may complete while tools are hidden.
  let release;const gate=new Promise(r=>release=r);let sawExport;const started=new Promise(r=>sawExport=r);await page.setRequestInterception(false);page.removeAllListeners('request');await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path.includes('/export/')){sawExport();await gate;}req.continue();});
  await page.$eval('[name=exportFile]',e=>e.click());await started;await page.waitForSelector('[name=exportPending]');await page.$eval('[name=toggleEditorTools]',e=>e.click());
  check('can hide actual pending export without cancel or clearing pending state',await page.$eval('#editorTools',e=>getComputedStyle(e).display==='none')&&await page.$('[name=exportPending]'));
  release();await page.waitForFunction(()=>!document.querySelector('[name=exportPending]'));await page.$eval('[name=toggleEditorTools]',e=>{e.focus();});await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[name=toggleEditorTools]').getAttribute('aria-expanded')==='true');
  check('completed export feedback is visible again after reopening',await page.$eval('[name=exportNotice]',e=>e.textContent.length>0)&&await input.evaluate((e,v)=>e.value===v,local));
  await page.$eval('[name=toggleEditorTools]',e=>e.click());await page.setViewport({width:1280,height:900});await page.$eval('[name=toggleEditorTools]',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:'/downloads/editor-tools-collapsed-desktop.png'});
  check('no tool visibility runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??String(e)}`);process.exitCode=1;}
finally {
  await browser?.close();rmSync(downloadDir,{recursive:true,force:true});
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
