// Real local browser -> focused read-only export -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55788, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Saved server'}},token);await call(`${P}/branches`,{name:'existing'},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  let mode='fail',held=[];const requests=[];await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/'))requests.push({method:req.method(),path});if(req.method()==='GET'&&path===`/api${P}/branches`){if(mode==='fail')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_BRANCH_ERROR'})});if(mode==='hold'){held.push(req);return;}}req.continue();});
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).loadBranches());await page.waitForSelector('[name=retryEditorBranches]');requests.length=0;
  const input=await page.$('[aria-label="alpha in en"]');await input.focus();await input.type(' LOCAL_ONLY_DRAFT');const local=await input.evaluate(e=>e.value);
  await page.click('[name=retryEditorBranches]');await page.waitForSelector('[name=retryEditorBranches]');await new Promise(r=>setTimeout(r,150));
  check('failed focused branch retry reads only branch list without autosave or focus loss',requests.length===1&&requests[0].method==='GET'&&requests[0].path===`/api${P}/branches`&&await input.evaluate((e,v)=>e.value===v&&document.activeElement===e,local)&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  await page.screenshot({path:'/downloads/editor-branches-retry-focus-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=retryEditorBranches]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-branches-retry-focus-mobile.png'});check('390px failed branch retry control fits',await page.$eval('[name=retryEditorBranches]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));await page.setViewport({width:1280,height:900});
  requests.length=0;mode='hold';await page.click('[name=retryEditorBranches]');for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==1)throw new Error('retry not held');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).retryBranches());
  check('pending branch retry refuses captured duplicate and retains local focus',requests.length===1&&held.length===1&&await input.evaluate((e,v)=>e.value===v&&document.activeElement===e,local));
  mode='live';await Promise.all(held.splice(0).map(r=>r.continue()));await page.waitForFunction(()=>!document.querySelector('[name=branchListError]'));check('successful branch-only retry finds stored branch without key reload, create or local save',requests.length===1&&await page.$eval('[name=branch]',e=>e.value==='main'&&[...e.options].some(o=>o.value==='existing'))&&await input.evaluate((e,v)=>e.value===v&&document.activeElement===e,local));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).retryBranches());check('captured healthy branch retry refuses read',requests.length===1);
  check('no focused branch retry runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
