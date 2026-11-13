// Real local browser -> settings new-group name validation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55946, WEB_PORT = 4200, API_PORT = 3000;
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
  let creates=0,reads=0,held,failCreate=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET')reads++;if(req.method()==='POST'&&path===`/api${P}/groups`){creates++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async(name,value)=>page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Group create request not held');};
  check('group name linked rules/no native truncation and explicit guarded Add',await page.$eval('[name=groupName]',e=>e.getAttribute('aria-describedby')==='settingsGroupRules'&&!e.hasAttribute('maxlength'))&&!!await page.$('[name=addSettingsGroup]'));if(failures)throw new Error('Group preflight absent or mismatched');
  await replace('groupLocales',' he ');await page.focus('[name=groupName]');await page.keyboard.sendCharacter('x'.repeat(101));await page.waitForSelector('[name=settingsGroupInvalid]');check('keyboard name101 retained with disabled Add',await page.$eval('[name=groupName]',e=>e.value.length===101&&e.getAttribute('aria-invalid')==='true')&&await page.$eval('[name=addSettingsGroup]',e=>e.disabled));
  await page.keyboard.press('Enter');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addGroup());check('invalid Enter/direct keeps raw choices without GET/POST',creates===0&&reads===0&&await page.$eval('[name=groupLocales]',e=>e.value===' he '));
  await replace('groupName','✈️'.repeat(101));await page.waitForFunction(()=>document.querySelector('[name=groupName]').getAttribute('aria-invalid')==='true');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addGroup());check('Unicode101 name retained without create/read',creates===0&&reads===0&&await page.$eval('[name=groupName]',e=>e.value==='✈️'.repeat(101)));
  await page.$eval('[name=groupName]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=groupName]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-validation-mobile.png'});check('390px group rules/form fit without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsGroupRules]',e=>e.getBoundingClientRect().right<=innerWidth));
  await replace('groupName','   ');await page.waitForFunction(()=>document.querySelector('[name=addSettingsGroup]').disabled);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addGroup());check('whitespace name blocked with role/locales preserved',creates===0&&reads===0&&await page.$eval('[name=groupName]',e=>e.value==='   ')&&await page.$eval('[name=groupRole]',e=>e.value==='MEMBER')&&await page.$eval('[name=groupLocales]',e=>e.value===' he '));
  const raw=' '+ '😀'.repeat(100)+' ';await replace('groupName',raw);await page.$eval('[name=addSettingsGroup]',e=>e.form.requestSubmit());await poll();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addGroup());check('corrected Unicode100 submitted once with existing trim/parsed grants',creates===1&&payloads[0].name===raw.trim()&&payloads[0].role==='MEMBER'&&JSON.stringify(payloads[0].allowedLocales)==='["he"]'&&await page.$eval('[name=addSettingsGroup]',e=>e.disabled));await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await page.waitForNetworkIdle({idleTime:200});const groups=await call(P+'/groups',null,token);check('Unicode boundary group persists once and existing success clears/refreshes',groups.length===1&&groups[0].name===raw.trim()&&reads>0&&await page.$eval('[name=groupName]',e=>e.value==='')&&await page.$eval('[name=groupLocales]',e=>e.value===''));
  const before=reads;failCreate=true;await replace('groupName','<img src=x onerror=alert(1)>');await replace('groupLocales','he');await page.$eval('[name=addSettingsGroup]',e=>e.form.requestSubmit());await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('valid server refusal retains literal draft/choices/error without refresh',creates===2&&reads===before&&await page.$eval('[name=groupName]',e=>e.value==='<img src=x onerror=alert(1)>'&&!e.parentElement.querySelector('img'))&&await page.$eval('[name=groupLocales]',e=>e.value==='he')&&await page.$eval('[name=addSettingsGroup]',e=>!e.disabled));
  check('no group validation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
