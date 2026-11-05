// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55589, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tm-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('tm_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/tm_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Source',beta:'Source'}},token);const keys=await call(`${P}/keys`,null,token),a=keys.find(k=>k.name==='alpha'),b=keys.find(k=>k.name==='beta');await call(`${P}/keys/${a.id}/translations`,{locale:'he',value:'Stored memory'},token,'PUT');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="beta in he"]');
  await page.setRequestInterception(true);let mode='hold',held=[];
  page.on('request',req=>{if(new URL(req.url()).pathname.endsWith('/tm/suggest')){if(mode==='hold'){held.push(req);return;}if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-tm-error'})});}return req.continue();});
  const waitHeld=async()=>{for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==1)throw new Error(`held ${held.length}`);return held.shift();};
  const focus=async()=>page.focus('[aria-label="beta in he"]');const base=async()=>page.focus('[aria-label="beta in en"]');
  const answer=async(req,text)=>{await req.respond({status:200,contentType:'application/json',body:JSON.stringify({suggestions:[{targetText:text,score:1}]})});await new Promise(r=>setTimeout(r,150));};
  await focus();const old=await waitHeld();await base();await focus();const fresh=await waitHeld();await answer(old,'OLD');check('same-cell old response cannot fill or settle newer read',!!await page.$('[name=tmLoading]')&&!(await page.$('.tm-pick')));await answer(fresh,'FRESH');await page.waitForSelector('.tm-pick');check('current selected read shows only fresh suggestion',await page.$eval('.tm-suggest',e=>e.textContent.includes('FRESH')&&!e.textContent.includes('OLD')));
  await page.type('[aria-label="beta in he"]','typed target');await page.waitForFunction(()=>!document.querySelector('.tm-pick'));check('typing target clears options without applying stale memory',await page.$eval('[aria-label="beta in he"]',e=>e.value==='typed target'));
  await page.$eval('[aria-label="beta in he"]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await base();await focus();const typing=await waitHeld();await page.type('[aria-label="beta in he"]','new typed');await answer(typing,'LATE');check('late response after target edit never displays or overwrites',!(await page.$('.tm-pick'))&&await page.$eval('[aria-label="beta in he"]',e=>e.value==='new typed'));
  await page.$eval('[aria-label="beta in he"]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});mode='error';await base();await focus();await page.waitForSelector('[name=tmError]');check('memory failure uses fixed guidance without raw service error',!(await page.$('.tm-pick'))&&!(await page.content()).includes('private-tm-error'));await page.$eval('[name=tmError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-tm-error.png',fullPage:false});
  mode='live';await page.click('[name=retryTm]');await page.waitForSelector('.tm-pick');check('manual retry gets actual stored translation memory',await page.$eval('.tm-suggest',e=>e.textContent.includes('Stored memory')));await page.screenshot({path:'/downloads/editor-tm-retry.png',fullPage:false});
  await page.focus('.tm-pick');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[aria-label="beta in he"]')?.value==='Stored memory'&&!document.querySelector('.tm-pick'));for(let n=0;n<100;n++){const k=(await call(`${P}/keys`,null,token)).find(k=>k.id===b.id);if(k.translations.find(t=>t.localeCode==='he')?.value==='Stored memory')break;await new Promise(r=>setTimeout(r,20));}const saved=(await call(`${P}/keys`,null,token)).find(k=>k.id===b.id).translations.find(t=>t.localeCode==='he');check('keyboard apply saves explicitly chosen current suggestion unverified',saved?.value==='Stored memory'&&saved?.status==='UNVERIFIED');
  check('no TM runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
