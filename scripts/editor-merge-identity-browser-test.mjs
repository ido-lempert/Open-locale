// Real local browser -> scoped branch merge -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56138, WEB_PORT = 4200, API_PORT = 3000;
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
  let previews=0,merges=0,keyReads=0,mergeBody,mergePath;
  page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.endsWith('/merge/preview'))previews++;if(req.method()==='POST'&&path.endsWith('/merge')){merges++;mergeBody=JSON.parse(req.postData());mergePath=path;}if(req.method()==='GET'&&path===`/api${P}/keys`)keyReads++;});
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.newBranch.set('Unsent branch');const k=c.keys()[0],v=c.cell(k.id,'en');v.update(x=>({...x,value:'Local source draft'}));});
  await page.click('[name=previewMerge]');await page.waitForSelector('[name=confirmMerge]');const first=await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).mergePreview());
  check('existing merge preview exposes exact request identity and raw timestamp',await page.$eval('[name=mergeReviewProjectId]',e=>e.textContent)===project.id&&await page.$eval('[name=mergeReviewBranchId]',e=>e.textContent)===feature.id&&await page.$eval('[name=mergeReviewSource]',e=>e.textContent)==='feature'&&await page.$eval('[name=mergeReviewTarget]',e=>e.textContent)==='main'&&await page.$eval('[name=mergeReviewTimestamp]',e=>e.textContent)===first.previewAt);
  check('identity review scope excludes current permission complete scan and execution claim',await page.$eval('[name=mergePreviewIdentity]',e=>e.textContent.includes('not a fresh permission check, a complete conflict scan or confirmation that a merge has run'))&&merges===0&&previews===1);
  await page.screenshot({path:'/downloads/editor-merge-identity-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[aria-label="Merge preview"]',e=>e.scrollTop=0);await page.screenshot({path:'/downloads/editor-merge-identity-mobile-top.png'});await page.$eval('[aria-label="Merge preview"]',e=>e.scrollTop=e.scrollHeight);await page.screenshot({path:'/downloads/editor-merge-identity-mobile-bottom.png'});
  check('390px modal scrolls with confirmation and cancel reachable',await page.evaluate(()=>{const e=document.querySelector('[aria-label="Merge preview"]'),r=e.getBoundingClientRect(),b=document.querySelector('[name=cancelMerge]').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth&&b.top>=r.top&&b.bottom<=r.bottom;}));
  await page.click('[name=cancelMerge]');check('cancel does not merge or reload keys and retains local drafts',merges===0&&keyReads===0&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.newBranch()==='Unsent branch'&&c.cell(c.keys()[0].id,'en')().value==='Local source draft';}));
  await page.setViewport({width:1280,height:900});await page.click('[name=previewMerge]');await page.waitForSelector('[name=confirmMerge]');
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));window.actualMergePreview=c.mergePreview();c.mergePreview.set({...window.actualMergePreview,branchId:'<img onerror=fail>-'+'X'.repeat(300),from:'feature'+ 'Y'.repeat(180),previewAt:'raw-<img onerror=fail>-'+'Z'.repeat(200)});});
  await page.setViewport({width:390,height:844});await page.$eval('[aria-label="Merge preview"]',e=>e.scrollTop=0);await page.screenshot({path:'/downloads/editor-merge-identity-long-mobile.png'});
  check('long loaded merge metadata stays escaped within scrollable modal',await page.$eval('[name=mergePreviewIdentity]',e=>!e.querySelector('img')&&e.textContent.includes('<img onerror=fail>-'))&&await page.$eval('[aria-label="Merge preview"]',e=>e.scrollWidth<=e.clientWidth));
  await page.$eval('[aria-label="Merge preview"]',e=>e.scrollTop=e.scrollHeight);await page.click('[name=cancelMerge]');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));await c.confirmMerge();});check('canceled long fixture cannot execute captured confirmation',merges===0);
  await page.setViewport({width:1280,height:900});await page.click('[name=previewMerge]');await page.waitForSelector('[name=confirmMerge]');const selected=await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).mergePreview());await page.click('[name=confirmMerge]');await page.waitForFunction(()=>!document.querySelector('[aria-label="Merge preview"]'));await page.waitForSelector('.notice');
  const main=(await call(`${P}/keys?branch=main`,null,token))[0],source=(await call(`${P}/keys?branch=feature`,null,token))[0];
  check('real explicit merge sends exact displayed source ID target and preview timestamp once',merges===1&&mergePath===`/api${P}/branches/${feature.id}/merge`&&mergeBody.into==='main'&&mergeBody.previewedAt===selected.previewAt);
  check('main receives saved source while local draft and source server value remain independent',keyReads===0&&main.translations.find(t=>t.localeCode==='en').value==='Feature saved'&&source.translations.find(t=>t.localeCode==='en').value==='Feature saved'&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Local source draft'));
  await page.screenshot({path:'/downloads/editor-merge-identity-result.png'});check('no branch merge runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
