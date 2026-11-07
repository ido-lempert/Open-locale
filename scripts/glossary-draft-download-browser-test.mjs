// Real local browser -> local glossary draft backup -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55714, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
const downloadDir=mkdtempSync(join(tmpdir(),'ol-glossary-draft-'));
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-glossary-draft-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('glossary_draft_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/glossary_draft_browser`;
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


  const term=await call(`${P}/glossary`,{term:'Checkout',notes:'=Literal\n"עברית"<b>text</b>'},token);await call(`${P}/glossary/${term.id}`,{translations:{he:'Saved'}},token,'PATCH');await call(`${P}/glossary`,{term:'Second',doNotTranslate:true},token);
  await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.querySelectorAll('.glossary-table tbody tr').length===2&&!document.querySelector('[name=glossaryListLoading]'));
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'glossary-local-draft.json'),readDownload=async()=>{for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));if(!existsSync(file))throw new Error('download not finished');return JSON.parse(readFileSync(file,'utf8'));};
  let reads=0,writes=0,held,hold=false,fail=false,unknown=false;
  await page.setRequestInterception(true);page.on('request',async req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.endsWith('/glossary')&&req.method()==='GET'){if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_API'})});if(hold){held=req;return;}}if(unknown&&req.method()==='PATCH'&&u.pathname.endsWith(`/glossary/${term.id}`)){await call(`${P}/glossary/${term.id}`,JSON.parse(req.postData()),token,'PATCH');return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_PATCH'})});}}req.continue();});
  await page.type('[name=gTerm]','Unsaved new term');await page.type('[name=gNotes]','Local new notes');await page.click('[name=gDnt]');
  // Edit locally without blur: the captured download handler must not save text.
  await page.$eval('[aria-label="Checkout in he"]',e=>{e.value='Unsaved local';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.type('[name=glossarySearch]','checkout');await page.waitForFunction(()=>document.querySelectorAll('.glossary-table tbody tr').length===1);
  await page.focus('[aria-label="Checkout in he"]');await page.click('[name=downloadGlossaryDraft]');const draft=await readDownload();
  const expectedRows=(await call(`${P}/glossary`,undefined,token)).map(t=>({id:t.id,term:t.term,notes:t.notes??null,doNotTranslate:t.doNotTranslate,translations:t.id===term.id?{...t.translations,he:'Unsaved local'}:t.translations,saveOutcomeUnconfirmed:false,deleteOutcomeUnconfirmed:false}));
  check('actual JSON preserves all loaded local rows despite search and full new-term form',isDeepStrictEqual(draft,{schemaVersion:1,projectId:project.id,scope:'all-loaded-local-glossary-drafts',serverStateConfirmed:false,importable:false,newTermDraft:{term:'Unsaved new term',notes:'Local new notes',doNotTranslate:true,createOutcomeUnconfirmed:false},terms:expectedRows}));
  await page.waitForSelector('[name=glossaryDraftNotice]');check('backup has no API effects and explicit local/private/not-import scope',reads===0&&writes===0&&await page.$eval('[name=glossaryDraftScope]',e=>e.textContent.includes('private content')&&e.textContent.includes('not an import'))&&await page.$eval('[name=glossaryDraftNotice]',e=>e.textContent.includes('does not confirm')));rmSync(file);
  unknown=true;await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.saveTranslations(c.terms().find(t=>t.term==='Checkout'));});await page.waitForSelector('[name=glossarySaveUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=glossarySaving]'));
  await page.$eval('[name=downloadGlossaryDraft]',e=>e.click());const uncertain=await readDownload();check('real committed then dropped save remains downloadable with local value and explicit unconfirmed flag',writes===1&&reads===0&&uncertain.terms.find(t=>t.id===term.id).saveOutcomeUnconfirmed&&uncertain.terms.find(t=>t.id===term.id).translations.he==='Unsaved local'&&(await call(`${P}/glossary`,undefined,token)).find(t=>t.id===term.id).translations.he==='Unsaved local');
  await page.screenshot({path:'/downloads/glossary-draft-download-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/glossary-draft-download-mobile.png',fullPage:true});check('narrow private local-draft warning/button/notice fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[aria-label="Checkout in he"]',e=>e.getBoundingClientRect().width>=200));rmSync(file);
  unknown=false;hold=true;await page.$eval('[name=refreshGlossaryList]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=downloadGlossaryDraft]')?.disabled&&!document.querySelector('[name=glossaryDraftNotice]'));for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).downloadDraft());check('pending read blocks captured backup and clears notice',reads===1&&readdirSync(downloadDir).length===0);hold=false;await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=glossaryListLoading]')&&!document.querySelector('[name=downloadGlossaryDraft]')?.disabled);await page.$eval('[name=downloadGlossaryDraft]',e=>e.click());const fresh=await readDownload();check('explicit refresh clears unknown flag while keeping new-term form and search',!fresh.terms.find(t=>t.id===term.id).saveOutcomeUnconfirmed&&fresh.newTermDraft.term==='Unsaved new term'&&await page.$eval('[name=glossarySearch]',e=>e.value==='checkout'));rmSync(file);
  fail=true;await page.$eval('[name=refreshGlossaryList]',e=>e.click());await page.waitForSelector('[name=glossaryListError]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).downloadDraft());check('failed read refuses false-empty/stale backup without raw error',await page.$eval('[name=downloadGlossaryDraft]',e=>e.disabled)&&readdirSync(downloadDir).length===0&&!(await page.content()).includes('PRIVATE_API'));
  fail=false;await page.$eval('[name=retryGlossaryList]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=glossaryListLoading]')&&!document.querySelector('[name=downloadGlossaryDraft]')?.disabled);
  await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('PRIVATE_DOWNLOAD');};ng.getComponent(document.querySelector('ol-glossary')).downloadDraft();});await page.waitForFunction(()=>document.querySelector('[name=glossaryDraftNotice]')?.textContent.includes('Copy your local text'));check('local failure provides fixed copy-before-refresh guidance',!(await page.content()).includes('PRIVATE_DOWNLOAD'));
  await page.evaluate(()=>{window.oldGlossary=ng.getComponent(document.querySelector('ol-glossary'));window.afterDestroy=0;URL.createObjectURL=()=>{window.afterDestroy++;return 'blob:local';};history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-glossary'));await page.evaluate(()=>window.oldGlossary.downloadDraft());check('departed backup handler cannot export',await page.evaluate(()=>window.afterDestroy===0)&&readdirSync(downloadDir).length===0);
  check('no glossary backup runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
