// Real local browser -> settings read-only custom-status list refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56079, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-statuses-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('statuses_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/statuses_refresh_browser`;
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


  await call(P,{customStatuses:['OLD','KEPT']},token,'PATCH');
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=refreshSettingsStatuses]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,holdNext=false,held;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}`&&holdNext){holdNext=false;held=r;return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsStatuses');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Custom-status read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).statusListRefreshing());await settle();};
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.name.set('Other draft');c.description.set('Description draft');c.newLocale.set('de');c.newStatus.set('unsent status');c.newRuleName.set('Unsent rule');c.newRuleLocales.set(['he']);c.mtResult.set('Earlier result');c.error.set('Independent error');window.keptProject=JSON.stringify({...c.project(),customStatuses:[]});window.keptProviders=JSON.stringify(c.mtProviders());window.keptBranches=JSON.stringify(c.branches());});
  const kept=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.name()==='Other draft'&&c.description()==='Description draft'&&c.newLocale()==='de'&&c.newStatus()==='unsent status'&&c.newRuleName()==='Unsent rule'&&JSON.stringify(c.newRuleLocales())==='["he"]'&&c.mtResult()==='Earlier result'&&c.error()==='Independent error'&&JSON.stringify({...c.project(),customStatuses:[]})===window.keptProject&&JSON.stringify(c.mtProviders())===window.keptProviders&&JSON.stringify(c.branches())===window.keptBranches;});
  await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshStatusList());check('explicit GET once duplicates refused and previous list stays',reads===1&&writes===0&&await page.$eval('[name=refreshSettingsStatuses]',e=>e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project().customStatuses.join()==='OLD,KEPT'));
  await call(P,{customStatuses:['KEPT','NEW'],name:'New server name',description:'New server description'},token,'PATCH');await call(P+'/locales',{code:'fr'},token);await answer(await call(P,null,token));
  check('actual added removed statuses refresh only custom list while metadata and drafts stay',await kept()&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project().customStatuses.join()==='KEPT,NEW'));
  check('actual rendered custom rows changed and base statuses remain',await page.$eval('[name=startRemoveStatus-0]',e=>e.parentElement.textContent.includes('kept'))&&await page.$eval('[name=startRemoveStatus-1]',e=>e.parentElement.textContent.includes('new'))&&await page.$eval('[name=refreshSettingsStatuses]',e=>{const t=e.parentElement.textContent;return t.includes('unverified')&&t.includes('translated')&&t.includes('reviewed')&&!t.includes('>old<');}));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval('[name=refreshSettingsStatuses]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-statuses-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsStatuses]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-95));await settle();await page.screenshot({path:`/downloads/settings-statuses-refresh-${label}-mobile.png`});check(label+' fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 retains accepted list and bounded retry feedback',await kept()&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().customStatuses.join()==='KEPT,NEW'&&c.statusListRefreshNotice().includes('could not be refreshed')&&!c.statusListRefreshNotice().includes('PRIVATE');}));await capture('failure');
  await start();await answer(await call(P,null,token));check('explicit retry only reads project metadata',writes===0&&await kept());
  await call(P,{customStatuses:[]},token,'PATCH');await start();await answer(await call(P,null,token));check('actual empty custom list leaves base statuses and unsent draft unchanged',await kept()&&!await page.$('[name=startRemoveStatus-0]')&&await page.$eval('[name=refreshSettingsStatuses]',e=>e.parentElement.textContent.includes('base statuses, always available')));
  await call(P,{customStatuses:['KEPT','NEW']},token,'PATCH');await start();await answer(await call(P,null,token));
  await start();await click('startRemoveStatus-0');await answer({customStatuses:[]});check('new real removal confirmation survives pending refresh',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingStatus()==='KEPT'&&c.project().customStatuses.join()==='KEPT,NEW'&&c.statusListRefreshNotice()==='';})&&!!await page.$('[name=confirmRemoveStatus-0]'));const before=reads;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshStatusList());check('active removal confirmation blocks captured handler',reads===before&&await page.$eval('[name=refreshSettingsStatuses]',e=>e.disabled));await click('cancelRemoveStatus-0');
  await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project.update(p=>({...p,customStatuses:['ACCEPTED']})));await answer(await call(P,null,token));check('accepted project replacement fences stale read and clears pending',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().customStatuses.join()==='ACCEPTED'&&c.statusListRefreshNotice()===''&&!c.statusListRefreshing();}));
  for(const fail of [false,true]){await start();await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-settings')).reload(undefined,true));await answer(fail?{message:'PRIVATE LATE'}:{customStatuses:[]},fail?503:200);check('project-only reload fences old '+(fail?'failure':'success'),await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().customStatuses.join()==='KEPT,NEW'&&c.statusListRefreshNotice()==='';}));}
  await start();await page.evaluate(()=>window.departedSettings=ng.getComponent(document.querySelector('ol-settings')));const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'{"customStatuses":[]}'}).catch(()=>{});await settle();check('actual route departure suppresses pending feedback',await page.evaluate(()=>window.departedSettings.statusListRefreshNotice()===''&&!window.departedSettings.statusListRefreshing())&&!await page.$('[name=settingsStatusListRefreshNotice]'));
  check('refresh UI sends zero mutations',writes===0);
  check('no translations publications tokens tasks webhooks deliveries or rules',await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no custom-status refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
