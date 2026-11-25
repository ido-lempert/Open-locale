// Real local browser -> settings read-only pseudo provider metadata refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_MISSING_GUARD_TEST_PG_PORT ?? 56071), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mt-provider-missing-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('mt_provider_missing_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/mt_provider_missing_browser`;
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


  const first=await call(P+'/mt/providers',{name:'Chosen offline provider',type:'pseudo'},token);
  const second=await call(P+'/mt/providers',{name:'Other offline provider',type:'pseudo'},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=mtProviderId]');await page.waitForNetworkIdle({idleTime:200});
  await page.select('[name=mtProviderId]',first.id);await page.select('[name=newRuleProvider]',first.id);
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.mtResult.set('Earlier pseudo result');c.newRuleName.set('Unsent rule');c.name.set('Other draft');});
  let reads=0,writes=0,failNext=false;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}/mt/providers`&&failNext){failNext=false;r.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE RAW ERROR"}'});return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const refresh=async()=>{await page.$eval('[name=refreshSettingsMtProviders]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=refreshSettingsMtProviders]');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).mtProviderListRefreshing());await settle();};
  const exact=async id=>await page.$eval('[name=mtProviderId]',(e,id)=>e.value===id&&e.selectedOptions[0]?.textContent.includes('not in loaded providers'),id)&&await page.$eval('[name=newRuleProvider]',(e,id)=>e.value===id&&e.selectedOptions[0]?.textContent.includes('not in loaded providers'),id);
  const retained=()=>page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviderId()===id&&c.newRuleProvider()===id&&c.mtResult()==='Earlier pseudo result'&&c.newRuleName()==='Unsent rule'&&c.name()==='Other draft';},first.id);
  check('loaded exact provider has no missing options or warnings',!await page.$('[name=settingsMtProviderMissing]')&&!await page.$('[name=settingsRuleProviderMissing]')&&await page.$eval('[name=mtProviderId]',e=>![...e.options].some(o=>o.textContent.includes('not in loaded providers'))));
  await call(P+'/mt/providers/'+first.id,null,token,'DELETE');await refresh();
  check('actual external deletion keeps exact missing ID in both real selectors',await exact(first.id)&&await retained());
  check('both missing warnings explain kept choice and bounded scope',await page.$eval('[name=settingsMtProviderMissing]',e=>e.textContent.includes('not replaced')&&e.textContent.includes('not a current availability'))&&await page.$eval('[name=settingsRuleProviderMissing]',e=>e.textContent.includes('not replaced')&&e.textContent.includes('not repair saved rules')));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval(`[name=${label==='fill'?'settingsMtProviderMissing':'settingsRuleProviderMissing'}]`,e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-mt-provider-missing-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval(`[name=${label==='fill'?'settingsMtProviderMissing':'settingsRuleProviderMissing'}]`,e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await settle();await page.screenshot({path:`/downloads/settings-mt-provider-missing-${label}-mobile.png`});check(label+' warning fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});};
  await capture('fill');await capture('rule');
  failNext=true;await refresh();check('503 keeps explicit missing choices and bounded feedback',await exact(first.id)&&await retained()&&await page.$eval('[name=settingsMtProviderListRefreshNotice]',e=>e.textContent.includes('could not be refreshed')&&!e.textContent.includes('PRIVATE')));
  await refresh();check('explicit retry keeps IDs and no writes',await exact(first.id)&&await retained()&&writes===0);
  await page.select('[name=mtProviderId]',second.id);await settle();check('explicit Fill empty choice clears only its warning',!await page.$('[name=settingsMtProviderMissing]')&&!!await page.$('[name=settingsRuleProviderMissing]')&&await page.$eval('[name=newRuleProvider]',(e,id)=>e.value===id,first.id));
  await page.select('[name=newRuleProvider]',second.id);await settle();check('explicit rule choice clears its warning without saving or running',!await page.$('[name=settingsRuleProviderMissing]')&&writes===0);
  await call(P+'/mt/providers/'+second.id,null,token,'DELETE');await refresh();
  check('empty snapshot keeps Fill empty warning while hidden form and exact rule option remain',!!await page.$('[name=settingsMtProviderMissing]')&&!await page.$('[name=mtProviderId]')&&!!await page.$('[name=settingsRuleProviderMissing]')&&await page.$eval('[name=newRuleProvider]',(e,id)=>e.value===id&&e.selectedOptions[0]?.textContent.includes('not in loaded providers'),second.id));
  await page.select('[name=newRuleAction]','task.create');await settle();check('inactive rule action hides only provider warning and keeps stored provider',!await page.$('[name=settingsRuleProviderMissing]')&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).newRuleProvider()===id,second.id));
  check('only expected metadata reads and no UI writes',reads===4&&writes===0);
  check('no provider translation publication token task webhook delivery or rule remains',await prisma.mtProvider.count()===0&&await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no missing-choice runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
