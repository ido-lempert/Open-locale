// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55863, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma, debugPage;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-search-departure-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('draft_save_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/draft_save_browser`;
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
  const diagnostics=[];const page=debugPage=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);



  await call(`${P}/branches`,{name:'release'},token);const key=await call(`${P}/keys`,{name:'alpha',branch:'release'},token);await call(`${P}/keys/${key.id}/translations`,{locale:'en',value:'Original'},token,'PUT');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.select('[name=branch]','release');await page.waitForSelector('[aria-label="alpha in en"]');await page.waitForFunction(()=>!document.querySelector('[name=findSavedText]').disabled);
  const input='[aria-label="alpha in en"]',button='[name=findSavedText]';let held=null,hold=true,fail=false,writes=0,searchReads=0;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.endsWith('/keys')&&u.searchParams.has('valueSearch'))searchReads++;if(req.method()==='PUT'&&u.pathname.endsWith('/translations')){writes++;if(fail)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE_SAVE_ERROR"}'});if(hold){held=req;return;}}req.continue();});
  const edit=async value=>{await page.$eval(input,e=>e.focus());await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type(value);};const waitHeld=async()=>{for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw Error('save not held');};
  await edit('Local draft');await page.waitForSelector('[name=savedSearchDepartureBlocked]');check('actual dirty translation disables departure before save',await page.$eval(button,e=>e.disabled)&&page.url()===WEB+P&&writes===0);
  await page.$eval(button,e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));check('forced stale disabled action cannot navigate or save',page.url()===WEB+P&&writes===0&&await page.$eval(input,e=>e.value==='Local draft'));
  await page.keyboard.press('Tab');await waitHeld();await page.waitForFunction(()=>document.querySelector('[name=findSavedText]').disabled);await page.click(button);check('actual held blur save keeps editor and retained text',page.url()===WEB+P&&writes===1&&await page.$eval(input,e=>e.value==='Local draft'));
  await page.setViewport({width:1280,height:900});await page.$eval(button,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-search-departure-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(button,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-search-departure-mobile.png'});check('390px blocked guidance fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await edit('Newer local draft');const first=held;held=null;await first.continue();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('.cell-status')).some(e=>e.textContent.includes('saving')));await page.waitForNetworkIdle({idleTime:100});check('confirmed older save does not unlock newer local draft',await page.$eval(button,e=>e.disabled)&&await page.$eval(input,e=>e.value==='Newer local draft')&&writes===1);
  hold=false;await page.keyboard.press('Tab');await page.waitForFunction(()=>!document.querySelector('[name=findSavedText]').disabled);const persisted=(await call(`${P}/keys?branch=release`,null,token)).find(k=>k.id===key.id).translations.find(t=>t.localeCode==='en');check('normal blur save confirmation unlocks only clean persisted text',writes===2&&persisted.value==='Newer local draft');
  fail=true;await edit('Unconfirmed draft');await page.keyboard.press('Tab');await page.waitForSelector('[name=saveCellDraft]');await page.waitForNetworkIdle({idleTime:100});check('unknown save outcome keeps departure blocked without replay',writes===3&&await page.$eval(button,e=>e.disabled)&&page.url()===WEB+P&&await page.$eval(input,e=>e.value==='Unconfirmed draft'));await page.$eval(button,e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));check('unconfirmed equal or dirty state never auto-retries on departure',writes===3&&page.url()===WEB+P&&!await page.$('ol-saved-search'));
  // Explicit user page reload, not action-driven recovery. It discards the local
  // unconfirmed draft only in this fixture after the retention check above.
  fail=false;await page.reload({waitUntil:'networkidle0'});await page.select('[name=branch]','release');await page.waitForSelector(input);await page.waitForFunction(()=>!document.querySelector('[name=findSavedText]').disabled);await page.$eval(button,e=>e.focus());await page.keyboard.press('Enter');await page.waitForSelector('[name=savedSearchIdle]');check('clean keyboard activation preserves release branch and adds no save/search read',new URL(page.url()).searchParams.get('branch')==='release'&&await page.$eval('[name=savedSearchBranch]',e=>e.value==='release')&&writes===3&&searchReads===0);check('no departure guard runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;

} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);if(debugPage){console.log('DEBUG_URL',debugPage.url());console.log('DEBUG_BODY',await debugPage.$eval('body',e=>e.innerText).catch(()=>''));await debugPage.screenshot({path:'/downloads/editor-search-departure-failure.png'}).catch(()=>{});}process.exitCode=1;}
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
