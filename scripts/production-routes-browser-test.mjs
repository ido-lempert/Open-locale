// Real local browser -> Production lazy routes -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55546, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-production-routes-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('production_routes_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/production_routes_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn(process.execPath,['scripts/production-web-server.mjs'],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const chunks=[];
  const diagnostics=[];const page=await browser.newPage();page.on('request',r=>{if(/chunk-.*\.js/.test(r.url()))chunks.push(r.url());});page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  check('production login initially loads no secondary chunks',chunks.length===0);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.grid');check('production editor eager entry keeps secondary chunks unloaded',chunks.length===0);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=automationActivityLink]');check('production settings fetched lazy chunk',chunks.length===1);
  await page.click('[name=automationActivityLink]');await page.waitForSelector('[name=refreshActivity]');check('production settings click loads activity chunk',chunks.length===2);
  const screens=[['tasks','.task-form'],['glossary','.task-form'],['qa','h1'],['snapshots','[name=refreshSnapshots]'],['reports','[name=usageDays]'],['sync','textarea[name=syncBaseline]'],['sync/targets','[name=targetSave]'],['sync/history','h1']];
  for(const [path,selector]of screens){const before=chunks.length;await page.goto(`${WEB}${P}/${path}`,{waitUntil:'networkidle0'});await page.waitForSelector(selector);check(`production deep link loads lazy ${path}`,chunks.length===before+1&&!diagnostics.some(d=>/ChunkLoadError|Failed to fetch dynamically imported module|TypeError/.test(d)));}
  await page.goto(`${WEB}/account/identities`,{waitUntil:'networkidle0'});await page.waitForSelector('h1');check('production account identities loads lazy component',chunks.length===11);
  await page.setViewport({width:390,height:844});await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=automationActivityLink]');check('production revisited settings mobile fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/downloads/production-lazy-settings.png',fullPage:false});
  await page.evaluate(()=>localStorage.removeItem('ol_token'));await page.goto(`${WEB}${P}/reports`,{waitUntil:'networkidle0'});await page.waitForSelector('.tabs');check('production guarded deep link redirects signed-out user to login',new URL(page.url()).pathname==='/login');
  const failurePage=await browser.newPage();await failurePage.setViewport({width:390,height:844});await failurePage.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await failurePage.evaluate(t=>localStorage.setItem('ol_token',t),token);await failurePage.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await failurePage.waitForSelector('[name=automationActivityLink]');await failurePage.type('input[name=name]',' UNSAVED');
  const draft=await failurePage.$eval('input[name=name]',e=>e.value);let releaseChunk,heldChunk=false,chunkRequests=0;const chunkGate=new Promise(r=>releaseChunk=r);await failurePage.setRequestInterception(true);const failChunk=async req=>{if(/chunk-.*\.js/.test(req.url())){heldChunk=true;chunkRequests++;await chunkGate;return req.abort('failed');}return req.continue();};failurePage.on('request',failChunk);await failurePage.click('[name=automationActivityLink]');for(let n=0;n<100&&!heldChunk;n++)await new Promise(r=>setTimeout(r,20));if(!heldChunk)throw new Error('production chunk not held');await failurePage.waitForSelector('[name=navigationPending]');
  check('held actual production chunk announces opening without discarding current draft',chunkRequests===1&&await failurePage.$eval('input[name=name]',(e,d)=>e.value===d,draft));check('pending navigation feedback is visible at current scroll',await failurePage.$eval('[name=navigationPending]',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.width<=innerWidth;}));await failurePage.screenshot({path:'/downloads/production-navigation-pending.png',fullPage:false});releaseChunk();await failurePage.waitForSelector('[name=navigationFailed]');
  check('blocked production chunk shows fixed recovery guidance and retains unsaved draft',await failurePage.$eval('[name=navigationFailed]',e=>e.textContent.includes('Keep any unsaved work')&&!e.textContent.includes('chunk-'))&&await failurePage.$eval('input[name=name]',(e,d)=>e.value===d,draft)&&!(await failurePage.$('[name=navigationPending]')));check('failed navigation guidance is visible at current scroll',await failurePage.$eval('[name=navigationFailed]',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.width<=innerWidth;}));await failurePage.screenshot({path:'/downloads/production-navigation-failed.png',fullPage:false});
  check('chunk failure never automatically reloads document',new URL(failurePage.url()).pathname===`${P}/settings`&&await failurePage.$eval('input[name=name]',(e,d)=>e.value===d,draft));failurePage.off('request',failChunk);await failurePage.setRequestInterception(false);await failurePage.click('.back');await failurePage.waitForSelector('.grid');check('next ordinary navigation clears failure feedback',!(await failurePage.$('[name=navigationFailed]'))&&!(await failurePage.$('[name=navigationPending]')));await failurePage.close();
  check('production routes have no runtime or chunk errors',!diagnostics.some(d=>/ChunkLoadError|Failed to fetch dynamically imported module|TypeError|NG0955/.test(d)));
  console.log(failures?'PRODUCTION ROUTE CHECKS FAILED':'ALL PRODUCTION ROUTE CHECKS PASSED');process.exitCode=failures?1:0;
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
