// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55764, WEB_PORT = 4200, API_PORT = 3000;
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
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="beta in he"]');
  const mutations=[],reads=[];page.on('request',r=>{if(r.url().includes('/api/')){if(!['GET','OPTIONS'].includes(r.method()))mutations.push(r.method());else reads.push(new URL(r.url()).pathname);}});
  await page.focus('[aria-label="beta in he"]');await page.waitForSelector('[name=tmEmpty]');check('settled no-match memory offers explicit refresh',!!await page.$('[name=refreshTm]')&&!(await page.$('.tm-pick')));
  await call(`${P}/keys/${a.id}/translations`,{locale:'he',value:'Fresh stored memory'},token,'PUT');
  let mode='hold',held=[];await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.endsWith('/tm/suggest')){if(mode==='hold'){held.push(req);return;}if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_MEMORY'})});}req.continue();});
  const waitHeld=async()=>{for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==1)throw new Error(`held count ${held.length}`);return held.shift();};
  reads.length=0;await page.click('[name=refreshTm]');const pending=await waitHeld();await page.waitForSelector('[name=tmLoading]');check('focused pointer refresh makes one memory-only read and zero saves',mutations.length===0&&reads.length===1&&reads[0].endsWith('/tm/suggest')&&await page.$eval('[aria-label="beta in he"]',e=>document.activeElement===e&&e.value===''));
  check('pending memory refresh disables control and hides old no-match',await page.$eval('[name=refreshTm]',e=>e.disabled)&&!await page.$('[name=tmEmpty]'));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.refreshTm(c.keys().find(k=>k.name==='beta'),'he');});check('captured duplicate refresh refuses',reads.length===1&&mutations.length===0);
  mode='live';await pending.continue();await page.waitForSelector('.tm-pick');check('fresh actual stored memory appears without applying',await page.$eval('.tm-suggest',e=>e.textContent.includes('Fresh stored memory'))&&await page.$eval('[aria-label="beta in he"]',e=>e.value==='')&&mutations.length===0);
  await page.$eval('[name=refreshTm]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-tm-refresh-desktop.png',fullPage:false});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshTm]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-tm-refresh-mobile.png',fullPage:false});check('390px memory control and scope fit',await page.$eval('[name=refreshTm]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})&&await page.$eval('[name=tmRefreshScope]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.textContent.includes('at most three');}));
  mode='error';await page.$eval('[name=refreshTm]',e=>e.click());await page.waitForSelector('[name=tmError]');check('memory failure keeps fixed existing retry without stale suggestions',!await page.$('[name=refreshTm]')&&!await page.$('.tm-pick')&&!await page.$('[name=tmEmpty]')&&!(await page.content()).includes('PRIVATE_MEMORY'));
  mode='live';await page.$eval('[name=retryTm]',e=>e.click());await page.waitForSelector('.tm-pick');check('existing retry restores fresh memory without saving',!!await page.$('[name=refreshTm]')&&mutations.length===0);
  mode='hold';await page.$eval('[name=refreshTm]',e=>e.click());const late=await waitHeld();await page.type('[aria-label="beta in he"]','local target');mode='live';await late.continue();await new Promise(r=>setTimeout(r,150));check('target edit fences late refreshed memory and retains unsaved text',!await page.$('[name=refreshTm]')&&!await page.$('.tm-pick')&&await page.$eval('[aria-label="beta in he"]',e=>e.value==='local target')&&mutations.length===0);
  check('no memory refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
