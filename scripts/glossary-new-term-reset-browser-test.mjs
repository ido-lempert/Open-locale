// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55742, WEB_PORT = 4200, API_PORT = 3000;
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
  await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Existing in he"]');
  let reads=0,writes=0,held,hold=false,failRead=false;await page.setRequestInterception(true);page.on('request',async req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.endsWith('/glossary')){if(req.method()==='POST'&&hold){held=req;return;}if(req.method()==='GET'&&failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ'})});}}req.continue();});
  const form=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));return [c.term(),c.notes(),c.doNotTranslate()];});
  const ask=async()=>{await page.waitForFunction(()=>!document.querySelector('[name=resetNewTermDraft]')?.disabled);await page.click('[name=resetNewTermDraft]');await page.waitForSelector('[name=confirmNewTermReset]');};
  const confirm=async()=>{await page.click('[name=confirmNewTermReset]');await page.waitForSelector('[name=newTermResetNotice]');};
  await page.type('[name=gTerm]',' Raw term ');await page.type('[name=gNotes]','Private local context');await page.click('[name=gDnt]');const original=await form();await page.type('[aria-label="Existing in he"]',' local unsaved');await ask();check('focused row pointer reset prompt keeps form and avoids blur autosave',JSON.stringify(await form())===JSON.stringify(original)&&reads===0&&writes===0&&await page.$eval('[aria-label="Existing in he"]',e=>e===document.activeElement));await page.click('[name=keepNewTermDraft]');await page.waitForFunction(()=>!document.querySelector('[name=newTermResetConfirm]'));check('focused Keep preserves raw form and translation without API effects',JSON.stringify(await form())===JSON.stringify(original)&&writes===0&&reads===0&&await page.$eval('[aria-label="Existing in he"]',e=>e.value==='Saved local unsaved'&&e===document.activeElement));await ask();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.notes.set('newer exact notes');});await page.waitForFunction(()=>!document.querySelector('[name=newTermResetConfirm]'));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).confirmNewTermReset());check('stale confirmation refuses newer form while focused row remains local',(await form())[1]==='newer exact notes'&&writes===0&&reads===0);
  await ask();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/glossary-new-term-reset-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/glossary-new-term-reset-mobile.png',fullPage:true});check('390px inline new-term reset fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await confirm();await new Promise(r=>setTimeout(r,150));check('focused confirmed reset clears only new-term form without autosave or row loss',JSON.stringify(await form())===JSON.stringify(['','',false])&&writes===0&&reads===0&&await page.$eval('[aria-label="Existing in he"]',e=>e.value==='Saved local unsaved'&&e===document.activeElement));
  // Remove only the fixture-local row edit without blur before testing creation.
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));const t=c.terms().find(t=>t.term==='Existing');c.setTranslation(t,'he','Saved');});await page.type('[name=gTerm]','Committed unseen reset');hold=true;await page.$eval('.task-form',e=>e.requestSubmit());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>document.querySelector('[name=resetNewTermDraft]')?.disabled);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.askNewTermReset();c.confirmNewTermReset();});check('actual held creation refuses local discard',writes===1&&(await form())[0]==='Committed unseen reset');hold=false;const response=await fetch(held.url(),{method:'POST',headers:held.headers(),body:held.postData()});if(!response.ok)throw new Error('fixture commit failed');await response.json();await held.abort('failed');held=null;await page.waitForSelector('[name=glossaryCreateUnknown]');await ask();await confirm();check('real committed then lost creation stays unknown after local discard without replay/read',writes===1&&reads===0&&JSON.stringify(await form())===JSON.stringify(['','',false])&&!!await page.$('[name=glossaryCreateUnknown]')&&await page.$eval('.task-form button[type=submit]',e=>e.disabled)&&(await call(`${P}/glossary`,null,token)).filter(t=>t.term==='Committed unseen reset').length===1);
  failRead=true;await page.click('[name=refreshGlossaryList]');await page.waitForSelector('[name=glossaryListError]');await page.type('[name=gNotes]','Only local notes');await ask();await confirm();check('failed read permits form discard without clearing creation uncertainty',writes===1&&reads===1&&!!await page.$('[name=glossaryCreateUnknown]')&&(await form())[1]==='');failRead=false;await page.click('[name=retryGlossaryList]');await page.waitForFunction(()=>!document.querySelector('[name=glossaryListLoading]')&&!document.querySelector('[name=glossaryCreateUnknown]'));check('explicit current recovery alone resolves creation uncertainty',writes===1&&reads===2);
  await page.type('[name=gTerm]','Old project');await ask();await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${next.id}/glossary`);await page.waitForFunction(()=>document.querySelector('[name=gTerm]')?.value===''&&!ng.getComponent(document.querySelector('ol-glossary')).loading());await page.type('[name=gTerm]','New project');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).confirmNewTermReset());check('reused project cannot apply old confirmation',(await form())[0]==='New project'&&!await page.$('[name=newTermResetNotice]'));await ask();await page.evaluate(()=>{window.oldGlossary=ng.getComponent(document.querySelector('ol-glossary'));history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-glossary'));check('departed captured confirmation cannot discard',await page.evaluate(()=>{window.oldGlossary.confirmNewTermReset();return window.oldGlossary.term()==='New project'&&!window.oldGlossary.newTermResetPending();}));check('no new-term reset runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
