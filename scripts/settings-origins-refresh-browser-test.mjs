// Real local browser -> settings read-only origin list refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56082, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-origins-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('origins_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/origins_refresh_browser`;
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


  await call(P,{embedOrigins:['https://old.example','https://kept.example']},token,'PATCH');
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=refreshSettingsOrigins]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,outside=0,holdNext=false,held;
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(!['127.0.0.1','localhost'].includes(u.hostname))outside++;const path=u.pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}`&&holdNext){holdNext=false;held=r;return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsOrigins');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Origin read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).originListRefreshing());await settle();};
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.name.set('Other draft');c.description.set('Description draft');c.newLocale.set('de');c.newOrigin.set('https://draft.example');c.newRuleName.set('Unsent rule');c.newRuleLocales.set(['he']);c.mtResult.set('Earlier result');c.error.set('Independent error');window.keptProject=JSON.stringify({...c.project(),embedOrigins:[]});window.keptProviders=JSON.stringify(c.mtProviders());window.keptBranches=JSON.stringify(c.branches());});
  const kept=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.name()==='Other draft'&&c.description()==='Description draft'&&c.newLocale()==='de'&&c.newOrigin()==='https://draft.example'&&c.newRuleName()==='Unsent rule'&&JSON.stringify(c.newRuleLocales())==='["he"]'&&c.mtResult()==='Earlier result'&&c.error()==='Independent error'&&JSON.stringify({...c.project(),embedOrigins:[]})===window.keptProject&&JSON.stringify(c.mtProviders())===window.keptProviders&&JSON.stringify(c.branches())===window.keptBranches;});
  await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshOriginList());check('explicit GET once duplicates refused and previous list stays',reads===1&&writes===0&&await page.$eval('[name=refreshSettingsOrigins]',e=>e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project().embedOrigins.join()==='https://old.example,https://kept.example'));
  await call(P,{embedOrigins:['https://kept.example','https://new.example'],name:'New server name',description:'New server description'},token,'PATCH');await call(P+'/locales',{code:'fr'},token);await answer(await call(P,null,token));
  check('actual added removed origins refresh only origin list while metadata and drafts stay',await kept()&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project().embedOrigins.join()==='https://kept.example,https://new.example'));
  check('actual rendered allowlist rows changed',await page.$eval('[name=startRemoveOrigin-0]',e=>e.parentElement.textContent.includes('https://kept.example'))&&await page.$eval('[name=startRemoveOrigin-1]',e=>e.parentElement.textContent.includes('https://new.example'))&&await page.$eval('[name=refreshSettingsOrigins]',e=>!e.parentElement.textContent.includes('https://old.example')));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval('[name=refreshSettingsOrigins]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-origins-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsOrigins]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-95));await settle();await page.screenshot({path:`/downloads/settings-origins-refresh-${label}-mobile.png`});check(label+' fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.$eval('[name=newOrigin]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-origins-refresh-${label}-draft-mobile.png`});await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 retains accepted list and bounded retry feedback',await kept()&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().embedOrigins.join()==='https://kept.example,https://new.example'&&c.originListRefreshNotice().includes('could not be refreshed')&&!c.originListRefreshNotice().includes('PRIVATE');}));await capture('failure');
  await start();await answer(await call(P,null,token));check('explicit retry only reads project metadata',writes===0&&await kept());
  await call(P,{embedOrigins:[]},token,'PATCH');await start();await answer(await call(P,null,token));check('actual empty allowlist preserves unsent origin and bounded empty state',await kept()&&!await page.$('[name=startRemoveOrigin-0]')&&await page.$eval('[name=refreshSettingsOrigins]',e=>e.parentElement.textContent.includes('No origins allowlisted')));
  await call(P,{embedOrigins:['https://kept.example','https://new.example']},token,'PATCH');await start();await answer(await call(P,null,token));
  await start();await click('startRemoveOrigin-0');await answer({embedOrigins:[]});check('new real removal confirmation survives pending refresh',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingOrigin()==='https://kept.example'&&c.project().embedOrigins.join()==='https://kept.example,https://new.example'&&c.originListRefreshNotice()==='';})&&!!await page.$('[name=confirmRemoveOrigin-0]'));const before=reads;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshOriginList());check('active removal confirmation blocks captured handler',reads===before&&await page.$eval('[name=refreshSettingsOrigins]',e=>e.disabled));await click('cancelRemoveOrigin-0');
  await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project.update(p=>({...p,embedOrigins:['https://accepted.example']})));await answer(await call(P,null,token));check('accepted project replacement fences stale read and clears pending',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().embedOrigins.join()==='https://accepted.example'&&c.originListRefreshNotice()===''&&!c.originListRefreshing();}));
  for(const fail of [false,true]){await start();await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-settings')).reload(undefined,true));await answer(fail?{message:'PRIVATE LATE'}:{embedOrigins:[]},fail?503:200);check('project-only reload fences old '+(fail?'failure':'success'),await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().embedOrigins.join()==='https://kept.example,https://new.example'&&c.originListRefreshNotice()==='';}));}
  await start();await page.evaluate(()=>window.departedSettings=ng.getComponent(document.querySelector('ol-settings')));const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'{"embedOrigins":[]}'}).catch(()=>{});await settle();check('actual route departure suppresses pending feedback',await page.evaluate(()=>window.departedSettings.originListRefreshNotice()===''&&!window.departedSettings.originListRefreshing())&&!await page.$('[name=settingsOriginListRefreshNotice]'));
  check('refresh UI sends zero mutations',writes===0);
  check('refresh never contacts listed sites or outside hosts',outside===0);
  check('no translations publications tokens tasks webhooks deliveries or rules',await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no origin refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
