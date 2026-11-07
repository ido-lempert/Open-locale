// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55704, WEB_PORT = 4200, API_PORT = 3000;
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

  const term=await call(`${P}/glossary`,{term:'Alpha',translations:{he:'Original'}},token);await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Alpha in he"]');
  let posts=0,reads=0,patches=0,failRead=true,drop=true,committed=false;await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path===`/api${P}/glossary`&&req.method()==='POST'){posts++;if(drop){const r=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('forwarded glossary create failed');await r.json();committed=true;return req.abort('failed');}}if(path.startsWith(`/api${P}/glossary/`)&&req.method()==='PATCH')patches++;if(path===`/api${P}/glossary`&&req.method()==='GET'){reads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}req.continue();});
  await page.type('[name=gTerm]','Created despite lost response');await page.type('[name=gNotes]','Keep context');await page.click('[name=gDnt]');await page.click('.task-form button[type=submit]');await page.waitForSelector('[name=glossaryCreateUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=glossaryCreating]')&&document.querySelector('.task-form button[type=submit]')?.disabled);
  const saved=(await call(`${P}/glossary`,null,token)).filter(t=>t.term==='Created despite lost response');check('genuine glossary creation committed before dropped response, whole form retained without automatic read',committed&&saved.length===1&&saved[0].doNotTranslate===true&&saved[0].notes==='Keep context'&&posts===1&&reads===0&&await page.$eval('[name=gTerm]',e=>e.value==='Created despite lost response')&&await page.$eval('[name=gNotes]',e=>e.value==='Keep context')&&await page.$eval('[name=gDnt]',e=>e.checked));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).create());await page.$eval('.task-form',e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check('captured and DOM create cannot replay while unconfirmed',posts===1&&reads===0&&!await page.$('[name=glossaryCreateNotice]'));
  await page.$eval('[aria-label="Alpha in he"]',e=>{e.value='Independent saved translation';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('blur'));});await page.waitForFunction(()=>!document.querySelector('[name=glossarySaving]'));for(let n=0;n<100&&patches===0;n++)await new Promise(r=>setTimeout(r,20));const current=await call(`${P}/glossary`,null,token);check('existing-row translation save remains independent of new-term pause',patches===1&&current.find(t=>t.id===term.id).translations.he==='Independent saved translation'&&!!await page.$('[name=glossaryCreateUnknown]')&&await page.$eval('.task-form button[type=submit]',e=>e.disabled));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).error.set('Independent row error'));await page.waitForFunction(()=>[...document.querySelectorAll('[role=alert]')].some(e=>e.textContent==='Independent row error'));check('independent row error is visible alongside unknown creation',!!await page.$('[name=glossaryCreateUnknown]'));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).error.set('Adding term failed. Check the glossary before trying again.'));
  await page.screenshot({path:'/downloads/glossary-create-unknown-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/glossary-create-unknown-mobile.png',fullPage:true});check('copy-before-refresh guidance explicit without raw detail',await page.$eval('[name=glossaryCreateUnknown]',e=>e.textContent.includes('Copy local translation drafts'))&&!(await page.content()).includes('PRIVATE'));
  await page.click('[name=refreshGlossaryList]');await page.waitForSelector('[name=retryGlossaryList]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).create());check('failed explicit glossary read keeps create pause without replay',posts===1&&reads===1&&!!await page.$('[name=glossaryCreateUnknown]')&&await page.$eval('.task-form button[type=submit]',e=>e.disabled));
  failRead=false;await page.click('[name=retryGlossaryList]');await page.waitForFunction(()=>!document.querySelector('[name=glossaryListLoading]')&&!document.querySelector('[name=glossaryCreateUnknown]')&&[...document.querySelectorAll('.glossary-table code')].some(e=>e.textContent==='Created despite lost response'));check('successful current glossary read discovers committed term and unlocks with whole new-term form retained',posts===1&&reads===2&&await page.$eval('[name=gTerm]',e=>e.value==='Created despite lost response')&&await page.$eval('[name=gNotes]',e=>e.value==='Keep context')&&await page.$eval('[name=gDnt]',e=>e.checked)&&!await page.$eval('.task-form button[type=submit]',e=>e.disabled)&&!await page.$('[role=alert]'));
  await page.$eval('[name=gTerm]',e=>{e.value='Explicit next term';e.dispatchEvent(new Event('input',{bubbles:true}));});drop=false;await page.click('.task-form button[type=submit]');await page.waitForFunction(()=>document.querySelector('[name=glossaryCreateNotice]')?.textContent.includes('Explicit next term')&&!document.querySelector('[name=glossaryCreating]'));const final=await call(`${P}/glossary`,null,token);check('explicit next different term creates once without replacing current glossary',posts===2&&reads===2&&final.filter(t=>t.term==='Created despite lost response').length===1&&final.filter(t=>t.term==='Explicit next term').length===1&&!await page.$('[name=glossaryCreateUnknown]'));
  check('no glossary unknown recovery runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
