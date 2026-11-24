// Real local browser -> settings read-only locale list refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_LOCALE_TEST_PG_PORT ?? 56077), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-locales-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('locales_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/locales_refresh_browser`;
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


  const provider=await call(P+'/mt/providers',{name:'Offline fixture',type:'pseudo'},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=refreshSettingsLocales]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,holdNext=false,held;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}`&&holdNext){holdNext=false;held=r;return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsLocales');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Locale metadata read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).localeListRefreshing());await settle();};
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.name.set('Other draft');c.description.set('Description draft');c.newLocale.set('de');c.newRuleName.set('Unsent rule');c.newRuleLocales.set(['he']);c.mtResult.set('Earlier pseudo result');c.error.set('Independent error');window.keptProject=JSON.stringify({...c.project(),locales:[]});window.keptProviders=JSON.stringify(c.mtProviders());window.keptBranches=JSON.stringify(c.branches());});
  const kept=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.name()==='Other draft'&&c.description()==='Description draft'&&c.newLocale()==='de'&&c.newRuleName()==='Unsent rule'&&JSON.stringify(c.newRuleLocales())==='["he"]'&&c.mtLocale()==='he'&&c.mtBranch()==='main'&&c.mtResult()==='Earlier pseudo result'&&c.error()==='Independent error'&&JSON.stringify({...c.project(),locales:[]})===window.keptProject&&JSON.stringify(c.mtProviders())===window.keptProviders&&JSON.stringify(c.branches())===window.keptBranches;});
  await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshLocaleList());check('explicit GET once and duplicates refused while prior list stays',reads===1&&writes===0&&await page.$eval('[name=refreshSettingsLocales]',e=>e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project().locales.length===2));
  await call(P+'/locales',{code:'fr'},token);await call(P,{name:'New server name',description:'New server description'},token,'PATCH');await answer(await call(P,null,token));
  check('actual added locale refresh updates locales only preserving other server metadata and drafts',await kept()&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project().locales.some(l=>l.code==='fr'))&&await page.$eval('[name=mtLocale]',e=>[...e.options].some(o=>o.value==='fr')));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval('[name=refreshSettingsLocales]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-locales-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsLocales]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await settle();await page.screenshot({path:`/downloads/settings-locales-refresh-${label}-mobile.png`});check(label+' feedback fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 retains locales and drafts with bounded retry feedback',await kept()&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().locales.length===3&&c.localeListRefreshNotice().includes('could not be refreshed')&&!c.localeListRefreshNotice().includes('PRIVATE');}));await capture('failure');
  await start();await answer(await call(P,null,token));check('explicit retry only reads project metadata',writes===0&&await kept());
  await call(P+'/locales/he',null,token,'DELETE');await start();await answer(await call(P,null,token));check('actually removed selected target remains explicit in Fill empty and checked rule choice',await kept()&&await page.$eval('[name=mtLocale]',e=>e.value==='he'&&e.selectedOptions[0]?.textContent.includes('not in loaded target locales'))&&await page.$eval('[name=missingRuleLoc-he]',e=>e.checked)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project().locales.length===2));
  await call(P+'/locales',{code:'he'},token);await start();await answer(await call(P,null,token));check('returned actual target clears missing display without replacing selections',await kept()&&!await page.$('[name=settingsMtLocaleMissing]')&&!await page.$('[name=settingsRuleLocalesMissing]')&&await page.$eval('[name=ruleLoc-he]',e=>e.checked));
  await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project.update(p=>({...p,locales:[{code:'en'},{code:'new'}]})));await answer(await call(P,null,token));check('accepted project replacement fences older locale response and clears pending',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().locales.some(l=>l.code==='new')&&c.localeListRefreshNotice()===''&&!c.localeListRefreshing();}));
  for(const fail of [false,true]){await start();await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-settings')).reload(undefined,true));await answer(fail?{message:'PRIVATE LATE'}:{locales:[]},fail?503:200);check('project-only reload fences old locale '+(fail?'failure':'success'),await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().locales.length===3&&c.localeListRefreshNotice()==='';}));}
  await start();await click('startRemoveLocale-he');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer({locales:[]});check('new real removal preview fences pending refresh without dropping confirmation',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingLocale()==='he'&&c.project().locales.length===3&&c.localeListRefreshNotice()===''&&!c.localeListRefreshing();}));await click('cancelRemoveLocale-he');
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).confirmingLocale.set('he'));const before=reads;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshLocaleList());check('active locale removal confirmation blocks captured refresh',reads===before&&await page.$eval('[name=refreshSettingsLocales]',e=>e.disabled));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).confirmingLocale.set(null));
  await start();await page.evaluate(()=>window.departedSettings=ng.getComponent(document.querySelector('ol-settings')));const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'{"locales":[]}'}).catch(()=>{});await settle();check('actual route departure suppresses pending feedback',await page.evaluate(()=>window.departedSettings.localeListRefreshNotice()===''&&!window.departedSettings.localeListRefreshing())&&!await page.$('[name=settingsLocaleListRefreshNotice]'));
  check('refresh UI sent no mutations',writes===0);
  await call(P+'/mt/providers/'+provider.id,null,token,'DELETE');
  check('no translations publications tokens tasks webhooks deliveries or rules',await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no locale refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
