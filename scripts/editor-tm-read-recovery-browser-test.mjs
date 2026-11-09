// Real local browser -> Angular editor -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55781, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tm-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('tm_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/tm_refresh_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Source',beta:'Source'}},token);
  const keys=await call(`${P}/keys`,null,token),a=keys.find(k=>k.name==='alpha');
  await call(`${P}/keys/${a.id}/translations`,{locale:'he',value:'Stored memory'},token,'PUT');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="beta in he"]');
  let mode='error',held=[];const reads=[],writes=[];await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads.push(path);else writes.push(path);}if(path.endsWith('/tm/suggest')){if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_MEMORY_READ'})});if(mode==='hold'){held.push(req);return;}}req.continue();});
  await page.focus('[aria-label="beta in he"]');await page.waitForSelector('[name=tmError]');check('actual failed memory lookup shows fixed error and retry, no stale suggestions',reads.length===1&&writes.length===0&&!await page.$('.tm-pick')&&!await page.$('[name=tmEmpty]')&&!(await page.content()).includes('PRIVATE_MEMORY_READ'));
  mode='hold';await page.click('[name=retryTm]');for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==1)throw new Error('memory read not held');await page.waitForSelector('[name=tmLoading]');check('focused memory retry reads only memory and retains empty target focus without save',reads.length===2&&writes.length===0&&reads.every(p=>p.endsWith('/tm/suggest'))&&await page.$eval('[aria-label="beta in he"]',e=>e.value===''&&document.activeElement===e));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.recoverTm(c.keys().find(k=>k.name==='beta'),'he');});check('captured duplicate recovery refuses pending lookup',reads.length===2&&writes.length===0);
  mode='live';await Promise.all(held.splice(0).map(r=>r.continue()));await page.waitForSelector('.tm-pick');check('retry shows actual stored memory without applying or changing translations',reads.length===2&&writes.length===0&&await page.$eval('.tm-suggest',e=>e.textContent.includes('Stored memory'))&&await page.$eval('[aria-label="beta in he"]',e=>e.value==='')&&await page.$eval('[aria-label="beta in en"]',e=>e.value==='Source'));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.recoverTm(c.keys().find(k=>k.name==='beta'),'he');});check('captured healthy recovery refuses additional read',reads.length===2&&writes.length===0);
  mode='error';await page.$eval('[name=refreshTm]',e=>e.click());await page.waitForSelector('[name=tmError]');await page.$eval('[name=tmError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-tm-read-recovery-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=tmError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-tm-read-recovery-mobile.png'});check('390px failed memory error and retry fit',await page.$eval('[name=retryTm]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})&&await page.$eval('[name=tmError]',e=>e.textContent==='Translation memory unavailable.'));
  check('no memory recovery runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
