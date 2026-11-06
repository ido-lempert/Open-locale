// Real local browser -> Glossary search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55683, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
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


  const term=await call(`${P}/glossary`,{term:'Checkout [A]',notes:'Billing note',translations:{he:'תשלום'}},token);
  await call(`${P}/glossary`,{term:'Account',notes:'Customer identity'},token);
  await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Checkout [A] in he"]');
  await page.type('[name=gTerm]','New draft');await page.type('[name=gNotes]','Keep notes');
  let reads=0,writes=0,held;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else{writes++;if(req.method()==='PATCH'&&u.pathname===`/api${P}/glossary/${term.id}`){held=req;return;}}}req.continue();});
  const search=async text=>{await page.$eval('[name=glossarySearch]',(e,text)=>{e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));},text);};
  await search('BILLING');await page.waitForFunction(()=>document.querySelector('[name=glossaryMatches]')?.textContent.includes('1 of 2'));
  check('literal case-insensitive notes search filters real loaded terms',await page.$$eval('.glossary-table tbody tr',rows=>rows.length===1&&rows[0].textContent.includes('Checkout [A]')));
  await search('תשלום');await page.waitForFunction(()=>document.querySelector('[name=glossarySearch]').value==='תשלום');check('translation text search finds actual stored locale value',await page.$eval('[aria-label="Checkout [A] in he"]',e=>e.value==='תשלום'));
  await search('.*');await page.waitForSelector('[name=glossaryListEmpty]');check('search treats regex characters literally and distinguishes no-match',await page.$eval('[name=glossaryListEmpty]',e=>e.textContent.includes('No loaded terms match'))&&await page.$eval('[name=glossaryMatches]',e=>e.textContent.includes('0 of 2')));
  await page.click('[name=clearGlossarySearch]');await page.waitForSelector('[aria-label="Checkout [A] in he"]');
  const field='[aria-label="Checkout [A] in he"]';await page.$eval(field,e=>{e.value='Local draft';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.focus(field);await page.click('[name=glossarySearch]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('translation save not held');await held.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});await page.waitForSelector('[name=glossarySaveUnknown]');
  await search('Account');await page.waitForFunction(()=>document.querySelector('.glossary-table tbody')?.textContent.includes('Account')&&!document.querySelector('.glossary-table tbody')?.textContent.includes('Checkout [A]'));
  check('search hides unrelated paused local row without refetch or extra mutation',reads===0&&writes===1&&await page.$eval('[name=gTerm]',e=>e.value==='New draft')&&await page.$eval('[name=gNotes]',e=>e.value==='Keep notes'));
  await search('LOCAL DRAFT');await page.waitForSelector(field);check('local draft remains searchable and read-only unknown-save pause survives hiding',await page.$eval(field,e=>e.value==='Local draft'&&e.readOnly)&&!!await page.$('[name=glossarySaveUnknown]')&&await page.$eval('[name=glossaryMatches]',e=>e.textContent.includes('1 of 2')));
  await page.screenshot({path:'/downloads/glossary-search-filtered.png',fullPage:true});
  await page.click('[name=clearGlossarySearch]');await page.waitForFunction(()=>document.querySelector('[name=glossaryMatches]')?.textContent.includes('2 of 2'));check('clear restores all loaded rows and keeps new-term draft without server read',reads===0&&writes===1&&await page.$$eval('.glossary-table tbody tr',rows=>rows.length===2)&&await page.$eval('[name=gTerm]',e=>e.value==='New draft'));
  await page.screenshot({path:'/downloads/glossary-search.png',fullPage:true});check('no glossary search runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
