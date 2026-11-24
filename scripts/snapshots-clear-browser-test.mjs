// Real local browser -> Snapshot kind filter -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SNAPSHOT_CLEAR_TEST_PG_PORT ?? 56326), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;const downloadDir=mkdtempSync(join(tmpdir(),'ol-snapshot-kind-'));
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-list-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_list_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_list_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  await call(`${P}/import/en`,{entries:{title:'Base'}},token);await call(`${P}/snapshots`,{label:'Release [A]'},token);await call(`${P}/snapshots`,{label:'Before migration'},token);const expected=await call(`${P}/snapshots`,undefined,token);if(expected.length!==3||expected.filter(s=>s.automatic).length!==1)throw new Error('Expected real import automatic snapshot and two manual snapshots');const emptyProject=await call('/projects',{name:'Empty',slug:'empty-kind',locales:['en','he']},token);
  await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.querySelectorAll('.snapshot-row').length===3);await page.type('[name=label]','Keep capture draft');
  let reads=0,writes=0,restores=0;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}if(req.method()==='POST'&&path.endsWith('/restore')){restores++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}req.continue();});let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.accept();});
  check('Clear all starts disabled without choices',await page.$eval('[name=clearAllSnapshotFilters]',e=>e.disabled));await page.select('[name=snapshotOrder]','oldest');await page.select('[name=snapshotKind]','automatic');await page.type('[name=snapshotSearch]','missing');await page.waitForSelector('[name=snapshotListEmpty]');check('combined no-match exposes explicit reset',!await page.$eval('[name=clearAllSnapshotFilters]',e=>e.disabled));
  await page.click('[name=clearAllSnapshotFilters]');await page.waitForFunction(()=>document.querySelectorAll('.snapshot-row').length===3);check('reset restores loaded inventory retaining time order and capture draft without effects',reads===0&&writes===0&&dialogs===0&&await page.$eval('[name=snapshotOrder]',e=>e.value==='oldest')&&await page.$eval('[name=label]',e=>e.value==='Keep capture draft')&&await page.$eval('[name=clearAllSnapshotFilters]',e=>e.disabled));
  await page.$eval('[name=clearAllSnapshotFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/snapshots-clear-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=clearAllSnapshotFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/snapshots-clear-mobile.png'});check('390px reset and local-only guidance fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=clearAllSnapshotFiltersScope]',e=>e.textContent.includes('capture label stay')));
  await page.$eval('[name=snapshotSearch]',e=>{e.value='   ';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>!document.querySelector('[name=clearAllSnapshotFilters]').disabled);check('whitespace-only search remains explicitly clearable',!await page.$eval('[name=clearAllSnapshotFilters]',e=>e.disabled));await page.click('[name=clearAllSnapshotFilters]');await page.waitForFunction(()=>document.querySelector('[name=snapshotSearch]').value==='');
  await page.select('[name=snapshotKind]','manual');await page.click('.restore');await page.waitForSelector('[name=snapshotRestoreUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=snapshotRestoring]'));await page.click('[name=clearAllSnapshotFilters]');await page.waitForFunction(()=>document.querySelectorAll('.snapshot-row').length===3);check('reset cannot clear unconfirmed restore pause or replay mutations',restores===1&&writes===1&&reads===0&&dialogs===1&&!!await page.$('[name=snapshotRestoreUnknown]')&&await page.$$eval('.restore',es=>es.every(e=>e.disabled))&&await page.$eval('.snapshot-create button',e=>e.disabled)&&await page.$eval('[name=label]',e=>e.value==='Keep capture draft'));
  await page.click('[name=refreshSnapshots]');await page.waitForFunction(()=>!document.querySelector('[name=snapshotRestoreUnknown]')&&!document.querySelector('[name=snapshotListLoading]'));check('only explicit successful read keeps existing recovery behavior',reads===1&&writes===1&&await page.$eval('[name=snapshotOrder]',e=>e.value==='oldest')&&await page.$$eval('.snapshot-row',es=>es.length===3&&es.every(e=>!e.querySelector('.restore').disabled)));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-snapshots'));c.listError.set(true);c.loaded.set(false);c.items.set([]);c.setSearch('x');c.setKind('manual');c.clearFilters();});await page.waitForSelector('[name=snapshotListError]');check('clear failed list cannot create loaded success or show stale rows',!await page.$('.snapshot-row')&&!await page.$('[name=snapshotListEmpty]')&&await page.$eval('[name=downloadSnapshots]',e=>e.disabled)&&reads===1&&writes===1);
  check('no snapshot clear-filter runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(!completed||failures?1:0);
