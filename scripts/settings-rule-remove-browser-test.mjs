// Real local browser -> guarded automation-rule removal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55987, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-rule-remove-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('rule_remove_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/rule_remove_browser`;
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


  const first=await call(P+'/automations',{name:'First rule',trigger:'key.created',action:'task.create',config:{title:'Never fired first'},enabled:false},token);
  const other=await call(P+'/automations',{name:'Other rule',trigger:'key.created',action:'task.create',config:{title:'Never fired other'},enabled:false},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=startRemoveRule-${first.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let deletes=0,reads=0,patches=0,held,refuse=true,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='PATCH')patches++;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/automations`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='DELETE'&&path===`/api${P}/automations/${first.id}`){deletes++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=id=>page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).removeRule({id}),id);
  await direct(first.id);check('unconfirmed direct rule removal makes no request',deletes===0&&reads===0);if(failures)throw new Error('Rule confirmation guard absent');
  await click('startRemoveRule-'+other.id);await direct(first.id);check('wrong target confirmation does not authorize removal',deletes===0);await click('cancelRemoveRule-'+other.id);
  await click('startRemoveRule-'+first.id);await page.screenshot({path:'/downloads/settings-rule-remove-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(`[name=confirmRemoveRule-${first.id}]`,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-rule-remove-confirm-mobile.png'});await page.setViewport({width:1280,height:900});await click('cancelRemoveRule-'+first.id);await direct(first.id);check('cancel requires new explicit matching confirmation',deletes===0&&!!await page.$(`[name=startRemoveRule-${first.id}]`));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newRuleName.set('Unsent rule');c.newRuleTitle.set('Next title');c.name.set('Other draft');});await settle();await click('startRemoveRule-'+first.id);await click('confirmRemoveRule-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains confirmation drafts and saved rule without reload',deletes===1&&reads===0&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingRule()===id&&c.error()==='Permission denied'&&!c.ruleRemoveNotice();},first.id)&&(await call(P+'/automations',null,token)).length===2);
  refuse=false;failRead=true;await click('confirmRemoveRule-'+first.id);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Rule DELETE not held');await direct(first.id);await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.cancelRemoveRule();c.askRemoveRule(id);c.toggleRule({id,enabled:false});},other.id);await settle();check('held removal blocks duplicate cancel and other target start',deletes===2&&patches===0&&await page.$eval(`[name=toggleRule-${other.id}]`,e=>e.disabled)&&await page.$eval(`[name=confirmRemoveRule-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=cancelRemoveRule-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=startRemoveRule-${other.id}]`,e=>e.disabled)&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).confirmingRule()===id,first.id));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(first.id);await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).askRemoveRule(id),first.id);const rules=await call(P+'/automations',null,token);check('accepted removal503 removes target locally and on server without retry or stale rule',deletes===2&&rules.length===1&&rules[0].id===other.id&&!await page.$(`[name=startRemoveRule-${first.id}]`)&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.autoRules().length===1&&c.autoRules()[0].id===id&&c.confirmingRule()===null&&c.error()==='Refresh failed'&&c.newRuleName()==='Unsent rule'&&c.newRuleTitle()==='Next title'&&c.name()==='Other draft'&&c.ruleRemoveNotice().includes('was removed');},other.id));
  check('remaining rule stays disabled and no enable request is made',patches===0&&rules.every(r=>!r.enabled));
  check('only selected rule row is deleted',await prisma.automationRule.count({where:{id:first.id}})===0&&await prisma.automationRule.count({where:{id:other.id}})===1);
  await page.$eval('[name=settingsRuleRemoveNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-rule-remove-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsRuleRemoveNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/settings-rule-remove-mobile.png'});check('390px accepted removal receipt fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('no tasks translations or webhook deliveries',await prisma.task.count()===0&&await prisma.translation.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no rule removal runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
