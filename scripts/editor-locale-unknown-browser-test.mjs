// Real local browser -> locale additions and code reads -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55772, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-locale-unknown-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('locale_unknown_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/locale_unknown_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  let adds=0,keyReads=0,projectReads=0,mode='error',held;const writes=[];await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&!['GET','OPTIONS'].includes(req.method()))writes.push(path);if(req.method()==='POST'&&path===`/api${P}/locales`){adds++;await call(`${P}/locales`,JSON.parse(req.postData()),token);return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_LOCALE_RESULT'})});}if(req.method()==='GET'&&path===`/api${P}/keys`)keyReads++;if(req.method()==='GET'&&path===`/api${P}`){projectReads++;if(mode==='hold'){held=req;return;}if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_LOCALE_READ'})});}req.continue();});
  await page.type('[name=newLocale]','fr');await page.click('[name=addLocale]');await page.waitForSelector('[name=localeCreateError]');await page.waitForFunction(()=>document.querySelector('[name=addLocale]')?.disabled===true);check('committed then lost locale addition pauses without automatic reads',adds===1&&projectReads===0&&keyReads===0&&(await call(P,null,token)).locales.some(l=>l.code==='fr')&&!(await page.content()).includes('PRIVATE_LOCALE_RESULT'));
  await page.$eval('[name=newLocale]',e=>{e.value='de';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.$eval('[name=addLocale]',e=>e.form.requestSubmit());await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).addLocale());check('form and captured duplicate cannot replay unknown locale addition',adds===1&&await page.$eval('[name=newLocale]',e=>e.value==='de'));
  await page.focus('[aria-label="alpha in en"]');await page.type('[aria-label="alpha in en"]',' local draft');await page.click('[name=checkCurrentLocales]');await page.waitForSelector('[name=localeRecoveryError]');check('focused failed current-code read keeps pause without translation blur save',projectReads===1&&keyReads===0&&writes.length===1&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original local draft')&&await page.$eval('[name=addLocale]',e=>e.disabled)&&!(await page.content()).includes('PRIVATE_LOCALE_READ'));
  await page.$eval('[name=localeCreateError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-locale-unknown-paused-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=localeCreateError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-locale-unknown-paused-mobile.png'});await page.setViewport({width:1280,height:900});
  mode='hold';await page.$eval('[name=checkCurrentLocales]',e=>e.click());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('locale read not held');await page.waitForSelector('[name=localeRecoveryLoading]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).checkCurrentLocales());check('pending duplicate read refuses while locale additions remain paused',projectReads===2&&adds===1&&await page.$eval('[name=checkCurrentLocales]',e=>e.disabled));mode='live';await held.continue();await page.waitForSelector('[name=localeRecoveryCodes]');await page.waitForFunction(()=>document.querySelector('[name=addLocale]')?.disabled===false);check('fresh current codes show committed locale without replacing columns or local values',await page.$eval('[name=localeRecoveryCodes]',e=>e.textContent.includes('en, he, fr')&&e.textContent.includes('may differ'))&&!await page.$('[aria-label="alpha in fr"]')&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original local draft')&&await page.$eval('[name=newLocale]',e=>e.value==='de')&&adds===1&&writes.length===1&&keyReads===0&&projectReads===2);
  await page.$eval('[name=localeRecoveryCodes]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-locale-unknown-desktop.png',fullPage:false});await page.setViewport({width:390,height:844});await page.$eval('[name=localeRecoveryCodes]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-locale-unknown-mobile.png',fullPage:false});check('390px current-code receipt fits viewport',await page.$eval('[name=localeRecoveryCodes]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
  check('no locale-uncertainty runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
