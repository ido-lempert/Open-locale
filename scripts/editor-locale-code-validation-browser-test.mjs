// Real local browser -> local locale-code syntax validation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55915, WEB_PORT = 4200, API_PORT = 3000;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  let heldLocale,adds=0,keyReads=0,projectReads=0,failAdd=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='POST'&&path===`/api${P}/locales`){adds++;payloads.push(JSON.parse(req.postData()));if(failAdd)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE_LOCALE_ERROR"}'});heldLocale=req;return;}if(req.method()==='GET'&&path===`/api${P}/keys`)keyReads++;if(req.method()==='GET'&&path===`/api${P}`)projectReads++;req.continue();});
  const replace=async(value)=>{await page.$eval('[name=newLocale]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  const poll=async()=>{for(let n=0;n<150;n++){if(heldLocale)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Locale request not held');};
  check('locale syntax rules linked, no UI truncation and empty Add disabled',await page.$eval('[name=newLocale]',e=>e.getAttribute('aria-describedby')==='newLocaleRules'&&!e.hasAttribute('maxlength'))&&await page.$eval('[name=addLocale]',e=>e.disabled));
  for(const bad of [' ','e','EN','en_US','en us','עברית','😀','<img>','en-a','en-123456789','-en','en-']){await replace(bad);await page.waitForSelector('[name=newLocaleInvalid]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).addLocale());check('invalid locale stays raw and local '+bad,adds===0&&keyReads===0&&projectReads===0&&await page.$eval('[name=newLocale]',(e,v)=>e.value===v,bad)&&await page.$eval('[name=addLocale]',e=>e.disabled)&&!await page.$('[name=localeCreateError]'));}
  await page.$eval('[name=newLocale]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-locale-code-validation-invalid.png'});
  await page.focus('[aria-label="alpha in en"]');await page.type('[aria-label="alpha in en"]',' LOCAL');await replace('de-1996-variant');await page.waitForFunction(()=>!document.querySelector('[name=addLocale]').disabled);check('corrected long segmented code enables without read/reload',adds===0&&keyReads===0&&projectReads===0);await page.$eval('[name=addLocale]',e=>e.form.requestSubmit());await poll();await replace(' fr ');await page.$eval('[name=addLocale]',e=>e.form.requestSubmit());check('pending locale refuses duplicate and retains newer raw code',adds===1&&payloads[0].code==='de-1996-variant'&&await page.$eval('[name=newLocale]',e=>e.value===' fr '));await heldLocale.continue();await page.waitForSelector('[aria-label="alpha in de-1996-variant"]');await page.waitForFunction(()=>!document.querySelector('[name=addLocale]').disabled);
  check('actual long-code creation retains newer raw input and local translation without GET',(await call(P,null,token)).locales.some(l=>l.code==='de-1996-variant')&&await page.$eval('[name=newLocale]',e=>e.value===' fr ')&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original LOCAL')&&keyReads===0&&projectReads===0);
  heldLocale=null;await page.$eval('[name=addLocale]',e=>e.form.requestSubmit());await poll();check('existing trim semantics submits fr not outer whitespace',adds===2&&payloads[1].code==='fr');await heldLocale.continue();await page.waitForSelector('[aria-label="alpha in fr"]');await page.waitForFunction(()=>document.querySelector('[name=newLocale]').value==='');check('unchanged confirmed code clears to disabled Add',await page.$eval('[name=addLocale]',e=>e.disabled)&&(await call(P,null,token)).locales.some(l=>l.code==='fr')&&keyReads===0&&projectReads===0);
  await replace('EN');await page.waitForSelector('[name=newLocaleInvalid]');await page.$eval('[name=newLocale]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-locale-code-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=newLocale]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/editor-locale-code-validation-mobile.png'});check('390px locale rules and form fit without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=newLocaleRules]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.$eval('[name=newLocale]',e=>e.value==='EN'&&e.getAttribute('aria-invalid')==='true'));
  failAdd=true;await replace('pt-BR');await page.$eval('[name=addLocale]',e=>e.form.requestSubmit());await page.waitForSelector('[name=localeCreateError]');await replace('it');await page.$eval('[name=addLocale]',e=>e.form.requestSubmit());await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).addLocale());check('valid server error still pauses replay and keeps code without private text or GET',adds===3&&keyReads===0&&projectReads===0&&await page.$eval('[name=newLocale]',e=>e.value==='it')&&await page.$eval('[name=addLocale]',e=>e.disabled)&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  check('no locale syntax validation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
