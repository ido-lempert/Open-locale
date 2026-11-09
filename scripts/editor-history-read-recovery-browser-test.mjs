// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55780, WEB_PORT = 4200, API_PORT = 3000;
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


  await call(`${P}/import/en`,{entries:{alpha:'Alpha'}},token);const a=(await call(`${P}/keys`,null,token))[0];await call(`${P}/keys/${a.id}/translations`,{locale:'en',value:'Current server history'},token,'PUT');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.history-toggle');
  let mode='error',held=[];const reads=[],writes=[];await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads.push(path);else writes.push(path);}if(path.endsWith('/history')){if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_HISTORY_READ'})});if(mode==='hold'){held.push(req);return;}}req.continue();});
  await page.click('.history-toggle');await page.waitForSelector('[name=historyError]');check('actual failed history reads show fixed retry without empty success',reads.length===2&&writes.length===0&&!await page.$('[name=historyEmpty]')&&!await page.$('.history-list')&&!(await page.content()).includes('PRIVATE_HISTORY_READ'));
  const input=await page.$('[aria-label="alpha in en"]');await input.focus();await input.type(' local draft');const local=await input.evaluate(e=>e.value);mode='hold';await page.click('[name=retryHistory]');for(let n=0;n<100&&held.length<2;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==2)throw new Error('history reads not held');await page.waitForSelector('[name=historyLoading]');check('focused failed-history retry reads only two locale histories without blur autosave',writes.length===0&&reads.length===4&&reads.every(p=>p.includes(`/keys/${a.id}/`)&&p.endsWith('/history'))&&await input.evaluate((e,v)=>e.value===v&&document.activeElement===e,local));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.recoverHistory(c.keys()[0]);});check('captured duplicate retry refuses pending read',reads.length===4&&writes.length===0);
  mode='live';await Promise.all(held.splice(0).map(r=>r.continue()));await page.waitForSelector('.history-list');check('successful current history keeps local translation without write or reload',reads.length===4&&writes.length===0&&await input.evaluate((e,v)=>e.value===v,local)&&await page.$eval('.history-list',e=>e.textContent.includes('Current server history')));
  mode='error';await page.$eval('[name=refreshHistory]',e=>e.click());await page.waitForSelector('[name=historyError]');await page.$eval('[name=historyError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-history-read-recovery-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=historyError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-history-read-recovery-mobile.png'});check('390px failed-history retry and bounded scope readable',await page.$eval('[name=retryHistory]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})&&await page.$eval('[name=historyRefreshScope]',e=>e.textContent.includes('at most 50')));
  check('no history recovery runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
