// Real local browser -> settings locale-code syntax validation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55943, WEB_PORT = 4200, API_PORT = 3000;
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


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=newLocale]');await page.waitForNetworkIdle({idleTime:200});
  let adds=0,reads=0,held,failAdd=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET')reads++;if(req.method()==='POST'&&path===`/api${P}/locales`){adds++;payloads.push(JSON.parse(req.postData()));if(failAdd)return req.respond({status:409,contentType:'application/json',body:'{"message":"Locale already exists"}'});held=req;return;}req.continue();});
  const replace=async value=>page.$eval('[name=newLocale]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Settings locale request not held');};
  check('settings locale linked rules, no native truncation and empty Add disabled',await page.$eval('[name=newLocale]',e=>e.getAttribute('aria-describedby')==='settingsLocaleRules'&&!e.hasAttribute('maxlength'))&&!!await page.$('[name=addSettingsLocale]')&&await page.$eval('[name=addSettingsLocale]',e=>e.disabled));
  if(failures)throw new Error('Settings locale preflight absent or mismatched');
  for(const bad of [' ','e','EN','en_US','en us','עברית','😀','<img>','en-a','en-123456789','-en','en-']){await replace(bad);await page.waitForSelector('[name=settingsLocaleInvalid]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addLocale());check('invalid settings code raw/local '+bad,adds===0&&reads===0&&await page.$eval('[name=newLocale]',(e,v)=>e.value===v&&e.getAttribute('aria-invalid')==='true',bad)&&await page.$eval('[name=addSettingsLocale]',e=>e.disabled));}
  await page.focus('[name=newLocale]');await page.keyboard.press('Enter');await new Promise(r=>setTimeout(r,150));check('invalid Enter adds no API read/write',adds===0&&reads===0);
  await replace('');await page.focus('[name=newLocale]');await page.keyboard.sendCharacter('de-1996-variant');check('actual keyboard retains valid code beyond old10 limit',await page.$eval('[name=newLocale]',e=>e.value==='de-1996-variant')&&await page.$eval('[name=addSettingsLocale]',e=>!e.disabled));
  await replace(' de-1996-variant ');await page.$eval('[name=addSettingsLocale]',e=>e.form.requestSubmit());await poll();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addLocale());check('pending settings add prevents duplicate and keeps submitted code',adds===1&&payloads[0].code==='de-1996-variant'&&await page.$eval('[name=addSettingsLocale]',e=>e.disabled)&&await page.$eval('[name=newLocale]',e=>e.value===' de-1996-variant '));await held.continue();await page.waitForFunction(()=>!document.querySelector('[name=newLocale]').value);await page.waitForNetworkIdle({idleTime:200});
  check('successful long trimmed locale persists and existing Settings refresh runs',(await call(P,null,token)).locales.some(l=>l.code==='de-1996-variant')&&reads>0&&await page.$$eval('.locale-list code',es=>es.some(e=>e.textContent==='de-1996-variant'))&&await page.$eval('[name=addSettingsLocale]',e=>e.disabled));
  const before=reads;await replace('en_US');await page.waitForSelector('[name=settingsLocaleInvalid]');await page.$eval('[name=newLocale]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-locale-code-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=newLocale]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-locale-code-validation-mobile.png'});
  check('390px settings locale guidance/form fit without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsLocaleRules]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.$eval('[name=newLocale]',e=>e.value==='en_US'));
  failAdd=true;await replace('en');await page.$eval('[name=addSettingsLocale]',e=>e.form.requestSubmit());await page.waitForFunction(()=>document.querySelector('ol-settings')&&ng.getComponent(document.querySelector('ol-settings')).error()==='Locale already exists');check('valid server rejection retains existing draft/error without refresh',adds===2&&reads===before&&await page.$eval('[name=newLocale]',e=>e.value==='en')&&await page.$eval('[name=addSettingsLocale]',e=>!e.disabled));
  check('no settings locale runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
