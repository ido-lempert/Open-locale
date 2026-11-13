// Real local browser -> settings automation name validation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55949, WEB_PORT = 4200, API_PORT = 3000;
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
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET')reads++;if(req.method()==='POST'&&path===`/api${P}/automations`){creates++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async(name,value)=>page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Automation create request not held');};
  await page.select('[name=newRuleAction]','notify');await page.waitForSelector('[name=newRuleMessage]');await replace('newRuleMessage',' Message ');
  check('rule name linked rules/no native truncation or required',await page.$eval('[name=newRuleName]',e=>e.getAttribute('aria-describedby')==='settingsRuleNameRules'&&!e.hasAttribute('maxlength')&&!e.hasAttribute('required'))&&!!await page.$('[name=settingsRuleNameRules]'));if(failures)throw new Error('Rule name preflight absent or mismatched');
  await page.focus('[name=newRuleName]');await page.keyboard.sendCharacter('x'.repeat(121));await page.waitForFunction(()=>document.querySelector('[name=newRuleName]').getAttribute('aria-invalid')==='true'&&document.querySelector('[name=addSettingsRule]').disabled);check('keyboard name121 retained with disabled Add',await page.$eval('[name=newRuleName]',e=>e.value.length===121));await page.keyboard.press('Enter');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('invalid name Enter/direct sends no GET/POST and keeps active message',creates===0&&reads===0&&await page.$eval('[name=newRuleMessage]',e=>e.value===' Message '));
  await replace('newRuleName','✈️'.repeat(121));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('presentation121 name remains full local',creates===0&&reads===0&&await page.$eval('[name=newRuleName]',e=>e.value==='✈️'.repeat(121)));
  await page.$eval('[name=newRuleName]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-rule-name-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=newRuleName]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-rule-name-validation-mobile.png'});check('390px name rules/form fit without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsRuleNameRules]',e=>e.getBoundingClientRect().right<=innerWidth));
  await page.select('[name=newRuleAction]','task.create');await page.waitForSelector('[name=newRuleTitle]');await replace('newRuleTitle','Title');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('invalid name blocks valid task template too',creates===0&&reads===0&&await page.$eval('[name=addSettingsRule]',e=>e.disabled));await page.select('[name=newRuleAction]','pretranslate');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('invalid name also blocks pretranslate without changing choices',creates===0&&reads===0&&await page.$eval('[name=addSettingsRule]',e=>e.disabled));await page.select('[name=newRuleAction]','notify');await page.waitForSelector('[name=newRuleMessage]');
  const raw=' '+ '✈️'.repeat(120)+' ';await replace('newRuleName',raw);await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await poll();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('corrected Unicode120 name submits once trimmed with raw active message',creates===1&&payloads[0].name===raw.trim()&&payloads[0].config.message===' Message '&&await page.$eval('[name=addSettingsRule]',e=>e.disabled));await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await page.waitForNetworkIdle({idleTime:200});const rules=await call(P+'/automations',null,token);check('Unicode boundary persists and existing listrefresh/clear runs',rules.length===1&&rules[0].name===raw.trim()&&reads>0&&await page.$eval('[name=newRuleName]',e=>e.value===''));
  held=null;await replace('newRuleName','   ');await replace('newRuleMessage','Blank-name message');await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await poll();await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await page.waitForNetworkIdle({idleTime:200});check('whitespace name remains API-valid and persists as existing trimmed empty',creates===2&&payloads[1].name===''&&(await call(P+'/automations',null,token)).some(r=>r.name===''&&r.config.message==='Blank-name message'));
  await replace('newRuleName','Valid');await replace('newRuleMessage','x'.repeat(201));await page.waitForFunction(()=>document.querySelector('[name=addSettingsRule]').disabled);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('valid name does not bypass active payload limit',creates===2);
  const before=reads;failCreate=true;await replace('newRuleName',' <img src=x onerror=alert(1)> ');await replace('newRuleMessage','Message');await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('valid server refusal retains literal rawname/choices/error without refresh',creates===3&&reads===before&&await page.$eval('[name=newRuleName]',e=>e.value===' <img src=x onerror=alert(1)> '&&!e.parentElement.querySelector('img'))&&await page.$eval('[name=newRuleMessage]',e=>e.value==='Message'));
  check('no rule name validation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
