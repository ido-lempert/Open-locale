// Real local browser -> discard local project details -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_GENERAL_TEST_PG_PORT ?? 55970), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-general-discard-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('general_discard');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/general_discard`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=name]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,failRead=false,failWrite=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(path.startsWith('/api/')&&['POST','PATCH','PUT','DELETE'].includes(req.method())){writes++;if(req.method()==='PATCH'&&path===`/api${P}`){payloads.push(JSON.parse(req.postData()));if(failWrite)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const replace=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Project PATCH not held');};
  const done=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  const values=()=>page.evaluate(()=>[document.querySelector('[name=name]').value,document.querySelector('[name=description]').value]);
  check('unchanged project details discard disabled',await page.$eval('[name=discardSettingsGeneral]',e=>e.disabled));
  await replace('name','x'.repeat(121));await replace('description','x'.repeat(2001));await replace('newLocale','fr');check('invalid raw details draft discard enabled without requests',writes===0&&reads===0&&!await page.$eval('[name=discardSettingsGeneral]',e=>e.disabled));
  await click('discardSettingsGeneral');check('both project fields restored locally without requests or locale draft loss',JSON.stringify(await values())===JSON.stringify([project.name,project.description])&&writes===0&&reads===0&&await page.$eval('[name=newLocale]',e=>e.value==='fr')&&await page.$eval('[name=discardSettingsGeneral]',e=>e.disabled));if(failures)throw new Error('Local general reset absent');
  await replace('name',' Accepted name ');await replace('description',' Accepted details ');await click('saveSettingsGeneral');await poll();await replace('name',' Newer unsaved ');await replace('description',' Newer description ');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).discardGeneralDraft());check('pending Save blocks button and direct discard preserving full newer draft',await page.$eval('[name=discardSettingsGeneral]',e=>e.disabled)&&JSON.stringify(await values())===JSON.stringify([' Newer unsaved ',' Newer description '])&&writes===1);await held.continue();await done();
  const savedReads=reads,savedWrites=writes;await click('discardSettingsGeneral');let saved=await call(P,null,token);check('discard after success keeps accepted database details without GET write or receipt loss',saved.name===' Accepted name '&&saved.description===' Accepted details '&&JSON.stringify(await values())===JSON.stringify([saved.name,saved.description])&&reads===savedReads&&writes===savedWrites&&await page.$eval('[name=settingsGeneralDraftNotice]',e=>e.textContent.includes('were saved')&&e.textContent.includes('drafts were discarded')&&!e.textContent.includes('kept here'))&&await page.$eval('[name=newLocale]',e=>e.value==='fr'));
  failRead=true;held=null;await replace('name',' Accepted before503 ');await replace('description',' Accepted503 details ');await click('saveSettingsGeneral');await poll();await replace('name',' Later raw name ');await replace('description','');await held.continue();await done();const afterReads=reads,afterWrites=writes;await click('discardSettingsGeneral');saved=await call(P,null,token);check('503 discard uses accepted PATCH not stale loaded project and preserves error receipt',saved.name===' Accepted before503 '&&saved.description===' Accepted503 details '&&JSON.stringify(await values())===JSON.stringify([saved.name,saved.description])&&reads===afterReads&&writes===afterWrites&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed')&&await page.$eval('[name=settingsGeneralDraftNotice]',e=>e.textContent.includes('were saved')&&e.textContent.includes('drafts were discarded')&&!e.textContent.includes('kept here')));
  failRead=false;failWrite=true;await replace('name',' Refused name ');await replace('description',' Refused details ');await click('saveSettingsGeneral');await done();const refusedReads=reads,refusedWrites=writes;await click('discardSettingsGeneral');check('refused PATCH cannot replace accepted discard fallback no refresh or extra write',JSON.stringify(await values())===JSON.stringify([' Accepted before503 ',' Accepted503 details '])&&reads===refusedReads&&writes===refusedWrites&&!await page.$('[name=settingsGeneralDraftNotice]')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied'));
  await replace('name','Screenshot unsaved');await page.$eval('[name=discardSettingsGeneral]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-general-discard-desktop.png'});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/settings-general-discard-mobile.png'});check('390px general reset and help fit without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=discardSettingsGeneral]',e=>e.getBoundingClientRect().right<=innerWidth));
  check('no general discard runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
process.exit(!completed||failures?1:0);
