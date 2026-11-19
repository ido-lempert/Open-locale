// Real local browser -> settings read-only origin list refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56084, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-general-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('general_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/general_refresh_browser`;
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


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=refreshSettingsGeneralMetadata]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,holdNext=false,held;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}`&&holdNext){holdNext=false;held=r;return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsGeneralMetadata');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('General metadata read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).generalMetadataRefreshing());await settle();};
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.name.set('Unsent name');c.description.set('Unsent description');c.newLocale.set('de');c.newStatus.set('UNSENT');c.newRuleName.set('Unsent rule');c.newRuleLocales.set(['he']);c.mtResult.set('Earlier result');c.error.set('Independent error');window.keptProject=JSON.stringify({...c.project(),name:'',description:''});window.keptProviders=JSON.stringify(c.mtProviders());window.keptBranches=JSON.stringify(c.branches());});
  const otherKept=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.newLocale()==='de'&&c.newStatus()==='UNSENT'&&c.newRuleName()==='Unsent rule'&&JSON.stringify(c.newRuleLocales())==='["he"]'&&c.mtResult()==='Earlier result'&&c.error()==='Independent error'&&JSON.stringify({...c.project(),name:'',description:''})===window.keptProject&&JSON.stringify(c.mtProviders())===window.keptProviders&&JSON.stringify(c.branches())===window.keptBranches;});
  const inputs=()=>page.$eval('[name=name]',e=>e.value).then(async name=>name==='Unsent name'&&await page.$eval('[name=description]',e=>e.value)==='Unsent description');
  await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshGeneralMetadata());check('explicit GET once duplicates refused and loaded values stay pending',reads===1&&writes===0&&await page.$eval('[name=refreshSettingsGeneralMetadata]',e=>e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project().name==='Sync browser'));
  await call(P,{name:'Server name',description:'Server description',customStatuses:['NEW']},token,'PATCH');await call(P+'/locales',{code:'fr'},token);await answer(await call(P,null,token));
  check('actual server details refresh loaded values only preserving current inputs and other state',await otherKept()&&await inputs()&&await page.evaluate(()=>{const p=ng.getComponent(document.querySelector('ol-settings')).project();return p.name==='Server name'&&p.description==='Server description';}));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval('[name=refreshSettingsGeneralMetadata]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-95));await settle();await page.screenshot({path:`/downloads/settings-general-metadata-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsGeneralMetadata]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-95));await settle();await page.screenshot({path:`/downloads/settings-general-metadata-refresh-${label}-mobile.png`});check(label+' fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 preserves loaded details and inputs with bounded feedback',await otherKept()&&await inputs()&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().name==='Server name'&&c.generalMetadataRefreshNotice().includes('could not be refreshed')&&!c.generalMetadataRefreshNotice().includes('PRIVATE');}));await capture('failure');
  await start();await answer(await call(P,null,token));check('explicit retry only reads and preserves drafts',writes===0&&await otherKept()&&await inputs());
  await click('discardSettingsGeneral');check('explicit Discard now uses newly loaded details without save',await page.$eval('[name=name]',e=>e.value==='Server name')&&await page.$eval('[name=description]',e=>e.value==='Server description')&&await otherKept()&&writes===0);
  await start();await call(P,{name:'Newer server',description:'Newer description'},token,'PATCH');await answer(await call(P,null,token));check('pristine current inputs also remain until explicit Discard',await page.$eval('[name=name]',e=>e.value==='Server name')&&await page.$eval('[name=description]',e=>e.value==='Server description')&&await page.$eval('[name=discardSettingsGeneral]',e=>!e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project().name==='Newer server'));
  await start();await page.$eval('[name=name]',e=>{e.value='Typed during refresh';e.dispatchEvent(new Event('input',{bubbles:true}));});await answer(await call(P,null,token));check('real input typing during held read remains unsaved',await page.$eval('[name=name]',e=>e.value==='Typed during refresh')&&writes===0);
  await start();await click('discardSettingsGeneral');await answer({name:'STALE',description:'STALE'});check('explicit discard during held read fences old metadata',await page.$eval('[name=name]',e=>e.value==='Newer server')&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().name==='Newer server'&&c.generalMetadataRefreshNotice()==='';}));
  await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project.update(p=>({...p,name:'Accepted'})));await answer(await call(P,null,token));check('accepted project replacement fences stale read and clears pending',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().name==='Accepted'&&c.generalMetadataRefreshNotice()===''&&!c.generalMetadataRefreshing();}));
  for(const fail of [false,true]){await start();await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-settings')).reload(undefined,true));await answer(fail?{message:'PRIVATE LATE'}:{name:'STALE',description:'STALE'},fail?503:200);check('project-only reload fences old '+(fail?'failure':'success'),await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().name==='Newer server'&&c.generalMetadataRefreshNotice()==='';}));}
  await start();await page.evaluate(()=>window.departedSettings=ng.getComponent(document.querySelector('ol-settings')));const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'{"name":"STALE","description":"STALE"}'}).catch(()=>{});await settle();check('actual route departure suppresses pending feedback',await page.evaluate(()=>window.departedSettings.generalMetadataRefreshNotice()===''&&!window.departedSettings.generalMetadataRefreshing())&&!await page.$('[name=settingsGeneralMetadataRefreshNotice]'));
  check('refresh and local Discard UI send zero mutations',writes===0);
  check('no translations publications tokens tasks webhooks deliveries or rules',await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no general metadata refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
