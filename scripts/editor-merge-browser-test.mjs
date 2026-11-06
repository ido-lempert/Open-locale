// Real local browser -> scoped branch merge -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55614, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-merge-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('merge_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/merge_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Main original'}},token);const feature=await call(`${P}/branches`,{name:'feature'},token);await call(`${P}/import/en?branch=feature`,{entries:{alpha:'Feature saved'}},token);await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=branch]');await page.select('[name=branch]','feature');await page.waitForFunction(()=>document.querySelector('[aria-label="alpha in en"]')?.value==='Feature saved');
  let heldTranslation,heldPreview,heldMerge,previews=0,merges=0,keyReads=0;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='PUT'&&path.endsWith('/translations')){heldTranslation=req;return;}if(path.endsWith('/merge/preview')){previews++;heldPreview=req;return;}if(req.method()==='POST'&&path.endsWith('/merge')){merges++;heldMerge=req;return;}if(req.method()==='GET'&&path===`/api${P}/keys`)keyReads++;req.continue();});
  await page.click('[name=previewMerge]');for(let n=0;n<100&&!heldPreview;n++)await new Promise(r=>setTimeout(r,20));if(!heldPreview)throw new Error('preview not held');await page.$eval('[name=previewMerge]',e=>e.click());await page.select('[name=branch]','main');await page.waitForFunction(()=>document.querySelector('[aria-label="alpha in en"]')?.value==='Main original');await heldPreview.continue();await new Promise(r=>setTimeout(r,250));check('old preview after branch switch stays closed and duplicate preview is guarded',previews===1&&!(await page.$('[aria-label="Merge preview"]')));
  await page.select('[name=branch]','feature');await page.waitForFunction(()=>document.querySelector('[aria-label="alpha in en"]')?.value==='Feature saved');await page.click('[aria-label="alpha in en"]');await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type('Local source draft');await page.click('[name=previewMerge]');for(let n=0;n<100&&previews<2;n++)await new Promise(r=>setTimeout(r,20));await heldPreview.continue();await page.waitForSelector('[name=confirmMerge]');check('merge preview explicitly excludes unsaved drafts',await page.$eval('[aria-label="Merge preview"]',e=>e.innerText.includes('Only saved server values are merged; local unsaved drafts are not included.')));await page.click('[name=confirmMerge]');for(let n=0;n<100&&!heldMerge;n++)await new Promise(r=>setTimeout(r,20));if(!heldMerge||!heldTranslation)throw new Error('merge/translation not held');await page.waitForFunction(()=>document.querySelector('[name=confirmMerge]')?.disabled&&document.querySelector('[name=cancelMerge]')?.disabled);await page.$eval('[name=confirmMerge]',e=>e.click());check('pending merge guards duplicate confirmation and cancel',merges===1&&await page.$eval('[name=confirmMerge]',e=>e.disabled)&&await page.$eval('[name=cancelMerge]',e=>e.disabled));await page.screenshot({path:'/downloads/editor-merge-pending.png',fullPage:false});const reads=keyReads;await heldMerge.continue();await page.waitForFunction(()=>!document.querySelector('[aria-label="Merge preview"]'));await page.waitForSelector('.notice');const main=(await call(`${P}/keys?branch=main`,null,token))[0],source=(await call(`${P}/keys?branch=feature`,null,token))[0];check('confirmed merge keeps source local draft/no grid GET while main receives saved server value',keyReads===reads&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Local source draft')&&main.translations.find(t=>t.localeCode==='en').value==='Feature saved'&&source.translations.find(t=>t.localeCode==='en').value==='Feature saved'&&await page.$eval('.notice',e=>e.textContent.includes('Copy local drafts before opening main')));await page.screenshot({path:'/downloads/editor-merge-retained.png',fullPage:false});await heldTranslation.respond({status:503,contentType:'application/json',body:'{}'});await page.waitForSelector('[name=reloadAfterSave]');check('no branch merge runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
