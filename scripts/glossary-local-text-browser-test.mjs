// Real local browser -> Glossary local text feedback -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55718, WEB_PORT = 4200, API_PORT = 3000;
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

  const alpha=await call(`${P}/glossary`,{term:'Alpha',translations:{he:'Original'}},token);await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Alpha in he"]');await page.waitForFunction(()=>!document.querySelector('[name=glossaryListLoading]'));
  let writes=0,reads=0,held,drop=false;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/glossary`)reads++;if(req.method()==='PATCH'&&path===`/api${P}/glossary/${alpha.id}`){writes++;if(drop)return req.respond({status:503,contentType:'application/json',body:'{}'});held=req;return;}req.continue();});
  const edit=async value=>page.$eval('[aria-label="Alpha in he"]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  check('loaded confirmed text has no unsaved or unknown row feedback',!await page.$('[name=glossaryLocalDraft]')&&!await page.$('[name=glossarySaveUnknown]'));
  await edit('Copy this local draft');await page.waitForSelector('[name=glossaryLocalDraft]');check('editing shows unsaved feedback without reading or saving',writes===0&&reads===0&&await page.$eval('[name=glossaryLocalDraft]',e=>e.textContent.includes('copy/download')));
  await page.screenshot({path:'/downloads/glossary-local-text-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/glossary-local-text-mobile.png',fullPage:true});check('narrow full local value/feedback fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[aria-label="Alpha in he"]',e=>e.getBoundingClientRect().width>=200));
  await edit('Original');await page.waitForFunction(()=>!document.querySelector('[name=glossaryLocalDraft]'));check('exact revert clears unsaved feedback without API effects',writes===0&&reads===0);
  await edit('Submitted');await page.$eval('[aria-label="Alpha in he"]',e=>e.dispatchEvent(new Event('blur')));await page.waitForSelector('[name=glossarySaving]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));check('real pending save uses saving state rather than unsaved claim',writes===1&&!await page.$('[name=glossaryLocalDraft]'));await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=glossarySaving]'));check('confirmed real save clears local feedback and updates server',!await page.$('[name=glossaryLocalDraft]')&&(await call(`${P}/glossary`,null,token)).find(t=>t.id===alpha.id).translations.he==='Submitted');
  await edit('Next submitted');await page.$eval('[aria-label="Alpha in he"]',e=>e.dispatchEvent(new Event('blur')));await page.waitForSelector('[name=glossarySaving]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.setTranslation(c.terms()[0],'he','Later local');});await held.continue();held=null;await page.waitForSelector('[name=glossaryLocalDraft]');check('later local edit survives prior save confirmation and remains marked',writes===2&&await page.$eval('[aria-label="Alpha in he"]',e=>e.value==='Later local')&&(await call(`${P}/glossary`,null,token)).find(t=>t.id===alpha.id).translations.he==='Next submitted');
  await edit('Original');await page.waitForSelector('[name=glossaryLocalDraft]');await edit('Next submitted');await page.waitForFunction(()=>!document.querySelector('[name=glossaryLocalDraft]'));check('same-list save confirmation advances comparison even after later local edits',writes===2&&reads===0);await edit('Later local');await page.waitForSelector('[name=glossaryLocalDraft]');
  drop=true;await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));void c.saveTranslations(c.terms()[0]);});await page.waitForSelector('[name=glossarySaveUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=glossarySaving]'));check('uncertain save has distinct unconfirmed feedback without unsaved retry instruction',writes===3&&reads===0&&!await page.$('[name=glossaryLocalDraft]')&&await page.$eval('[aria-label="Alpha in he"]',e=>e.readOnly));
  drop=false;await page.$eval('[name=refreshGlossaryList]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=glossaryListLoading]')&&!document.querySelector('[name=glossarySaveUnknown]'));check('current explicit read replaces local comparison and clears stale row feedback',reads===1&&writes===3&&!await page.$('[name=glossaryLocalDraft]')&&await page.$eval('[aria-label="Alpha in he"]',e=>e.value==='Next submitted'));
  check('no glossary local-text runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
