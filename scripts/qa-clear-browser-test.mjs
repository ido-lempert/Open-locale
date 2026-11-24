// Real local browser -> QA local search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.QA_CLEAR_TEST_PG_PORT ?? 56338), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;const downloadDir=mkdtempSync(join(tmpdir(),'ol-qa-download-'));
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


  await call(`${P}/import/en`,{entries:{'checkout.[A]':'Base title',other:'Other base'}},token);
  await page.goto(`${WEB}${P}/qa`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=qaCount]');let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}req.continue();});
  check('clear all initially disabled',await page.$eval('[name=clearAllQaFilters]',e=>e.disabled));
  await page.type('[name=qaSearch]','missing');await page.select('[name=qaType]','max_length');await page.waitForSelector('[name=qaEmpty]');await page.evaluate(()=>{window.qaBefore=ng.getComponent(document.querySelector('ol-qa')).issues();ng.getComponent(document.querySelector('ol-qa')).downloadNotice.set('Earlier download requested');});
  await page.$eval('[name=clearAllQaFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/qa-clear-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=clearAllQaFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/qa-clear-mobile.png'});check('390px clear controls and scope fit filtered-empty view',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.focus('[name=clearAllQaFilters]');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[name=qaTypeCount]')?.textContent.includes('2 of 2'));check('keyboard clear restores exact full loaded findings without requests',reads===0&&writes===0&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-qa'));return c.issues()===window.qaBefore&&c.query()===''&&c.issueType()===''&&c.branch()==='main'&&c.locale()==='';}));check('feedback retained and combined clear disabled',await page.$eval('[name=qaDownloadNotice]',e=>e.textContent==='Earlier download requested')&&await page.$eval('[name=clearAllQaFilters]',e=>e.disabled));
  await page.type('[name=qaSearch]','  ');await page.waitForFunction(()=>document.querySelector('[name=clearAllQaFilters]')?.disabled===false);await page.$eval('[name=clearAllQaFilters]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=qaSearch]')?.value==='');check('whitespace-only search clears without reread',reads===0&&writes===0);
  await page.select('[name=qaType]','untranslated');await page.waitForFunction(()=>document.querySelector('[name=clearAllQaFilters]')?.disabled===false);await page.$eval('[name=clearAllQaFilters]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=qaType]')?.value==='');check('type-only clear is local and guidance names retained scope',reads===0&&writes===0&&await page.$eval('[name=clearAllQaFiltersScope]',e=>e.textContent.includes('Branch, locale and loaded findings stay')));
  await page.evaluate(()=>{window.lastQa=ng.getComponent(document.querySelector('ol-qa'));window.lastQa.setQuery('Retain');window.lastQa.setIssueType('whitespace');history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-qa'));await page.evaluate(()=>window.lastQa.clearFilters());check('departed clear handler cannot change filters',await page.evaluate(()=>window.lastQa.query()==='Retain'&&window.lastQa.issueType()==='whitespace'));
  check('no QA clear runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

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
