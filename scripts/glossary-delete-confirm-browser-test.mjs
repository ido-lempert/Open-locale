// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.GLOSSARY_BROWSER_TEST_PG_PORT ?? 56142), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-glossary-delete-browser-'));
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

  const alpha=await call(`${P}/glossary`,{term:'Alpha',translations:{he:'Original'}},token),beta=await call(`${P}/glossary`,{term:'Beta',translations:{he:'Other original'}},token);
  const next=await call('/projects',{name:'Other project',slug:'other-project',locales:['en','he']},token);
  await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Alpha in he"]');await page.type('[name=gTerm]','Local new-term draft');
  let deletes=0,patches=0,reads=0,deletePath='';page.on('request',req=>{const p=new URL(req.url()).pathname;if(req.method()==='DELETE'&&p.includes('/glossary/')){deletes++;deletePath=p;}if(req.method()==='PATCH'&&p.includes('/glossary/'))patches++;if(req.method()==='GET'&&p===`/api${P}/glossary`)reads++;});
  await page.click('[aria-label="Alpha in he"]');await page.type('[aria-label="Alpha in he"]',' local draft');
  const ask=async()=>{await page.click('[aria-label="Delete term Alpha"]');await page.waitForSelector('[name=confirmTermDelete]');};
  await ask();
  check('pointer delete opens exact loaded identity without delete read or blur save',deletes===0&&patches===0&&reads===0&&await page.$eval('[name=termDeleteProjectId]',e=>e.textContent)===project.id&&await page.$eval('[name=termDeleteId]',e=>e.textContent)===alpha.id&&await page.$eval('[name=termDeleteName]',e=>e.textContent)==='Alpha'&&await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')==='Alpha in he'));
  check('review warns about unsaved term text and limits loaded identity',await page.$eval('[aria-label="Confirm glossary term deletion"]',e=>e.textContent.includes('Any unsaved translation text for this term will be lost if deleted')&&e.textContent.includes('not a fresh permission check or newer server state')));
  await page.screenshot({path:'/downloads/glossary-delete-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/glossary-delete-confirm-mobile.png'});
  check('390px review wraps identity with both choices reachable',await page.evaluate(()=>{const e=document.querySelector('[aria-label="Confirm glossary term deletion"]'),r=e.getBoundingClientRect(),b=document.querySelector('[name=cancelTermDelete]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth&&b.bottom<=r.bottom;}));
  await page.click('[name=cancelTermDelete]');await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-glossary')).confirmRemove());
  check('pointer cancel keeps focused local translation and new-term draft without save delete or read',deletes===0&&patches===0&&reads===0&&await page.$eval('[aria-label="Alpha in he"]',e=>e.value==='Original local draft'&&document.activeElement===e)&&await page.$eval('[name=gTerm]',e=>e.value==='Local new-term draft')&&(await call(`${P}/glossary`,null,token)).find(t=>t.id===alpha.id).translations.he==='Original');
  await ask();await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.setTranslation(c.terms().find(t=>t.term==='Alpha'),'he','Changed after review');await c.confirmRemove();});
  check('later local translation edit invalidates confirmation without write',deletes===0&&patches===0&&!await page.$('[name=confirmTermDelete]')&&await page.$eval('[aria-label="Alpha in he"]',e=>e.value==='Changed after review'));
  await ask();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));window.capturedTermDelete=c.pendingTermDelete();});await page.$eval('[name=refreshGlossaryList]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=glossaryListLoading]')&&!document.querySelector('[name=confirmTermDelete]'));
  await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.pendingTermDelete.set(window.capturedTermDelete);await c.confirmRemove();});check('new real list rejects restored captured confirmation without delete or save',deletes===0&&patches===0&&reads===1&&!await page.$('[name=confirmTermDelete]'));
  await ask();const route=async id=>page.evaluate(id=>{history.pushState({},'',`/projects/${id}/glossary`);dispatchEvent(new PopStateEvent('popstate'));},id);await route(next.id);await page.waitForSelector('[name=glossaryListEmpty]');await route(project.id);await page.waitForSelector('[aria-label="Delete term Alpha"]');
  await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.pendingTermDelete.set(window.capturedTermDelete);await c.confirmRemove();});check('repeated project visit rejects old capture without deletion',deletes===0&&!await page.$('[name=confirmTermDelete]'));
  await ask();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary')),p=c.pendingTermDelete();c.pendingTermDelete.set({...p,projectId:'<img onerror=fail>-'+'P'.repeat(140),id:'<img onerror=fail>-'+'I'.repeat(140),term:'<img onerror=fail>-'+'T'.repeat(140)});});await page.screenshot({path:'/downloads/glossary-delete-confirm-long-mobile.png'});
  check('long markup-like identifiers stay escaped and wrap within modal',await page.$eval('[aria-label="Confirm glossary term deletion"]',e=>!e.querySelector('img')&&e.textContent.includes('<img onerror=fail>')&&e.scrollWidth<=e.clientWidth));await page.$eval('[aria-label="Confirm glossary term deletion"]',e=>e.scrollTop=e.scrollHeight);await page.click('[name=cancelTermDelete]');check('artificial long fixture canceled without deletion',deletes===0);
  await page.setViewport({width:1280,height:900});await page.type('[name=gTerm]','Current new-term draft');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.setTranslation(c.terms().find(t=>t.term==='Beta'),'he','Other local draft');});await page.click('[aria-label="Alpha in he"]');await page.type('[aria-label="Alpha in he"]',' local before delete');await ask();await page.click('[name=confirmTermDelete]');await page.waitForFunction(()=>!document.querySelector('[aria-label="Delete term Alpha"]')&&!document.querySelector('[name=glossaryDeleting]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-glossary')).confirmRemove());const remaining=await call(`${P}/glossary`,null,token);
  check('explicit confirm deletes exact term once without saving discarded local text',deletes===1&&deletePath===`/api${P}/glossary/${alpha.id}`&&patches===0&&!remaining.some(t=>t.id===alpha.id)&&remaining.find(t=>t.id===beta.id).translations.he==='Other original');
  check('unrelated local translation and new-term form remain without completion reload',reads===2&&await page.$eval('[aria-label="Beta in he"]',e=>e.value==='Other local draft')&&await page.$eval('[name=gTerm]',e=>e.value==='Current new-term draft'));
  await page.screenshot({path:'/downloads/glossary-delete-confirm-result.png'});check('no glossary confirmation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
process.exit(!completed||failures?1:0);
