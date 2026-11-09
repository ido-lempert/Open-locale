// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55762, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-history-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('history_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/history_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Alpha',beta:'Beta'}},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.history-toggle');
  const mutations=[];page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','OPTIONS'].includes(r.method()))mutations.push(r.method());});
  const keys=await call(`${P}/keys`,null,token);const a=keys.find(k=>k.name==='alpha'),b=keys.find(k=>k.name==='beta');
  await call(`${P}/keys/${a.id}/translations`,{locale:'en',value:'History seed'},token,'PUT');
  // Locate by literal visible key label, not row ordinal once a history row exists.
  const toggle=async name=>page.evaluate(name=>{const row=[...document.querySelectorAll('.grid tbody tr:not(.history-row)')].find(r=>r.textContent.includes(name));row.querySelector('.history-toggle').click();},name);
  await toggle('alpha');await page.waitForSelector('.history-list');await call(`${P}/keys/${a.id}/translations`,{locale:'en',value:'Current server history'},token,'PUT');
  let mode='hold',held=[],reads=[];await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET')reads.push(path);if(path.endsWith('/history')){if(mode==='hold'){held.push(req);return;}if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_HISTORY'})});}req.continue();});
  const waitHeld=async()=>{for(let n=0;n<100&&held.length<2;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==2)throw new Error(`held count ${held.length}`);return held.splice(0);};
  const input=await page.evaluateHandle(()=>[...document.querySelectorAll('.grid tbody tr:not(.history-row)')].find(r=>r.textContent.includes('alpha')).querySelector('textarea'));
  await input.asElement().focus();await input.asElement().type(' local draft');const localValue=await input.asElement().evaluate(e=>e.value);await page.click('[name=refreshHistory]');const pending=await waitHeld();await page.waitForSelector('[name=historyLoading]');check('focused pointer refresh makes only two locale history reads without blur autosave',mutations.length===0&&reads.length===2&&reads.every(p=>p.includes(`/keys/${a.id}/`)&&p.endsWith('/history'))&&await input.asElement().evaluate((e,v)=>e.value===v&&document.activeElement===e,localValue));
  check('pending refresh hides stale history and disables control',!await page.$('.history-list')&&await page.$eval('[name=refreshHistory]',e=>e.disabled));await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.refreshHistory(c.keys().find(k=>k.name==='alpha'));});check('captured duplicate refresh refuses',reads.length===2&&mutations.length===0);
  mode='live';await Promise.all(pending.map(r=>r.continue()));await page.waitForSelector('.history-list');check('actual fresh saved history appears while local translation remains',await page.$eval('.history-list',e=>e.textContent.includes('Current server history'))&&await input.asElement().evaluate((e,v)=>e.value===v,localValue)&&reads.length===2&&mutations.length===0);
  await page.$eval('[name=refreshHistory]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-history-refresh-desktop.png',fullPage:false});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshHistory]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-history-refresh-mobile.png',fullPage:false});check('390px refresh and bounded-history scope fit',await page.$eval('[name=refreshHistory]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})&&await page.$eval('[name=historyRefreshScope]',e=>e.textContent.includes('at most 50')&&e.textContent.includes('not one database snapshot')));
  mode='error';await page.$eval('[name=refreshHistory]',e=>e.click());await page.waitForSelector('[name=historyError]');check('failed locale history refresh uses fixed existing retry not empty success',!await page.$('[name=refreshHistory]')&&!await page.$('.history-list')&&!await page.$('[name=historyEmpty]')&&!(await page.content()).includes('PRIVATE_HISTORY')&&await input.asElement().evaluate((e,v)=>e.value===v,localValue));
  mode='live';await page.$eval('[name=retryHistory]',e=>e.click());await page.waitForSelector('.history-list');check('existing retry restores saved history and normal refresh',!!await page.$('[name=refreshHistory]')&&await page.$eval('.history-list',e=>e.textContent.includes('Current server history'))&&mutations.length===0);
  mode='hold';await page.$eval('[name=refreshHistory]',e=>e.click());const late=await waitHeld();await toggle('alpha');mode='live';await Promise.all(late.map(r=>r.continue()));await new Promise(r=>setTimeout(r,150));check('late refreshed history cannot reopen closed pane',!await page.$('[name=refreshHistory]')&&!await page.$('.history-list')&&mutations.length===0);
  check('no history refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
