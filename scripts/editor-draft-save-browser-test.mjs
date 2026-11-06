// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55594, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-draft-save-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('draft_save_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/draft_save_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);const key=(await call(`${P}/keys`,null,token))[0];
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  let held,contentWrites=0,statusWrites=0;await page.setRequestInterception(true);page.on('request',req=>{if(req.method()==='PATCH'&&new URL(req.url()).pathname.endsWith('/status')){statusWrites++;held=req;return;}if(req.method()==='PUT'&&new URL(req.url()).pathname.endsWith('/translations'))contentWrites++;req.continue();});
  await page.select('[aria-label="Review status for alpha in en"]','REVIEWED');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('status request not held');await page.waitForSelector('[name=reviewPending]');
  await page.click('[aria-label="alpha in en"]');await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type('Typed during review');await page.click('[name=newKey]');await page.waitForSelector('[name=saveCellDraft]');check('pending review labels newer local draft and disables explicit save',await page.$eval('[name=saveCellDraft]',e=>e.disabled)&&!!await page.$('[name=localDraft]')&&contentWrites===0&&statusWrites===1);await page.screenshot({path:'/downloads/editor-draft-pending.png',fullPage:false});
  await held.continue();await page.waitForFunction(()=>!document.querySelector('[name=reviewPending]')&&!document.querySelector('[name=saveCellDraft]')?.disabled);const row=async()=>(await call(`${P}/keys`,null,token))[0].translations.find(t=>t.localeCode==='en');check('status completion never auto-saves newer draft',contentWrites===0&&(await row()).value==='Original'&&(await row()).status==='REVIEWED');await page.screenshot({path:'/downloads/editor-draft-ready.png',fullPage:false});
  await page.click('[name=saveCellDraft]');await page.waitForFunction(()=>!document.querySelector('[name=saveCellDraft]'));for(let n=0;n<100&&(await row()).value!=='Typed during review';n++)await new Promise(r=>setTimeout(r,20));check('explicit save persists exactly one conditional content write and clears dirty guidance',contentWrites===1&&(await row()).value==='Typed during review'&&(await row()).status==='UNVERIFIED'&&!(await page.$('[name=localDraft]')));await page.screenshot({path:'/downloads/editor-draft-saved.png',fullPage:false});check('no draft-save runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
