// Real local browser -> settings pseudo-provider name validation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55950, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-locale-create-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('locale_create_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/locale_create_browser`;
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


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=name]');await page.waitForNetworkIdle({idleTime:200});
  let creates=0,reads=0,runs=0,held,failCreate=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET')reads++;if(path===`/api${P}/mt/pretranslate`&&req.method()==='POST')runs++;if(req.method()==='POST'&&path===`/api${P}/mt/providers`){creates++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async(name,value)=>page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Provider create request not held');};
  check('provider name linked rules/no native truncation or required',await page.$eval('[name=newMtName]',e=>e.getAttribute('aria-describedby')==='settingsMtNameRules'&&!e.hasAttribute('maxlength')&&!e.hasAttribute('required'))&&!!await page.$('[name=settingsMtNameRules]'));if(failures)throw new Error('Provider name preflight absent or mismatched');
  await page.focus('[name=newMtName]');await page.keyboard.sendCharacter('x'.repeat(121));await page.waitForFunction(()=>document.querySelector('[name=newMtName]').getAttribute('aria-invalid')==='true'&&document.querySelector('[name=addSettingsMtProvider]').disabled);check('keyboard name121 retained with disabled Add',await page.$eval('[name=newMtName]',e=>e.value.length===121));await page.keyboard.press('Enter');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addMtProvider());check('invalid name Enter/direct sends no GET/POST and keeps provider type',creates===0&&reads===0&&await page.$eval('[name=newMtType]',e=>e.value==='pseudo'));
  await replace('newMtName','✈️'.repeat(121));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addMtProvider());check('presentation121 name remains full local',creates===0&&reads===0&&await page.$eval('[name=newMtName]',e=>e.value==='✈️'.repeat(121)));
  await page.$eval('[name=newMtName]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-mt-name-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=newMtName]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-mt-name-validation-mobile.png'});check('390px provider name rules/form fit without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsMtNameRules]',e=>e.getBoundingClientRect().right<=innerWidth));
  const raw=' '+ '✈️'.repeat(120)+' ';await replace('newMtName',raw);await page.$eval('[name=addSettingsMtProvider]',e=>e.form.requestSubmit());await poll();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addMtProvider());check('corrected Unicode120 name submits once trimmed and busy blocks duplicate',creates===1&&payloads[0].name===raw.trim()&&payloads[0].type==='pseudo'&&await page.$eval('[name=addSettingsMtProvider]',e=>e.disabled));await held.continue();await page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.busy()&&c.newMtName()===''&&c.mtProviders().length===1&&c.mtProviderId()===c.mtProviders()[0].id;});await page.waitForNetworkIdle({idleTime:200});const providers=await call(P+'/mt/providers',null,token);check('Unicode boundary persists and existing listrefresh/clear/first selection runs',providers.length===1&&providers[0].name===raw.trim()&&reads>0&&await page.$eval('[name=newMtName]',e=>e.value===''));
  const selected=await page.$eval('[name=mtProviderId]',e=>e.value);held=null;await replace('newMtName','   ');await page.$eval('[name=addSettingsMtProvider]',e=>e.form.requestSubmit());await poll();await held.continue();await page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.busy()&&c.mtProviders().length===2;});await page.waitForNetworkIdle({idleTime:200});check('whitespace name stays API-valid and persists as trimmed empty',creates===2&&payloads[1].name===''&&(await call(P+'/mt/providers',null,token)).some(r=>r.name===''));check('adding second provider preserves earlier selection',await page.$eval('[name=mtProviderId]',e=>e.value)===selected);
  const before=reads;failCreate=true;await replace('newMtName',' <img src=x onerror=alert(1)> ');await page.$eval('[name=addSettingsMtProvider]',e=>e.form.requestSubmit());await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('valid server refusal retains literal rawname/type/selection without refresh',creates===3&&reads===before&&await page.$eval('[name=newMtName]',e=>e.value===' <img src=x onerror=alert(1)> '&&!e.parentElement.querySelector('img'))&&await page.$eval('[name=newMtType]',e=>e.value==='pseudo')&&await page.$eval('[name=mtProviderId]',e=>e.value)===selected);
  check('adding local pseudo fixtures never runs pretranslation',runs===0);check('no provider name validation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
