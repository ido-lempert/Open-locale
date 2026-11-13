// Real local browser -> settings automation payload validation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55947, WEB_PORT = 4200, API_PORT = 3000;
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
  await page.select('[name=newRuleAction]','notify');await page.waitForSelector('[name=newRuleMessage]');
  check('active notify template linked rules/no native truncation/explicit Add',await page.$eval('[name=newRuleMessage]',e=>e.getAttribute('aria-describedby')==='settingsRulePayloadRules'&&!e.hasAttribute('maxlength'))&&!!await page.$('[name=addSettingsRule]'));if(failures)throw new Error('Automation payload preflight absent or mismatched');
  await replace('newRuleName',' Rule ');await page.focus('[name=newRuleMessage]');await page.keyboard.sendCharacter('x'.repeat(201));await page.waitForFunction(()=>document.querySelector('[name=newRuleMessage]').getAttribute('aria-invalid')==='true'&&document.querySelector('[name=addSettingsRule]').disabled);check('keyboard message201 retained with disabled Add',await page.$eval('[name=newRuleMessage]',e=>e.value.length===201));await page.keyboard.press('Enter');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('invalid notify Enter/direct keeps raw rule choices without GET/POST',creates===0&&reads===0&&await page.$eval('[name=newRuleName]',e=>e.value===' Rule '));
  await replace('newRuleMessage','😀'.repeat(101));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('Unicode101 surrogate pairs exceed200UTF16 without truncation/send',creates===0&&reads===0&&await page.$eval('[name=newRuleMessage]',e=>e.value==='😀'.repeat(101)));
  await page.$eval('[name=newRuleMessage]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-rule-payload-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=newRuleMessage]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-rule-payload-validation-mobile.png'});check('390px active payload rules/form fit without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsRulePayloadRules]',e=>e.getBoundingClientRect().right<=innerWidth));
  await page.select('[name=newRuleAction]','task.create');await page.waitForSelector('[name=newRuleTitle]');await replace('newRuleTitle','   ');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('whitespace task title blocked without sending inactive notify text',creates===0&&reads===0&&await page.$eval('[name=newRuleTitle]',e=>e.value==='   '));await replace('newRuleTitle','😀'.repeat(101));await page.waitForFunction(()=>document.querySelector('[name=newRuleTitle]').getAttribute('aria-invalid')==='true');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('task title uses rawUTF16 cap with linked invalid state',creates===0&&reads===0&&await page.$eval('[name=newRuleTitle]',e=>e.getAttribute('aria-describedby')==='settingsRulePayloadRules'&&!e.hasAttribute('maxlength')&&e.value==='😀'.repeat(101)));
  await page.select('[name=newRuleAction]','pretranslate');await page.waitForFunction(()=>!document.querySelector('[name=settingsRulePayloadRules]'));check('pretranslate hides text rules and ignores retained inactive invalid templates',await page.$eval('[name=addSettingsRule]',e=>!e.disabled));await page.select('[name=newRuleAction]','notify');await page.waitForSelector('[name=newRuleMessage]');check('action switch retains full notify draft and invalid state',await page.$eval('[name=newRuleMessage]',e=>e.value==='😀'.repeat(101))&&await page.$eval('[name=addSettingsRule]',e=>e.disabled));
  const raw=' '+ '😀'.repeat(99)+' ';await replace('newRuleMessage',raw);await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await poll();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('corrected200UTF16 active notify submits once exact raw bytes/name trim',creates===1&&payloads[0].name==='Rule'&&payloads[0].action==='notify'&&payloads[0].config.message===raw&&!('title' in payloads[0].config)&&await page.$eval('[name=addSettingsRule]',e=>e.disabled));await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await page.waitForNetworkIdle({idleTime:200});const rules=await call(P+'/automations',null,token);check('notify boundary persists and existing list refresh/clear runs',rules.length===1&&rules[0].config.message===raw&&reads>0&&await page.$eval('[name=newRuleName]',e=>e.value==='')&&await page.$eval('[name=newRuleMessage]',e=>e.value===''));
  held=null;await page.select('[name=newRuleAction]','task.create');await page.waitForSelector('[name=newRuleTitle]');await replace('newRuleName','Task rule');await replace('newRuleTitle',raw);await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await poll();await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await page.waitForNetworkIdle({idleTime:200});const tasks=await call(P+'/automations',null,token);check('task boundary persists raw in its rule',creates===2&&tasks.length===2&&tasks.some(r=>r.action==='task.create'&&r.config.title===raw));
  const before=reads;failCreate=true;await replace('newRuleName','Refused rule');await replace('newRuleTitle','<img src=x onerror=alert(1)>');await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('valid server refusal keeps literal draft/choices/error without refresh',creates===3&&reads===before&&await page.$eval('[name=newRuleTitle]',e=>e.value==='<img src=x onerror=alert(1)>'&&!e.parentElement.querySelector('img'))&&await page.$eval('[name=newRuleName]',e=>e.value==='Refused rule')&&await page.$eval('[name=addSettingsRule]',e=>!e.disabled));
  check('no automation payload validation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
