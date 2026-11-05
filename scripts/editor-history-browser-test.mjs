// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55585, WEB_PORT = 4200, API_PORT = 3000;
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
  await page.setRequestInterception(true);let held=[],mode='hold';
  page.on('request',req=>{if(new URL(req.url()).pathname.endsWith('/history')){
    if(mode==='hold'){held.push(req);return;}if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-history-error'})});
  }req.continue();});
  const waitHeld=async n=>{for(let i=0;i<100&&held.length<n;i++)await new Promise(r=>setTimeout(r,20));if(held.length!==n)throw new Error(`held ${held.length} expected ${n}`);};
  const answer=async(reqs,label)=>{await Promise.all(reqs.map((req,i)=>req.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:label+i,value:label,status:'TRANSLATED',changedBy:{displayName:'Owner'},createdAt:'2026-11-05T10:00:00Z'}])})));await new Promise(r=>setTimeout(r,150));};
  await toggle('alpha');await waitHeld(2);const old=held.splice(0);await toggle('beta');await waitHeld(2);const fresh=held.splice(0);await answer(old,'OLD-ALPHA');
  check('held A response cannot fill B or settle B loading',!!await page.$('[name=historyLoading]')&&!(await page.$('.history-list')));
  await answer(fresh,'FRESH-BETA');await page.waitForSelector('.history-list');check('latest selected key shows only its own history',await page.$eval('.history-list',e=>e.textContent.includes('FRESH-BETA')&&!e.textContent.includes('OLD-ALPHA')));
  await toggle('beta');check('closing clears visible history',!(await page.$('.history-row')));
  await toggle('alpha');await waitHeld(2);const closed=held.splice(0);await toggle('alpha');await answer(closed,'CLOSED-PRIVATE');check('closed pending read never reopens history',!(await page.$('.history-row')));
  mode='error';await toggle('alpha');await page.waitForSelector('[name=historyError]');check('failed history is not empty success or raw error',!(await page.$('[name=historyEmpty]'))&&!(await page.$('.history-list'))&&!(await page.content()).includes('private-history-error'));
  await page.$eval('[name=historyError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-history-error.png',fullPage:false});
  mode='live';await page.click('[name=retryHistory]');await page.waitForSelector('.history-list');check('manual retry restores actual history read',!(await page.$('[name=historyError]'))&&!!await page.$('.history-list'));
  await page.screenshot({path:'/downloads/editor-history-retry.png',fullPage:false});await toggle('alpha');
  mode='hold';await toggle('alpha');await waitHeld(2);const leaving=held.splice(0);await page.click('a.settings-link');await page.waitForSelector('form');await answer(leaving,'AFTER-DESTROY');check('late read after actual navigation never mounts history in destination',new URL(page.url()).pathname.endsWith('/settings')&&!(await page.$('.history-row'))&&!(await page.content()).includes('AFTER-DESTROY'));
  check('history controls perform reads only',mutations.length===0);check('no history browser runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  process.exitCode=failures?1:0;
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
