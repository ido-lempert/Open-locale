// Real local browser -> settings pending status draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55955, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-status-create-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('status_create_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/status_create_browser`;
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


  await call(P,{customStatuses:['EXISTING']},token,'PATCH');
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=newStatus]');await page.waitForNetworkIdle({idleTime:200});
  let adds=0,reads=0,held,failAdd=false,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='PATCH'&&path===`/api${P}`){adds++;payloads.push(JSON.parse(req.postData()));if(failAdd)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async value=>page.$eval('[name=newStatus]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Status create request not held');};
  await replace(' fr ');await page.$eval('[name=addSettingsStatus]',e=>e.form.requestSubmit());await poll();await replace(' <b>de</b> ');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addStatus());check('pending duplicate blocked with exact submitted trimmed uppercase status and loaded array',adds===1&&JSON.stringify(payloads[0].customStatuses)==='["EXISTING","FR"]');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('successful old PATCH keeps literal invalid newer draft and explicit unsaved receipt',await page.$eval('[name=newStatus]',e=>e.value===' <b>de</b> '&&!e.parentElement.querySelector('b'))&&await page.$eval('[name=settingsStatusDraftNotice]',e=>e.textContent.includes('submitted custom status was saved')&&e.textContent.includes('has not been saved'))&&await page.$('[name=settingsStatusInvalid]'));if(failures)throw new Error('Status draft preservation absent or mismatched');
  let state=await call(P,null,token);check('only submitted custom status persists and settings refreshes',JSON.stringify(state.customStatuses)==='["EXISTING","FR"]'&&reads>0);
  const beforeInvalid=reads;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addStatus());check('invalid newer draft keeps receipt and cannot send',adds===1&&reads===beforeInvalid&&!!await page.$('[name=settingsStatusDraftNotice]')&&await page.$eval('[name=addSettingsStatus]',e=>e.disabled));
  await page.$eval('[name=newStatus]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-status-pending-draft-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=newStatus]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-status-pending-draft-mobile.png'});check('390px newer draft receipt and validation fit without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsStatusDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  await replace(' de ');held=null;await page.$eval('[name=addSettingsStatus]',e=>e.form.requestSubmit());await poll();check('corrected newer draft sent only on second explicit Add and receipt clears',adds===2&&JSON.stringify(payloads[1].customStatuses)==='["EXISTING","FR","DE"]'&&!await page.$('[name=settingsStatusDraftNotice]'));await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());state=await call(P,null,token);check('unchanged success clears draft and both explicit custom statuses persist',await page.$eval('[name=newStatus]',e=>e.value==='')&&!await page.$('[name=settingsStatusDraftNotice]')&&JSON.stringify(state.customStatuses)==='["EXISTING","FR","DE"]');
  const before=reads;failAdd=true;await replace('it');await page.$eval('[name=addSettingsStatus]',e=>e.form.requestSubmit());await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('PATCH refusal keeps draft with no saved claim or reload',await page.$eval('[name=newStatus]',e=>e.value==='it')&&!await page.$('[name=settingsStatusDraftNotice]')&&reads===before);
  failAdd=false;failRead=true;held=null;await replace(' es ');await page.$eval('[name=addSettingsStatus]',e=>e.form.requestSubmit());await poll();await replace(' next_status ');await held.continue();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed'&&!ng.getComponent(document.querySelector('ol-settings')).busy());check('reload failure after successful PATCH keeps newer draft and accurate receipt',await page.$eval('[name=newStatus]',e=>e.value===' next_status ')&&await page.$eval('[name=settingsStatusDraftNotice]',e=>e.textContent.includes('submitted custom status was saved')&&e.textContent.includes('has not been saved')));state=await call(P,null,token);check('reload failure does not undo submitted custom status or add newer draft',JSON.stringify(state.customStatuses)==='["EXISTING","FR","DE","ES"]');
  check('no pending status draft runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??String(e)}`);process.exitCode=1;}
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
