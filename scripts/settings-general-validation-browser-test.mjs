// Real local browser -> settings general raw text validation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55945, WEB_PORT = 4200, API_PORT = 3000;
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
  let updates=0,reads=0,held,failUpdate=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET')reads++;if(req.method()==='PATCH'&&path===`/api${P}`){updates++;payloads.push(JSON.parse(req.postData()));if(failUpdate)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async(name,value)=>page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('General save request not held');};
  check('general fields share linked rules and no native truncation',await page.$$eval('[name=name],[name=description]',es=>es.length===2&&es.every(e=>e.getAttribute('aria-describedby')==='settingsGeneralRules'&&!e.hasAttribute('maxlength')))&&!!await page.$('[name=saveSettingsGeneral]'));if(failures)throw new Error('General preflight absent or mismatched');
  await replace('name','');await page.focus('[name=name]');await page.keyboard.sendCharacter('x'.repeat(121));await page.waitForSelector('[name=settingsGeneralInvalid]');check('keyboard name121 retained with disabled Save',await page.$eval('[name=name]',e=>e.value.length===121&&e.getAttribute('aria-invalid')==='true')&&await page.$eval('[name=saveSettingsGeneral]',e=>e.disabled));
  await page.keyboard.press('Enter');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).rename());check('invalid name Enter/direct sends no read or write',updates===0&&reads===0);
  await replace('name','Valid');await replace('description','✈️'.repeat(2001));await page.waitForFunction(()=>document.querySelector('[name=description]').getAttribute('aria-invalid')==='true'&&document.querySelector('[name=saveSettingsGeneral]').disabled);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).rename());check('overlong Unicode description stays raw local without state/API',updates===0&&reads===0&&await page.$eval('[name=description]',e=>e.value==='✈️'.repeat(2001)&&e.getAttribute('aria-invalid')==='true')&&await page.$eval('[name=saveSettingsGeneral]',e=>e.disabled));
  await page.$eval('[name=name]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-general-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/settings-general-validation-mobile.png'});check('390px General rules/form fit without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsGeneralRules]',e=>e.getBoundingClientRect().right<=innerWidth));
  const name=' '+ '😀'.repeat(118)+' ',description=' '+ '✈️'.repeat(1998)+' ';await replace('name',name);await replace('description',description);await page.$eval('[name=saveSettingsGeneral]',e=>e.form.requestSubmit());await poll();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).rename());check('valid Unicode boundaries submit once with exact untrimmed bytes',updates===1&&payloads[0].name===name&&payloads[0].description===description&&await page.$eval('[name=saveSettingsGeneral]',e=>e.disabled));await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await page.waitForNetworkIdle({idleTime:200});const saved=await call(P,null,token);check('raw Unicode text persists and existing Settings refresh runs',saved.name===name&&saved.description===description&&reads>0&&await page.$eval('[name=name]',(e,v)=>e.value===v,name));
  held=null;await replace('name','');await replace('description','');await page.$eval('[name=saveSettingsGeneral]',e=>e.form.requestSubmit());await poll();await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await page.waitForNetworkIdle({idleTime:200});const empty=await call(P,null,token);check('empty name and description remain allowed by existing update API',updates===2&&empty.name===''&&empty.description==='');
  const before=reads;failUpdate=true;await replace('name','<img src=x onerror=alert(1)>');await page.$eval('[name=saveSettingsGeneral]',e=>e.form.requestSubmit());await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('valid server refusal retains literal draft/error without refresh',updates===3&&reads===before&&await page.$eval('[name=name]',e=>e.value==='<img src=x onerror=alert(1)>'&&!e.parentElement.querySelector('img'))&&await page.$eval('[name=saveSettingsGeneral]',e=>!e.disabled));
  check('no General validation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
