// Real local browser -> settings read-only pseudo provider metadata refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56059, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mt-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('mt_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/mt_refresh_browser`;
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


  const first=await call(P+'/mt/providers',{name:'First pseudo provider',type:'pseudo'},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=newMtName]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,holdNext=false,held;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}/mt/providers`&&holdNext){holdNext=false;held=r;return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await settle();await page.click(`[name=${name}]`);await settle();};
  const field=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsMtProviders');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Provider metadata read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).mtProviderListRefreshing());await settle();};
  await field('newMtName','Unsent provider');await field('name','Other draft');await page.select('[name=mtProviderId]',first.id);await page.select('[name=mtLocale]','he');await page.select('[name=newRuleProvider]',first.id);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.error.set('Independent error');c.mtDraftNotice.set('Earlier accepted create');c.mtToggleNotice.set('Earlier toggle');c.mtRemoveNotice.set('Earlier remove');c.mtResult.set('Earlier pseudo result');});
  const counts=[reads,writes];await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshMtProviderList());check('explicit provider metadata read once and duplicate button/handler refuse',reads===counts[0]+1&&writes===counts[1]&&await page.$eval('[name=refreshSettingsMtProviders]',e=>e.disabled));
  await call(P+'/mt/providers',{name:'External pseudo provider',type:'pseudo'},token);await answer(await call(P+'/mt/providers',null,token));
  check('real updated list preserves draft type choices results receipts and independent state',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviders().length===2&&c.newMtName()==='Unsent provider'&&c.newMtType()==='pseudo'&&c.mtProviderId()===id&&c.mtLocale()==='he'&&c.mtBranch()==='main'&&c.mtResult()==='Earlier pseudo result'&&c.newRuleProvider()===id&&c.mtDraftNotice()==='Earlier accepted create'&&c.mtToggleNotice()==='Earlier toggle'&&c.mtRemoveNotice()==='Earlier remove'&&c.error()==='Independent error'&&c.name()==='Other draft'&&c.mtProviderListRefreshNotice().includes('not a provider availability or health check');},first.id));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval('[name=refreshSettingsMtProviders]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-mt-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsMtProviders]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await settle();await page.screenshot({path:`/downloads/settings-mt-refresh-${label}-mobile.png`});check(label+' provider metadata status fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsMtProviderListRefreshNotice]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 retains previous list drafts choices results and bounded retry',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviders().length===2&&c.newMtName()==='Unsent provider'&&c.mtProviderId()===id&&c.newRuleProvider()===id&&c.mtResult()==='Earlier pseudo result'&&c.error()==='Independent error'&&c.mtProviderListRefreshNotice().includes('could not be refreshed')&&!c.mtProviderListRefreshNotice().includes('PRIVATE');},first.id));await capture('failure');
  await start();await answer(await call(P+'/mt/providers',null,token));check('explicit retry stays read-only',writes===counts[1]&&await page.$eval('[name=settingsMtProviderListRefreshNotice]',e=>e.textContent.includes('was refreshed')));
  const beforeToggle=await call(P+'/mt/providers',null,token);await start();await click('toggleMtProvider-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeToggle);check('late metadata cannot reverse actual explicit provider disable',!(await call(P+'/mt/providers',null,token)).find(p=>p.id===first.id).enabled&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.mtProviders().find(p=>p.id===id).enabled&&c.mtProviderListRefreshNotice()==='';},first.id));
  const beforeCreate=await call(P+'/mt/providers',null,token);await start();await field('newMtName','Later created pseudo provider');await click('addSettingsMtProvider');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeCreate);check('late metadata cannot erase actual explicit provider Add',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviders().some(p=>p.name==='Later created pseudo provider')&&c.mtProviderListRefreshNotice()==='';}));
  const beforeDelete=await call(P+'/mt/providers',null,token);await start();await click('startRemoveMtProvider-'+first.id);await click('confirmRemoveMtProvider-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeDelete);check('late metadata cannot resurrect actually removed provider',!(await call(P+'/mt/providers',null,token)).some(p=>p.id===first.id)&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.mtProviders().some(p=>p.id===id)&&c.mtProviderListRefreshNotice()==='';},first.id));
  // External disappearance leaves exact stored choices unchanged, never selecting a replacement.
  const kept=(await call(P+'/mt/providers',null,token))[0];await page.select('[name=mtProviderId]',kept.id);await page.select('[name=newRuleProvider]',kept.id);for(const p of await call(P+'/mt/providers',null,token))await call(P+'/mt/providers/'+p.id,null,token,'DELETE');await start();await answer(await call(P+'/mt/providers',null,token));check('empty snapshot keeps absent choices and earlier result with explicit limits',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviders().length===0&&c.mtProviderId()===id&&c.newRuleProvider()===id&&c.mtResult()==='Earlier pseudo result';},kept.id)&&await page.$eval('#settingsMtProviderListRefreshScope',e=>e.textContent.includes('no longer listed')&&e.textContent.includes('enable real translation')));
  await start();await page.evaluate(()=>window.departedSettings=ng.getComponent(document.querySelector('ol-settings')));const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'[]'}).catch(()=>{});await settle();check('actual route departure suppresses pending provider metadata feedback',await page.evaluate(()=>window.departedSettings.mtProviderListRefreshNotice()===''&&!window.departedSettings.mtProviderListRefreshing())&&!await page.$('[name=settingsMtProviderListRefreshNotice]'));
  check('no providers tokens tasks webhooks deliveries rules or translations created remain',await prisma.mtProvider.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0&&await prisma.translation.count()===0);check('no provider metadata runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
