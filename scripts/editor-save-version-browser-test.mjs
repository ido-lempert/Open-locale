// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55590, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-save-version-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('save_version_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/save_version_browser`;
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
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');const second=await browser.newPage();await second.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await second.waitForSelector('[aria-label="alpha in en"]');
  const edit=async(p,value)=>{await p.bringToFront();await p.click('[aria-label="alpha in en"]');await p.keyboard.down('Control');await p.keyboard.press('KeyA');await p.keyboard.up('Control');await p.keyboard.type(value);await p.click('[name=newKey]');};
  const row=async()=> (await call(`${P}/keys`,null,token))[0].translations.find(t=>t.localeCode==='en');let writes=0;const sent=[];second.on('request',r=>{if(r.method()==='PUT'&&new URL(r.url()).pathname.endsWith('/translations')){writes++;sent.push(JSON.parse(r.postData()));}});
  await edit(page,'First editor');for(let n=0;n<100&&(await row()).value!=='First editor';n++)await new Promise(r=>setTimeout(r,20));const first=await row();check('first editor commits newer version',first.value==='First editor'&&first.version===2);
  await edit(second,'Second stale draft');await second.waitForSelector('[name=reloadAfterSave]');check('stale second editor cannot overwrite newer content',(await row()).value==='First editor'&&await second.$eval('[aria-label="alpha in en"]',e=>e.value==='Second stale draft')&&sent[0].expectedVersion===1&&sent[0].expectedRowId===first.rowId);
  await second.focus('[aria-label="alpha in en"]');await second.focus('[name=newKey]');await new Promise(r=>setTimeout(r,150));check('failed save never auto-replays or force-retries on blur',writes===1);await second.click('[name=reloadAfterSave]');await second.waitForSelector('[name=retainedKeyDrafts]');await second.click('details summary');check('local failed-save draft is selectable before explicit reload',await second.$eval('[name=retainedKeyDrafts]',e=>e.value.includes('Second stale draft')&&!e.closest('[inert]')));await second.screenshot({path:'/downloads/editor-save-conflict.png',fullPage:false});await second.click('[name=retryKeys]');await second.waitForFunction(()=>!document.querySelector('[name=keysLoading]'));await second.waitForFunction(()=>document.querySelector('[aria-label="alpha in en"]')?.value==='First editor');check('explicit reload loads newer persisted value',await second.$eval('[aria-label="alpha in en"]',e=>e.value==='First editor'));
  // Recreate same-version row behind the second editor to prove row identity matters.
  const baseline=await row();await prisma.translation.delete({where:{keyId_localeCode:{keyId:key.id,localeCode:'en'}}});for(let i=0;i<baseline.version;i++)await call(`${P}/keys/${key.id}/translations`,{locale:'en',value:'Replacement'},token,'PUT');const replacement=await row();check('fixture recreates same version with different immutable identity',replacement.version===baseline.version&&replacement.rowId!==baseline.rowId);
  await edit(second,'ABA stale draft');await second.waitForSelector('[name=reloadAfterSave]');check('same-version replacement rejects stale row identity',(await row()).value==='Replacement'&&sent.at(-1).expectedVersion===replacement.version&&sent.at(-1).expectedRowId===baseline.rowId);
  await second.click('[name=reloadAfterSave]');await second.waitForSelector('[name=retryKeys]');await second.click('[name=retryKeys]');await second.waitForFunction(()=>!document.querySelector('[name=keysLoading]'));await second.waitForFunction(()=>document.querySelector('[aria-label="alpha in en"]')?.value==='Replacement');await edit(second,'Fresh after reload');for(let n=0;n<100&&(await row()).value!=='Fresh after reload';n++)await new Promise(r=>setTimeout(r,20));check('fresh identity after explicit reload permits normal save',(await row()).value==='Fresh after reload'&&sent.at(-1).expectedRowId===replacement.rowId);await second.screenshot({path:'/downloads/editor-save-reloaded.png',fullPage:false});
  const before=(await call(`${P}/keys`,null,token))[0].translations.find(t=>t.localeCode==='he');check('fixture target locale absent',!before);await second.click('[aria-label="alpha in he"]');await second.type('[aria-label="alpha in he"]','Created target');await second.click('[name=newKey]');for(let n=0;n<100;n++){if((await call(`${P}/keys`,null,token))[0].translations.some(t=>t.localeCode==='he'))break;await new Promise(r=>setTimeout(r,20));}check('absent target uses create-only version zero and persists',sent.at(-1).expectedVersion===0&&(await call(`${P}/keys`,null,token))[0].translations.some(t=>t.localeCode==='he'&&t.value==='Created target'));
  check('no conditional save runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
