// Real local browser -> QA findings download -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55692, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;const downloadDir=mkdtempSync(join(tmpdir(),'ol-qa-download-'));
process.exitCode = 1;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  const saved=await call(`${P}/sync/preview-records`,{branch:'main',locale:'en',baselineJson:'{}',remoteJson:'{"title":"PRIVATE translation value"}',remoteSha:'a'.repeat(40)},token);
  const second=await call('/projects',{name:'Second scope',slug:'second-scope',locales:['en']},token);
  await page.goto(`${WEB}${P}/sync/history`,{waitUntil:'networkidle0'});await page.waitForSelector('article');let reads=0,writes=0,mode='fail',held;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}if(u.pathname===`/api${P}/sync/preview-records`){if(mode==='fail')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE stack token'} )});if(mode==='hold'){held=req;return;}}req.continue();});
  await page.click('[name=syncHistoryRefresh]');await page.waitForSelector('[role=alert]');check('real failed history read shows fixed guidance not raw server text or stale records',reads===1&&!await page.$('article')&&await page.$eval('[role=alert]',e=>e.textContent==='Diagnostic history unavailable. Project admin access is required. Try Refresh history or reload the page.')&&!(await page.content()).includes('PRIVATE stack token')&&!(await page.content()).includes(saved.record.fingerprint));await page.screenshot({path:'/downloads/sync-history-read-error.png',fullPage:true});
  mode='hold';await page.click('[name=syncHistoryRefresh]');await page.waitForFunction(()=>document.querySelector('[name=syncHistoryRefresh]')?.disabled);for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('refresh not held');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-sync-history'));c.refresh();c.refresh();});check('held refresh suppresses captured duplicates and clears stale error/records',reads===2&&!await page.$('[role=alert]')&&!await page.$('article')&&await page.$eval('[name=syncHistoryRefresh]',e=>e.disabled));
  await held.continue();await page.waitForSelector('article');check('explicit retry recovers exact persisted diagnostic without apply or translation text',await page.$eval('article',(e,f)=>e.textContent.includes(f)&&e.textContent.includes('not applied'),saved.record.fingerprint)&&!(await page.content()).includes('PRIVATE translation value')&&await page.$$eval('button',es=>!es.some(e=>/apply|save|push/i.test(e.textContent))));
  mode='hold';held=undefined;await page.click('[name=syncHistoryRefresh]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('project-race read not held');await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${second.id}/sync/history`);await page.waitForFunction(()=>document.body.textContent.includes('No diagnostic preview records'));await held.continue();await new Promise(r=>setTimeout(r,150));check('late real old-project response cannot expose records after route reuse',reads===4&&!await page.$('article')&&!(await page.content()).includes(saved.record.fingerprint)&&!await page.$('[role=alert]'));
  await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/sync-history-read-recovered.png',fullPage:true});const before=reads;await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-sync-history'));c.ngOnDestroy();c.refresh();void c.load('ignored');});await new Promise(r=>setTimeout(r,100));check('destroyed captured handlers cannot issue new history reads',reads===before&&writes===0);check('no history read runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(process.exitCode??1);
