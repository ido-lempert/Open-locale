// Real local browser -> settings pending member draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_MT_TEST_PG_PORT ?? 55978), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mt-name-discard-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('mt_name_discard_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/mt_name_discard_browser`;
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


  // Offline pseudo provider fixtures only. No pretranslation run or external calls.
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=newMtName]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,runs=0,held,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path===`/api${P}/mt/pretranslate`&&req.method()==='POST')runs++;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/mt/providers`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(path.startsWith('/api/')&&['POST','PATCH','PUT','DELETE'].includes(req.method())){writes++;if(req.method()==='POST'&&path===`/api${P}/mt/providers`){held=req;return;}}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const replace=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Token POST not held');};
  const done=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  check('empty name discard disabled',await page.$eval('[name=discardSettingsMtName]',e=>e.disabled));
  await replace('newMtName','x'.repeat(121));await replace('name','Other project draft');await click('discardSettingsMtName');check('invalid overlong name cleared locally while type and other form stay',writes===0&&reads===0&&await page.$eval('[name=newMtName]',e=>e.value==='')&&await page.$eval('[name=name]',e=>e.value==='Other project draft')&&await page.$eval('[name=newMtType]',e=>e.value==='pseudo'));if(failures)throw new Error('Name discard absent');
  await replace('newMtName','First');await click('addSettingsMtProvider');await poll();await replace('newMtName','Next');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).discardMtNameDraft());check('pending create blocks button and direct discard preserving newer name',writes===1&&await page.$eval('[name=discardSettingsMtName]',e=>e.disabled)&&await page.$eval('[name=newMtName]',e=>e.value==='Next'));await held.continue();await done();
  const beforeReads=reads,beforeWrites=writes;await click('discardSettingsMtName');let providers=await call(P+'/mt/providers',null,token);const selected=providers[0].id;check('discard keeps actual provider and pretranslation choices without requests or stale retained claim',providers.length===1&&providers[0].name==='First'&&providers[0].type==='pseudo'&&reads===beforeReads&&writes===beforeWrites&&await page.$eval('[name=newMtName]',e=>e.value==='')&&await page.$eval('[name=settingsMtDraftNotice]',e=>e.textContent.includes('name draft was discarded')&&!e.textContent.includes('kept here'))&&await page.$eval('[name=mtProviderId]',e=>e.value)===selected);
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.mtResult.set('Earlier local result');c.mtBranch.set('main');c.mtLocale.set('he');});
  held=null;failRead=true;await replace('newMtName','Saved');await click('addSettingsMtProvider');await poll();await replace('newMtName','Unsent');await held.continue();await done();const failedReads=reads,failedWrites=writes;await click('discardSettingsMtName');providers=await call(P+'/mt/providers',null,token);check('503 reset preserves accepted provider error choices and result without requests',providers.length===2&&providers.some(p=>p.name==='Saved')&&!providers.some(p=>p.name==='Unsent')&&reads===failedReads&&writes===failedWrites&&await page.$eval('[name=newMtName]',e=>e.value==='')&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.error()==='Refresh failed'&&c.newMtType()==='pseudo'&&c.mtProviderId()===id&&c.mtBranch()==='main'&&c.mtLocale()==='he'&&c.mtResult()==='Earlier local result';},selected)&&await page.$eval('[name=settingsMtDraftNotice]',e=>e.textContent.includes('name draft was discarded')));
  await replace('newMtName','New unsent name');await page.$eval('[name=discardSettingsMtName]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-mt-name-discard-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=discardSettingsMtName]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-mt-name-discard-mobile.png'});check('390px name discard and receipt fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsMtDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  check('no pretranslation requested, translations or deliveries created',runs===0&&await prisma.translation.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no name discard runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
