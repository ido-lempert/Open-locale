// Real local browser -> settings read-only automation rule metadata refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_RULE_TEST_PG_PORT ?? 56061), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-rule-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('rule_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/rule_refresh_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  const first=await call(P+'/automations',{name:'First saved rule',trigger:'key.created',action:'task.create',config:{title:'Never fired first'}},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=newRuleName]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,holdNext=false,held;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}/automations`&&holdNext){holdNext=false;held=r;return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await settle();await page.click(`[name=${name}]`);await settle();};
  const field=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsRules');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Rule metadata read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).ruleListRefreshing());await settle();};
  await field('newRuleName','Unsent rule');await field('name','Other draft');await page.select('[name=newRuleTrigger]','key.created');await page.select('[name=newRuleAction]','task.create');await field('newRuleTitle','Unsent title');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newRuleProvider.set('kept-choice');c.newRuleLocales.set(['he']);c.newRuleMessage.set('Unsent message');c.error.set('Independent error');c.ruleDraftNotice.set('Earlier accepted create');c.ruleToggleNotice.set('Earlier toggle');c.ruleRemoveNotice.set('Earlier remove');});
  const counts=[reads,writes];await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshRuleList());check('explicit rule metadata read once and duplicate button/handler refuse',reads===counts[0]+1&&writes===counts[1]&&await page.$eval('[name=refreshSettingsRules]',e=>e.disabled));
  await call(P+'/automations',{name:'External saved rule',trigger:'key.created',action:'task.create',config:{title:'Never fired external'}},token);await answer(await call(P+'/automations',null,token));
  check('real updated rules preserve every draft choice receipt and independent state',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.autoRules().length===2&&c.newRuleName()==='Unsent rule'&&c.newRuleTrigger()==='key.created'&&c.newRuleAction()==='task.create'&&c.newRuleProvider()==='kept-choice'&&c.newRuleLocales().join(',')==='he'&&c.newRuleTitle()==='Unsent title'&&c.newRuleMessage()==='Unsent message'&&c.ruleDraftNotice()==='Earlier accepted create'&&c.ruleToggleNotice()==='Earlier toggle'&&c.ruleRemoveNotice()==='Earlier remove'&&c.error()==='Independent error'&&c.name()==='Other draft'&&c.ruleListRefreshNotice().includes('not a run history');}));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval('[name=refreshSettingsRules]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-rule-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsRules]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await settle();await page.screenshot({path:`/downloads/settings-rule-refresh-${label}-mobile.png`});check(label+' rule metadata status fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsRuleListRefreshNotice]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 retains previous rules full draft and bounded retry',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.autoRules().length===2&&c.newRuleName()==='Unsent rule'&&c.newRuleTitle()==='Unsent title'&&c.newRuleMessage()==='Unsent message'&&c.error()==='Independent error'&&c.ruleListRefreshNotice().includes('could not be refreshed')&&!c.ruleListRefreshNotice().includes('PRIVATE');}));await capture('failure');
  await start();await answer(await call(P+'/automations',null,token));check('explicit retry stays read-only',writes===counts[1]&&await page.$eval('[name=settingsRuleListRefreshNotice]',e=>e.textContent.includes('was refreshed')));
  const beforeToggle=await call(P+'/automations',null,token);await start();await click('toggleRule-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeToggle);check('late metadata cannot reverse actual explicit rule disable',!(await call(P+'/automations',null,token)).find(p=>p.id===first.id).enabled&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.autoRules().find(p=>p.id===id).enabled&&c.ruleListRefreshNotice()==='';},first.id));
  const beforeCreate=await call(P+'/automations',null,token);await start();await field('newRuleName','Later created saved rule');await click('addSettingsRule');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeCreate);check('late metadata cannot erase actual explicit rule Add',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.autoRules().some(p=>p.name==='Later created saved rule')&&c.ruleListRefreshNotice()==='';}));
  const beforeDelete=await call(P+'/automations',null,token);await start();await click('startRemoveRule-'+first.id);await click('confirmRemoveRule-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeDelete);check('late metadata cannot resurrect actually removed rule',!(await call(P+'/automations',null,token)).some(p=>p.id===first.id)&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.autoRules().some(p=>p.id===id)&&c.ruleListRefreshNotice()==='';},first.id));
  await field('newRuleName','Kept after empty list');for(const r of await call(P+'/automations',null,token))await call(P+'/automations/'+r.id,null,token,'DELETE');await start();await answer(await call(P+'/automations',null,token));check('empty rule snapshot preserves new draft with literal scope limits',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.autoRules().length===0&&c.newRuleName()==='Kept after empty list'&&c.newRuleProvider()==='kept-choice';})&&await page.$eval('#settingsRuleListRefreshScope',e=>e.textContent.includes('validate current creator authority')&&e.textContent.includes('not a complete run history')));
  await start();await page.evaluate(()=>window.departedSettings=ng.getComponent(document.querySelector('ol-settings')));const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'[]'}).catch(()=>{});await settle();check('actual route departure suppresses pending rule metadata feedback',await page.evaluate(()=>window.departedSettings.ruleListRefreshNotice()===''&&!window.departedSettings.ruleListRefreshing())&&!await page.$('[name=settingsRuleListRefreshNotice]'));
  check('no effects providers tokens tasks webhooks deliveries rules or translations remain',await prisma.mtProvider.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0&&await prisma.translation.count()===0);check('no rule metadata runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
process.exit(!completed||failures?1:0);
