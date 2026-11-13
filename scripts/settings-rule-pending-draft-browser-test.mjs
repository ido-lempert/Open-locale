// Real local browser -> settings pending automation draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55951, WEB_PORT = 4200, API_PORT = 3000;
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
  let creates=0,reads=0,held,failCreate=false,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path===`/api${P}/automations`&&req.method()==='GET'){reads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='POST'&&path===`/api${P}/automations`){creates++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async(name,value)=>page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Automation create request not held');};
  await page.select('[name=newRuleAction]','notify');await page.waitForSelector('[name=newRuleMessage]');await replace('newRuleName',' First ');await replace('newRuleMessage','First message');await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await poll();
  await replace('newRuleName',' <b>Newer draft</b> ');await replace('newRuleMessage','Newer message');await page.select('[name=newRuleTrigger]','key.created');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());check('pending duplicate blocked and first outgoing request retains submitted snapshot',creates===1&&payloads[0].name==='First'&&payloads[0].config.message==='First message'&&payloads[0].trigger==='translation.value');
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('successful POST keeps entire newer literal draft with explicit unsaved notice',await page.$eval('[name=newRuleName]',e=>e.value===' <b>Newer draft</b> '&&!e.parentElement.querySelector('b'))&&await page.$eval('[name=newRuleMessage]',e=>e.value==='Newer message')&&await page.$eval('[name=newRuleTrigger]',e=>e.value==='key.created')&&await page.$eval('[name=settingsRuleDraftNotice]',e=>e.textContent.includes('submitted rule was saved')&&e.textContent.includes('has not been saved')));if(failures)throw new Error('Newer draft preservation absent or mismatched');
  let rules=await call(P+'/automations',null,token);check('only submitted rule persisted and refreshed list remains visible',rules.length===1&&rules[0].name==='First'&&rules[0].config.message==='First message'&&reads===1&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).autoRules().some(r=>r.name==='First')));
  await page.$eval('[name=settingsRuleDraftNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-rule-pending-draft-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=newRuleName]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-rule-pending-draft-mobile.png'});check('390px newer draft and notice fit without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsRuleDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  held=null;await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await poll();check('reviewed newer draft is only sent on a second explicit Add and receipt clears',creates===2&&payloads[1].name==='<b>Newer draft</b>'&&payloads[1].config.message==='Newer message'&&!await page.$('[name=settingsRuleDraftNotice]'));await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('unchanged successful second draft clears existing fields',await page.$eval('[name=newRuleName]',e=>e.value==='')&&await page.$eval('[name=newRuleMessage]',e=>e.value==='')&&!await page.$('[name=settingsRuleDraftNotice]'));
  held=null;await replace('newRuleName','Third');await replace('newRuleMessage','Third message');await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await poll();await page.select('[name=newRuleAction]','task.create');await page.waitForSelector('[name=newRuleTitle]');await replace('newRuleTitle','Next task title');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('action switch during POST preserves new active title and old inactive message',await page.$eval('[name=newRuleAction]',e=>e.value==='task.create')&&await page.$eval('[name=newRuleTitle]',e=>e.value==='Next task title')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).newRuleMessage()==='Third message')&&!!await page.$('[name=settingsRuleDraftNotice]'));
  const before=reads;failCreate=true;await replace('newRuleName','Refused');await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('POST refusal keeps draft without saved claim or refresh',await page.$eval('[name=newRuleName]',e=>e.value==='Refused')&&await page.$eval('[name=newRuleTitle]',e=>e.value==='Next task title')&&!await page.$('[name=settingsRuleDraftNotice]')&&reads===before);
  failCreate=false;failRead=true;held=null;await replace('newRuleName','Saved before read failure');await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());await poll();await replace('newRuleTitle','Retained next task');await held.continue();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed'&&!ng.getComponent(document.querySelector('ol-settings')).busy());check('read failure after saved POST keeps newer draft and accurate saved-unsaved receipt',await page.$eval('[name=newRuleTitle]',e=>e.value==='Retained next task')&&await page.$eval('[name=settingsRuleDraftNotice]',e=>e.textContent.includes('submitted rule was saved')&&e.textContent.includes('has not been saved')));rules=await call(P+'/automations',null,token);check('read failure does not roll back successful earlier submitted payload',rules.some(r=>r.name==='Saved before read failure'&&r.config.title==='Next task title'));
  check('no pending rule draft runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
