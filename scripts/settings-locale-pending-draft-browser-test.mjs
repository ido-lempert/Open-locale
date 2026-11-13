// Real local browser -> settings pending locale draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55954, WEB_PORT = 4200, API_PORT = 3000;
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
  let adds=0,reads=0,held,failAdd=false,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='POST'&&path===`/api${P}/locales`){adds++;payloads.push(JSON.parse(req.postData()));if(failAdd)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async value=>page.$eval('[name=newLocale]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Locale create request not held');};
  await replace(' fr ');await page.$eval('[name=addSettingsLocale]',e=>e.form.requestSubmit());await poll();await replace(' <b>de</b> ');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addLocale());check('pending duplicate blocked with exact submitted trimmed code',adds===1&&payloads[0].code==='fr');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('successful old POST keeps literal invalid newer draft and explicit unadded receipt',await page.$eval('[name=newLocale]',e=>e.value===' <b>de</b> '&&!e.parentElement.querySelector('b'))&&await page.$eval('[name=settingsLocaleDraftNotice]',e=>e.textContent.includes('submitted locale was added')&&e.textContent.includes('has not been added'))&&await page.$('[name=settingsLocaleInvalid]'));if(failures)throw new Error('Locale draft preservation absent or mismatched');
  let state=await call(P,null,token);check('only submitted locale persists and settings refreshes',state.locales.some(l=>l.code==='fr')&&!state.locales.some(l=>l.code==='de'||l.code.includes('<'))&&reads>0);
  const beforeInvalid=reads;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addLocale());check('invalid newer draft keeps receipt and cannot send',adds===1&&reads===beforeInvalid&&!!await page.$('[name=settingsLocaleDraftNotice]')&&await page.$eval('[name=addSettingsLocale]',e=>e.disabled));
  await page.$eval('[name=newLocale]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-locale-pending-draft-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=newLocale]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-locale-pending-draft-mobile.png'});check('390px newer draft receipt and validation fit without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsLocaleDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  await replace(' de ');held=null;await page.$eval('[name=addSettingsLocale]',e=>e.form.requestSubmit());await poll();check('corrected newer draft sent only on second explicit Add and receipt clears',adds===2&&payloads[1].code==='de'&&!await page.$('[name=settingsLocaleDraftNotice]'));await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());state=await call(P,null,token);check('unchanged success clears draft and both explicit locales persist',await page.$eval('[name=newLocale]',e=>e.value==='')&&!await page.$('[name=settingsLocaleDraftNotice]')&&['fr','de'].every(c=>state.locales.some(l=>l.code===c)));
  const before=reads;failAdd=true;await replace('it');await page.$eval('[name=addSettingsLocale]',e=>e.form.requestSubmit());await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('POST refusal keeps draft with no added claim or reload',await page.$eval('[name=newLocale]',e=>e.value==='it')&&!await page.$('[name=settingsLocaleDraftNotice]')&&reads===before);
  failAdd=false;failRead=true;held=null;await replace(' es ');await page.$eval('[name=addSettingsLocale]',e=>e.form.requestSubmit());await poll();await replace('pt-BR');await held.continue();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed'&&!ng.getComponent(document.querySelector('ol-settings')).busy());check('reload failure after successful POST keeps newer draft and accurate receipt',await page.$eval('[name=newLocale]',e=>e.value==='pt-BR')&&await page.$eval('[name=settingsLocaleDraftNotice]',e=>e.textContent.includes('submitted locale was added')&&e.textContent.includes('has not been added')));state=await call(P,null,token);check('reload failure does not undo submitted locale or add newer draft',state.locales.some(l=>l.code==='es')&&!state.locales.some(l=>l.code==='pt-BR'||l.code==='it'));
  check('no pending locale draft runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
