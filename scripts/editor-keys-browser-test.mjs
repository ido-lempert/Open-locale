// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55588, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-keys-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('keys_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/keys_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Alpha'}},token);await call(`${P}/branches`,{name:'feature'},token);await call(`${P}/import/en?branch=feature`,{entries:{beta:'Beta'}},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.grid textarea');
  await page.setRequestInterception(true);let mode='hold',held=[],writes=0;
  page.on('request',req=>{if(req.method()==='PUT'&&new URL(req.url()).pathname.endsWith('/translations'))writes++;if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/keys`){if(mode==='hold'){held.push(req);return;}if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-key-error'})});}return req.continue();});
  const waitHeld=async()=>{for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==1)throw new Error(`held ${held.length}`);return held.shift();};
  await page.select('[name=branch]','feature');const old=await waitHeld();await page.waitForSelector('[name=keysLoading]');check('pending branch read retains previous grid but makes it inert',await page.$eval('.grid',e=>e.inert&&e.textContent.includes('alpha'))&&!(await page.$('.empty')));
  // Dispatch retained input/blur handlers deliberately despite inert. This checks
  // runtime write policy rather than relying on Chrome's interaction suppression.
  await page.$eval('[aria-label="alpha in en"]',e=>{e.value='Pending retained draft';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('blur'));});
  await new Promise(r=>setTimeout(r,100));check('pending grid handler cannot send content PUT or alter persisted translation',writes===0&&(await call(`${P}/keys`,null,token))[0].translations.find(t=>t.localeCode==='en').value==='Alpha'&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Pending retained draft'));
  // Revert the deliberately injected retained draft before a clean superseding branch read.
  await page.$eval('[aria-label="alpha in en"]',e=>{e.value='Alpha';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>!document.querySelector('[name=branch]').disabled);
  await page.select('[name=branch]','main');const fresh=await waitHeld();await fresh.continue();await page.waitForFunction(()=>!document.querySelector('[name=keysLoading]'));await page.type('.grid textarea',' newer draft');const currentDraft=await page.$eval('.grid textarea',e=>e.value);await old.continue();await new Promise(r=>setTimeout(r,200));check('old feature result cannot replace current main grid or cells',await page.$eval('.grid',e=>e.textContent.includes('alpha')&&!e.textContent.includes('beta'))&&await page.$eval('.grid textarea',(e,v)=>e.value===v,currentDraft));
  mode='error';await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).reload());await page.waitForSelector('[name=keysError]');check('failed current read retains draft read-only without raw error or false empty',await page.$eval('.grid',e=>e.inert)&&await page.$eval('.grid textarea',(e,v)=>e.value===v,currentDraft)&&!(await page.content()).includes('private-key-error')&&!(await page.$('.empty')));const writesBeforeFailed=writes,storedBeforeFailed=(await call(`${P}/keys`,null,token))[0].translations.find(t=>t.localeCode==='en').value;
  await page.$eval('[aria-label="alpha in en"]',e=>{e.value='Failed retained draft';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('blur'));});await new Promise(r=>setTimeout(r,100));check('failed grid handler cannot send content PUT or change persisted translation',writes===writesBeforeFailed&&(await call(`${P}/keys`,null,token))[0].translations.find(t=>t.localeCode==='en').value===storedBeforeFailed);
  check('inert retained draft has selectable outside-grid copy text',await page.$eval('[name=retainedKeyDrafts]',(e,v)=>e.readOnly&&!e.closest('[inert]')&&e.value.includes(v),'Failed retained draft'));await page.click('details summary');await page.waitForFunction(()=>document.querySelector('[name=retainedKeyDrafts]')?.getBoundingClientRect().height>0);await page.screenshot({path:'/downloads/editor-keys-copy.png',fullPage:false});await page.$eval('[name=keysError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-keys-error.png',fullPage:false});
  mode='live';await page.click('[name=retryKeys]');await page.waitForFunction(()=>!document.querySelector('[name=keysLoading]')&&!document.querySelector('[name=keysError]'));check('explicit retry replaces retained grid with current main result',await page.$eval('.grid',e=>!e.inert&&e.textContent.includes('alpha')&&!e.textContent.includes('beta')));await page.select('[name=branch]','feature');await page.waitForSelector('[aria-label="beta in en"]');await page.screenshot({path:'/downloads/editor-keys-retry.png',fullPage:false});
  await page.type('[aria-label="Search keys"]','nothing-matches');await page.waitForSelector('[name=filteredKeysEmpty]');check('filtered empty result never claims branch has no keys',!(await page.$('[name=branchKeysEmpty]'))&&!!await page.$('[name=clearKeyFilters]'));await page.screenshot({path:'/downloads/editor-filter-empty.png',fullPage:false});
  await page.click('[name=clearKeyFilters]');await page.waitForSelector('[aria-label="beta in en"]');check('clear filters recovers keys on same feature branch',await page.$eval('[name=branch]',e=>e.value==='feature')&&await page.$eval('[aria-label="Search keys"]',e=>e.value==='')&&!!await page.$('[aria-label="beta in en"]'));
  await call(`${P}/branches`,{name:'empty'},token);await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');await page.select('[name=branch]','empty');await page.waitForSelector('[name=branchKeysEmpty]');check('unfiltered empty branch identifies its scope without clear-filter action',await page.$eval('[name=branchKeysEmpty]',e=>e.textContent.includes('branch empty'))&&!(await page.$('[name=clearKeyFilters]')));await page.screenshot({path:'/downloads/editor-branch-empty.png',fullPage:false});await page.select('[name=branch]','feature');await page.waitForSelector('[aria-label="beta in en"]');
  mode='hold';await page.type('[aria-label="Search keys"]','b');const early=await waitHeld();await page.type('[aria-label="Search keys"]','eta');await early.respond({status:200,contentType:'application/json',body:'[]'});await page.waitForSelector('[name=keysLoading]');check('new search keystroke invalidates old response before debounce',await page.$eval('.grid',e=>e.textContent.includes('beta')&&e.inert)&&!(await page.$('.empty')));const latest=await waitHeld();await latest.continue();await page.waitForFunction(()=>!document.querySelector('[name=keysLoading]'));check('latest debounced search result settles grid',await page.$eval('.grid',e=>!e.inert&&e.textContent.includes('beta')));
  await page.type('[aria-label="Search keys"]','none');const pending=await waitHeld();await page.click('a.settings-link');await page.waitForFunction(()=>location.pathname.endsWith('/settings')&&!document.querySelector('.grid'));await pending.respond({status:503,contentType:'application/json',body:'{"message":"late-private"}'});await new Promise(r=>setTimeout(r,100));check('late read failure after navigation never mounts keys feedback',!(await page.$('[name=keysError]'))&&!(await page.$('[name=keysLoading]')));
  check('no keys browser runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
