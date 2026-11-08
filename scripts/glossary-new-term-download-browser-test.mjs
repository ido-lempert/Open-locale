// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55748, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const downloadDir=mkdtempSync(join(tmpdir(),'ol-new-term-download-'));
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-glossary-create-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('glossary_create_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/glossary_create_browser`;
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

  await call(`${P}/glossary`,{term:'Existing',translations:{he:'PRIVATE_ROW'}},token);const next=await call('/projects',{name:'Next',slug:'next-term-download',locales:['en','he']},token);
  await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Existing in he"]');
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  const file=join(downloadDir,'new-glossary-term-form.json');const backup=async()=>{await page.$eval('[name=downloadNewTermDraft]',e=>e.click());for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const text=readFileSync(file,'utf8');rmSync(file);await page.waitForSelector('[name=newTermDownloadNotice]');return {text,data:JSON.parse(text)};};
  const set=async(name,value)=>page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  let reads=0,writes=0,held,heldSave,hold=false,holdSave=false,drop=false,failRead=false;await page.setRequestInterception(true);page.on('request',async req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.includes('/glossary')){if(req.method()==='PATCH'&&holdSave){heldSave=req;return;}if(req.method()==='POST'){if(hold){held=req;return;}if(drop){const r=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('create failed');await r.json();return req.abort('failed');}}if(req.method()==='GET'&&failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ'})});}}req.continue();});
  await set('gTerm',' =Term "עברית"<b>literal</b> ');await set('gNotes',' raw notes ');await page.click('[name=gDnt]');const first=await backup();check('actual JSON preserves exact raw new-term form and excludes loaded private row',JSON.stringify(first.data)===JSON.stringify({schemaVersion:1,projectId:project.id,scope:'current-local-new-glossary-term-form',serverStateConfirmed:false,importable:false,canCreate:false,createOutcomeUnconfirmed:false,draft:{term:' =Term "עברית"<b>literal</b> ',notes:' raw notes ',doNotTranslate:true}})&&!first.text.includes('PRIVATE_ROW')&&reads===0&&writes===0);
  await set('gNotes','edited');await set('gNotes',' raw notes ');await page.waitForFunction(()=>!document.querySelector('[name=newTermDownloadNotice]'));check('edit/exact revert cannot revive previous backup result',!existsSync(file)&&reads===0&&writes===0);
  await page.type('[aria-label="Existing in he"]',' changed');await page.click('[aria-label="Existing in he"]');await page.click('[name=downloadNewTermDraft]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const focused=JSON.parse(readFileSync(file,'utf8'));rmSync(file);check('actual pointer download keeps changed row focused without blur autosave',writes===0&&await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')==='Existing in he')&&!JSON.stringify(focused).includes('PRIVATE_ROW'));
  holdSave=true;await page.click('[name=gTerm]');for(let n=0;n<100&&!heldSave;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>document.querySelector('[name=downloadGlossaryDraft]')?.disabled);check('real pending row save does not disable separate form backup',!!heldSave&&await page.$eval('[name=downloadNewTermDraft]',e=>!e.disabled)&&await page.$eval('[name=downloadGlossaryDraft]',e=>e.disabled));const pending=await backup();check('backup during actual row save has no extra API effects',writes===1&&pending.data.draft.notes===' raw notes ');holdSave=false;await heldSave.continue();heldSave=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-glossary')).savingIds().length);
  hold=true;await page.$eval('.task-form',e=>e.requestSubmit());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));const pendingCount=writes;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).downloadNewTermDraft());check('actual pending create disables and guards captured form download',!!held&&await page.$eval('[name=downloadNewTermDraft]',e=>e.disabled)&&!existsSync(file)&&writes===pendingCount);await set('gTerm','Newer local term');hold=false;await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=glossaryCreating]'));const newer=await backup();check('confirmed add retains newer editable form for separate backup',newer.data.draft.term==='Newer local term'&&newer.data.createOutcomeUnconfirmed===false);
  drop=true;await page.$eval('.task-form',e=>e.requestSubmit());await page.waitForSelector('[name=glossaryCreateUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=glossaryCreating]'));const actual=await call(`${P}/glossary`,null,token);const unknown=await backup();check('committed then lost create remains unconfirmed in actual local file',actual.some(t=>t.term==='Newer local term')&&unknown.data.createOutcomeUnconfirmed===true&&await page.$eval('[name=glossaryCreateUnknown]',e=>e.textContent.includes('unconfirmed')));
  failRead=true;await page.$eval('[name=refreshGlossaryList]',e=>e.click());await page.waitForSelector('[name=retryGlossaryList]');const before={reads,writes};const failedRead=await backup();check('failed glossary read still permits independent form backup without extra API effects',failedRead.data.draft.term==='Newer local term'&&failedRead.data.createOutcomeUnconfirmed===true&&reads===before.reads&&writes===before.writes&&await page.$eval('[name=downloadGlossaryDraft]',e=>e.disabled));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/glossary-new-term-download-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/glossary-new-term-download-mobile.png',fullPage:true});check('390px independent backup and scope fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{window.savedURL=URL.createObjectURL;URL.createObjectURL=()=>{throw new Error('PRIVATE_DOWNLOAD');};});await page.$eval('[name=downloadNewTermDraft]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=newTermDownloadNotice]')?.textContent.includes('could not'));check('local download failure is bounded and does not expose exception',!(await page.content()).includes('PRIVATE_DOWNLOAD')&&!existsSync(file));await set('gNotes','edited');await set('gNotes',' raw notes ');await page.waitForFunction(()=>!document.querySelector('[name=newTermDownloadNotice]'));check('failed backup notice cannot revive after exact revert',reads===before.reads&&writes===before.writes);await page.evaluate(()=>URL.createObjectURL=window.savedURL);
  failRead=false;await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${next.id}/glossary`);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-glossary')).loading());const empty=await backup();check('reused project backup contains only current empty form without old uncertainty',empty.data.projectId===next.id&&empty.data.draft.term===''&&empty.data.createOutcomeUnconfirmed===false);
  await page.evaluate(()=>{window.oldGlossary=ng.getComponent(document.querySelector('ol-glossary'));history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-glossary'));await page.evaluate(()=>window.oldGlossary.downloadNewTermDraft());check('departed captured form download refuses',!existsSync(file));
  check('no new-term backup runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
