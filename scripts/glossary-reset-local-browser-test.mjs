// Real local browser -> Glossary local text feedback -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55720, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-glossary-local-text-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('glossary_delete_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/glossary_delete_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  await call(`${P}/import/en`,{entries:{title:'Local title',conflict:'Local edit',remote:'Old text',empty:''}},token);
  await call(`${P}/tasks`,{title:'Actual task recovery'},token);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  const alpha=await call(`${P}/glossary`,{term:'Alpha',translations:{he:'Loaded'}},token);await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Alpha in he"]');let writes=0,reads=0;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}req.continue();});

  const edit=async value=>page.$eval('[aria-label="Alpha in he"]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  check('clean loaded row has no reset control',!await page.$('[name=resetGlossaryLocalText]'));
  await page.type('[name=gTerm]','Keep new term');await edit('Copy this local draft');await page.waitForSelector('[name=resetGlossaryLocalText]');await page.focus('[aria-label="Alpha in he"]');await page.click('[name=resetGlossaryLocalText]');await page.waitForSelector('[name=glossaryResetConfirmation]');await page.screenshot({path:'/downloads/glossary-reset-confirm-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/glossary-reset-confirm-mobile.png',fullPage:true});await page.click('[name=cancelGlossaryLocalReset]');check('actual focused reset opens local-only confirmation and cancel keeps draft without blur write',writes===0&&reads===0&&await page.$eval('[aria-label="Alpha in he"]',e=>e.value==='Copy this local draft'));
  await page.screenshot({path:'/downloads/glossary-reset-local-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/glossary-reset-local-mobile.png',fullPage:true});check('narrow reset control/full translation fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[aria-label="Alpha in he"]',e=>e.getBoundingClientRect().width>=200));
  await call(`${P}/glossary/${alpha.id}`,{translations:{he:'Newer server'}},token,'PATCH');await edit('Copy this local draft');await page.waitForSelector('[name=resetGlossaryLocalText]');await page.$eval('[name=resetGlossaryLocalText]',e=>e.click());await page.waitForSelector('[name=confirmGlossaryLocalReset]');check('inline confirmation states local-only boundary',await page.$eval('[name=glossaryResetConfirmation]',e=>e.textContent.includes('does not read newer server values or undo server changes')));await page.click('[name=confirmGlossaryLocalReset]');await page.waitForFunction(()=>!document.querySelector('[name=resetGlossaryLocalText]'));check('confirmed reset uses last loaded value not newer unread server and keeps new-term draft',writes===0&&reads===0&&await page.$eval('[aria-label="Alpha in he"]',e=>e.value==='Loaded')&&await page.$eval('[name=gTerm]',e=>e.value==='Keep new term')&&(await call(`${P}/glossary`,null,token)).find(t=>t.id===alpha.id).translations.he==='Newer server');
  await edit('Stale click');await page.waitForSelector('[name=resetGlossaryLocalText]');await page.evaluate(()=>{window.gc=ng.getComponent(document.querySelector('ol-glossary'));window.old=window.gc.terms()[0];window.gc.setTranslation(window.old,'he','Later local');window.gc.resetLocalText(window.old);});check('captured old row handler refuses before confirmation',!await page.$('[name=glossaryResetConfirmation]')&&await page.$eval('[aria-label="Alpha in he"]',e=>e.value==='Later local'));
  await page.$eval('[name=refreshGlossaryList]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=glossaryListLoading]'));await edit('Local after current read');await page.waitForSelector('[name=resetGlossaryLocalText]');await page.$eval('[name=resetGlossaryLocalText]',e=>e.click());await page.waitForSelector('[name=confirmGlossaryLocalReset]');await page.$eval('[name=confirmGlossaryLocalReset]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=resetGlossaryLocalText]'));check('explicit current read advances reset comparison without additional write',reads===1&&writes===0&&await page.$eval('[aria-label="Alpha in he"]',e=>e.value==='Newer server'));
  await edit('Departed draft');await page.waitForSelector('[name=resetGlossaryLocalText]');await page.evaluate(()=>{window.old=window.gc.terms()[0];history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-glossary'));await page.evaluate(()=>window.gc.resetLocalText(window.old));check('departed reset rejects captured handler without confirmation or effects',writes===0);
  check('no glossary local reset runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
