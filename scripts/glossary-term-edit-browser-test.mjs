// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56154, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-glossary-term-edit-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('glossary_term_edit_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/glossary_term_edit_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'glossary-edit-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'glossary-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Glossary edit',slug:'glossary-edit',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  const term=await call(`${P}/glossary`,{term:'Loaded term',notes:'Stored notes'},token),other=await call(`${P}/glossary`,{term:'Other term'},token);
  await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Edit details for Loaded term"]');await page.type('[name=gTerm]','UNSENT NEW TERM');
  let writes=0,reads=0,posts=0;const sent=[];
  page.on('request',req=>{const p=new URL(req.url()).pathname;if(req.method()==='PATCH'&&p.includes('/glossary/')){writes++;sent.push({path:p,body:JSON.parse(req.postData())});}if(req.method()==='GET'&&p===`/api${P}/glossary`)reads++;if(req.method()==='POST'&&p===`/api${P}/glossary`)posts++;});
  const click=async selector=>{const button=await page.$(selector);if(!button)throw new Error('Missing button '+selector);await button.evaluate(e=>e.scrollIntoView({block:'center'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await button.click();};
  const fill=async(selector,value)=>{await page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  const open=async label=>{await click(`[aria-label="Edit details for ${label}"]`);await page.waitForSelector('[name=editGlossaryTerm]');await page.waitForFunction(()=>document.activeElement?.getAttribute('name')==='editGlossaryTerm');};
  await page.focus('[aria-label="Loaded term in he"]');await fill('[aria-label="Loaded term in he"]','UNSAVED TRANSLATION');
  await open('Loaded term');
  check('pointer opening preserves focused translation without blur save',writes===0&&await page.$eval('[aria-label="Loaded term in he"]',e=>e.value==='UNSAVED TRANSLATION'));
  check('open loads exact term notes and project term identity without request',writes===0&&reads===0&&await page.$eval('[name=editGlossaryTerm]',e=>e.value==='Loaded term')&&await page.$eval('[name=editGlossaryNotes]',e=>e.value==='Stored notes')&&await page.$eval('[name=termEditScope]',(e,ids)=>ids.every(id=>e.textContent.includes(id)),[project.id,term.id]));
  check('scope labels local not autosaved text and unrelated fields',await page.$eval('[name=termEditScope]',e=>e.textContent.includes('not translations or the do-not-translate flag')&&e.textContent.includes('not saved automatically'))&&await page.$eval('[name=saveGlossaryTermEdit]',e=>e.disabled));
  await fill('[name=editGlossaryTerm]','x'.repeat(201));await fill('[name=editGlossaryNotes]','Private local notes');await page.waitForSelector('[name=termEditInvalid]');await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-glossary')).saveTermEdit());
  check('invalid text retained and direct save does not write',writes===0&&await page.$eval('[name=editGlossaryTerm]',e=>e.value.length===201)&&await page.$eval('[name=saveGlossaryTermEdit]',e=>e.disabled));
  await fill('[name=editGlossaryTerm]','  Edited term  ');await fill('[name=editGlossaryNotes]','  Edited <markup> notes  ');await page.$eval('[name=editGlossaryTerm]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/glossary-term-edit-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[aria-label="Edit loaded glossary term"]',e=>e.scrollIntoView({block:'start'}));await page.evaluate(()=>window.scrollBy(0,-110));await page.screenshot({path:'/downloads/glossary-term-edit-mobile.png'});await page.$eval('[name=saveGlossaryTermEdit]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/glossary-term-edit-mobile-bottom.png'});
  check('390px local editor inputs fit their panel width',await page.$eval('[aria-label="Edit loaded glossary term"]',e=>e.scrollWidth<=e.clientWidth&&[...e.querySelectorAll('input,textarea')].every(x=>x.getBoundingClientRect().right<=innerWidth)));
  await click('[name=cancelGlossaryTermEdit]');await page.waitForFunction(()=>!document.querySelector('[name=editGlossaryTerm]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-glossary')).saveTermEdit());
  check('close discards only edit text without requests and keeps new-term draft',writes===0&&reads===0&&!await page.$('[name=editGlossaryTerm]')&&await page.$eval('[name=gTerm]',e=>e.value==='UNSENT NEW TERM'));
  await page.setViewport({width:1280,height:900});await open('Loaded term');await fill('[name=editGlossaryTerm]','Stale retained term');await click('[name=refreshGlossaryList]');await page.waitForSelector('[name=termEditStale]');await page.waitForFunction(()=>!document.querySelector('[name=glossaryListLoading]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-glossary')).saveTermEdit());
  check('real list refresh retains edit text but rejects stale save',writes===0&&reads===1&&await page.$eval('[name=editGlossaryTerm]',e=>e.value==='Stale retained term')&&await page.$eval('[name=saveGlossaryTermEdit]',e=>e.disabled));
  await click('[name=cancelGlossaryTermEdit]');await open('Loaded term');await fill('[name=editGlossaryTerm]',' Edited term ');await fill('[name=editGlossaryNotes]',' Edited <markup> notes ');
  let mode='hold',held;await page.setRequestInterception(true);page.on('request',req=>{const p=new URL(req.url()).pathname;if(req.method()==='PATCH'&&p===`/api${P}/glossary/${term.id}`){if(mode==='hold'){held=req;return;}if(mode==='fail')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_FAILURE'})});}return req.continue();});
  await click('[name=saveGlossaryTermEdit]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Save not held');await page.waitForSelector('[name=termEditSaving]');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.closeTermEdit();await c.saveTermEdit();});
  check('pending real PATCH blocks duplicate save close and text changes',writes===1&&await page.$eval('[name=editGlossaryTerm]',e=>e.disabled)&&await page.$eval('[name=cancelGlossaryTermEdit]',e=>e.disabled)&&await page.$eval('[name=saveGlossaryTermEdit]',e=>e.disabled)&&!await page.$('[name=termEditStale]'));
  mode='live';await held.continue();held=null;await page.waitForSelector('[aria-label="Edit details for Edited term"]');await page.waitForFunction(()=>!document.querySelector('[name=editGlossaryTerm]'));
  let stored=(await call(`${P}/glossary`,null,token)).find(t=>t.id===term.id);
  check('explicit save persists only exact trimmed term notes through real API',writes===1&&sent[0].path===`/api${P}/glossary/${term.id}`&&JSON.stringify(sent[0].body)===JSON.stringify({term:'Edited term',notes:'Edited <markup> notes'})&&stored.term==='Edited term'&&stored.notes==='Edited <markup> notes'&&stored.doNotTranslate===term.doNotTranslate&&JSON.stringify(stored.translations)===JSON.stringify(term.translations));
  check('confirmed save keeps unrelated term and local new-term form',posts===0&&(await call(`${P}/glossary`,null,token)).some(t=>t.id===other.id)&&await page.$eval('[name=gTerm]',e=>e.value==='UNSENT NEW TERM')&&await page.$eval('[name=glossaryCreateNotice]',e=>e.textContent.includes('details were updated')));
  await open('Edited term');await fill('[name=editGlossaryNotes]','');await click('[name=saveGlossaryTermEdit]');await page.waitForFunction(()=>!document.querySelector('[name=editGlossaryTerm]'));stored=(await call(`${P}/glossary`,null,token)).find(t=>t.id===term.id);
  check('empty notes explicitly clears server notes without changing term',writes===2&&stored.term==='Edited term'&&stored.notes==='');
  await open('Edited term');await fill('[name=editGlossaryTerm]','Failed retained term');mode='fail';await click('[name=saveGlossaryTermEdit]');await page.waitForSelector('[name=glossarySaveUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=termEditSaving]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-glossary')).saveTermEdit());
  check('real failed PATCH keeps edit text pauses retry and hides private error',writes===3&&await page.$eval('[name=editGlossaryTerm]',e=>e.value==='Failed retained term')&&await page.$eval('[name=saveGlossaryTermEdit]',e=>e.disabled)&&!(await page.content()).includes('PRIVATE_FAILURE'));
  mode='live';await click('[name=refreshGlossaryList]');await page.waitForFunction(()=>!document.querySelector('[name=glossarySaveUnknown]')&&!document.querySelector('[name=glossaryListLoading]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-glossary')).saveTermEdit());
  check('explicit refresh reads server but does not replay stale edit',writes===3&&await page.$('[name=termEditStale]')&&await page.$eval('[name=editGlossaryTerm]',e=>e.value==='Failed retained term')&&(await call(`${P}/glossary`,null,token)).find(t=>t.id===term.id).term==='Edited term');
  await click('[name=cancelGlossaryTermEdit]');await page.$eval('[name=refreshGlossaryList]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/glossary-term-edit-result.png'});await page.$eval('[aria-label="Edit details for Edited term"]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/glossary-term-edit-result-row.png'});
  check('no glossary term edit runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(failures?1:0);
