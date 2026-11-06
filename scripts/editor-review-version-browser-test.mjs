// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55593, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-review-version-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('review_version_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/review_version_browser`;
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
  await second.focus('[aria-label="alpha in en"]');await second.focus('[name=newKey]');await new Promise(r=>setTimeout(r,150));check('failed save never auto-replays or force-retries on blur',writes===1);await second.click('[name=reloadAfterSave]');await second.waitForSelector('[name=retainedKeyDrafts]');await second.click('details summary');check('local failed-save draft is selectable before explicit reload',await second.$eval('[name=retainedKeyDrafts]',e=>e.value.includes('Second stale draft')&&!e.closest('[inert]')));await second.screenshot({path:'/downloads/editor-save-conflict.png',fullPage:false});await second.click('[name=retryKeys]');await second.waitForFunction(()=>!document.querySelector('[name=keysLoading]'));check('explicit reload loads newer persisted value',await second.$eval('[aria-label="alpha in en"]',e=>e.value==='First editor'));
  // Second editor is now loaded at first editor's version, then unseen text changes.
  await edit(page,'Unseen wording');for(let n=0;n<100&&(await row()).value!=='Unseen wording';n++)await new Promise(r=>setTimeout(r,20));
  await second.bringToFront();second.setDefaultTimeout(10000);console.log('STEP reviewer foreground');
  const reviewSelector='select[aria-label="Review status for alpha in en"]';
  await second.select(reviewSelector,'REVIEWED');await second.waitForSelector('[name=reloadAfterSave]');check('stale reviewer cannot approve unseen newer wording',(await row()).value==='Unseen wording'&&(await row()).status==='UNVERIFIED');
  console.log('STEP review recovery');await second.click('[name=reloadAfterSave]');await second.waitForSelector('[name=retryKeys]');await second.click('[name=retryKeys]');await second.waitForFunction(()=>!document.querySelector('[name=keysLoading]'));console.log('STEP reloaded',await second.$eval('.grid',e=>e.textContent));await second.waitForFunction(()=>document.querySelector('[aria-label="alpha in en"]')?.value==='Unseen wording'&&!document.querySelector('select[aria-label="Review status for alpha in en"]')?.disabled);await second.select(reviewSelector,'REVIEWED');for(let n=0;n<100&&(await row()).status!=='REVIEWED';n++)await new Promise(r=>setTimeout(r,20));check('fresh explicit reviewer can approve loaded wording',(await row()).status==='REVIEWED');
  await second.screenshot({path:'/downloads/editor-review-confirmed.png',fullPage:false});
  const baseline=await row();await prisma.translation.delete({where:{keyId_localeCode:{keyId:key.id,localeCode:'en'}}});for(let i=0;i<baseline.version;i++)await call(`${P}/keys/${key.id}/translations`,{locale:'en',value:'Recreated'},token,'PUT');const replacement=await row();const beforeHistory=await prisma.translationHistory.count({where:{keyId:key.id}}),beforeActivity=await prisma.activityEvent.count({where:{projectId:project.id,action:'translation.status'}});
  const stale=await fetch(`${API}${P}/keys/${key.id}/translations/en/status`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({status:'REVIEWED',expectedVersion:replacement.version,expectedRowId:baseline.rowId})});check('status immutable identity rejects recreated same-version row',stale.status===409&&replacement.version===baseline.version&&replacement.rowId!==baseline.rowId&&(await row()).status==='UNVERIFIED');check('rejected status creates no audit/history side effects',await prisma.translationHistory.count({where:{keyId:key.id}})===beforeHistory&&await prisma.activityEvent.count({where:{projectId:project.id,action:'translation.status'}})===beforeActivity);
  const invalid=await fetch(`${API}${P}/keys/${key.id}/translations/en/status`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({status:'REVIEWED',expectedVersion:-1,expectedRowId:'invalid'})});check('status DTO rejects invalid concurrency fields',invalid.status===400);
  const legacy=await call(`${P}/keys/${key.id}/translations/en/status`,{status:'TRANSLATED'},token,'PATCH');check('legacy no-precondition status caller remains compatible',legacy.status==='TRANSLATED');const hist=await prisma.translationHistory.findFirst({where:{keyId:key.id,status:'TRANSLATED'},orderBy:{createdAt:'desc'}});check('status history uses actual transaction-locked current wording',hist?.value==='Recreated');
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
