// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55732, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
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

  await call(`${P}/glossary`,{term:'Existing',translations:{he:'Saved'}},token);const next=await call('/projects',{name:'Next',slug:'next-term-draft',locales:['en','he']},token);
  await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Existing in he"]');check('loaded glossary without new-term input has no form-draft warning',!await page.$('[name=glossaryNewTermDraft]'));
  let reads=0,writes=0,held,hold=false,drop=false,failRead=false;await page.setRequestInterception(true);page.on('request',async req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.endsWith('/glossary')){if(req.method()==='POST'){if(hold){held=req;return;}if(drop){const r=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('create failed');await r.json();return req.abort('failed');}}if(req.method()==='GET'&&failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ'})});}}req.continue();});
  await page.type('[name=gTerm]','Local term');await page.type('[name=gNotes]','Private local context');await page.click('[name=gDnt]');await page.waitForSelector('[name=glossaryNewTermDraft]');check('local term feedback names no persistence and conditional backup without API effects',reads===0&&writes===0&&await page.$eval('[name=glossaryNewTermDraft]',e=>e.textContent.includes('not automatically saved or restored')&&e.textContent.includes('when available')));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/glossary-new-term-draft-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/glossary-new-term-draft-mobile.png',fullPage:true});check('390px local form feedback fits document',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  hold=true;await page.$eval('.task-form',e=>e.requestSubmit());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>document.querySelector('[name=glossaryNewTermDraft]')?.textContent.includes('pending'));check('actual held add names current editable form versus submitted term',writes===1&&reads===0&&await page.$eval('[name=glossaryNewTermDraft]',e=>e.textContent.includes('may differ from the submitted term')&&e.textContent.includes('Do not add again')));await page.$eval('[name=gTerm]',e=>{e.value='Newer local term';e.dispatchEvent(new Event('input',{bubbles:true}));});hold=false;await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=glossaryCreating]')&&document.querySelector('[name=glossaryCreateNotice]')?.textContent.includes('Local term'));check('confirmed add keeps newer draft with normal local scope without list reread',reads===0&&writes===1&&await page.$eval('[name=gTerm]',e=>e.value==='Newer local term')&&await page.$eval('[name=glossaryNewTermDraft]',e=>e.textContent.includes('not automatically saved')));
  drop=true;await page.$eval('.task-form',e=>e.requestSubmit());await page.waitForSelector('[name=glossaryCreateUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=glossaryCreating]'));const actual=await call(`${P}/glossary`,null,token);check('real committed then lost response stays explicitly uncertain, not unsaved server data',actual.some(t=>t.term==='Newer local term')&&writes===2&&reads===0&&await page.$eval('[name=glossaryNewTermDraft]',e=>e.textContent.includes('adding the term is unconfirmed')&&!e.textContent.includes('not automatically saved')));
  failRead=true;await page.$eval('[name=refreshGlossaryList]',e=>e.click());await page.waitForSelector('[name=retryGlossaryList]');check('failed read retains uncertain local form guidance without claiming backup available',writes===2&&await page.$eval('[name=glossaryNewTermDraft]',e=>e.textContent.includes('Copy the form before leaving'))&&await page.$eval('[name=downloadGlossaryDraft]',e=>e.disabled)&&!(await page.content()).includes('PRIVATE_READ'));
  failRead=false;await page.$eval('[name=retryGlossaryList]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=glossaryCreateUnknown]')&&!document.querySelector('[name=glossaryListLoading]'));check('explicit current recovery restores normal local-only scope without clearing form',writes===2&&await page.$eval('[name=gTerm]',e=>e.value==='Newer local term')&&await page.$eval('[name=glossaryNewTermDraft]',e=>e.textContent.includes('not automatically saved')));
  drop=false;await page.$eval('[name=gTerm]',e=>{e.value='Confirmed next';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.$eval('.task-form',e=>e.requestSubmit());await page.waitForFunction(()=>!document.querySelector('[name=glossaryCreating]')&&document.querySelector('[name=glossaryCreateNotice]')?.textContent.includes('Confirmed next'));check('confirmed unchanged form clears draft feedback but preserves receipt',writes===3&&!await page.$('[name=glossaryNewTermDraft]')&&await page.$eval('[name=gTerm]',e=>e.value===''));
  await page.click('[name=gDnt]');await page.waitForSelector('[name=glossaryNewTermDraft]');check('choice-only new-term form counts as local draft',await page.$eval('[name=gTerm]',e=>e.value===''));await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${next.id}/glossary`);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-glossary')).loading());check('reused project clears old local form feedback without mutation',writes===3&&!await page.$('[name=glossaryNewTermDraft]')&&await page.$eval('[name=gDnt]',e=>!e.checked));check('no new-term feedback runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
