// Real local browser -> settings read-only origin list refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56088, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-saml-info-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('saml_info_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/saml_info_refresh_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',SAML_ENTRY_POINT:'https://idp.example.com/sso',SAML_IDP_CERT:'display-only-fixture-cert',SAML_IDP_ENTITY_ID:'https://idp.example.com/idp',SAML_SP_ENTITY_ID:'open-locale-fixture',PORT:String(API_PORT)},stdio:'pipe'});
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


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=refreshSettingsSaml]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,external=0,holdNext=false,held;
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(!['127.0.0.1','localhost'].includes(u.hostname))external++;if(u.pathname.startsWith('/api/')){if(r.method()==='GET'){reads++;if(u.pathname==='/api/auth/saml/sp-info'&&holdNext){holdNext=false;held=r;return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsSaml');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('SAML metadata read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).samlInfoRefreshing());await settle();};
  const actual=await call('/auth/saml/sp-info',null,token);check('actual local API configured display metadata available without IdP sign-in',actual.configured&&actual.entityId==='open-locale-fixture');
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.name.set('Unsent name');c.description.set('Unsent description');c.newLocale.set('de');c.newStatus.set('UNSENT');c.newRuleName.set('Unsent rule');c.newRuleLocales.set(['he']);c.mtResult.set('Earlier result');c.error.set('Independent error');c.samlInfo.set({configured:false});window.keptProject=JSON.stringify(c.project());window.keptProviders=JSON.stringify(c.mtProviders());window.keptBranches=JSON.stringify(c.branches());});
  const kept=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.name()==='Unsent name'&&c.description()==='Unsent description'&&c.newLocale()==='de'&&c.newStatus()==='UNSENT'&&c.newRuleName()==='Unsent rule'&&JSON.stringify(c.newRuleLocales())==='["he"]'&&c.mtResult()==='Earlier result'&&c.error()==='Independent error'&&JSON.stringify(c.project())===window.keptProject&&JSON.stringify(c.mtProviders())===window.keptProviders&&JSON.stringify(c.branches())===window.keptBranches;});
  await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshSamlInfo());check('explicit GET once duplicates refused previous display stays pending',reads===1&&writes===0&&await page.$eval('[name=refreshSettingsSaml]',e=>e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).samlInfo().configured===false));await answer(actual);
  check('actual SAML metadata refresh updates only display preserving drafts and results',await kept()&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).samlInfo().entityId==='open-locale-fixture')&&await page.$eval('#settingsSamlRefreshScope',e=>e.textContent.includes('not save configuration')));
  const capture=async label=>{for(const [size,width,height] of [['desktop',1280,900],['mobile',390,844]]){await page.setViewport({width,height});await page.$eval('[name=refreshSettingsSaml]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-100));await settle();await page.screenshot({path:`/downloads/settings-saml-refresh-${label}-${size}.png`});check(label+' '+size+' fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 retains prior display and all drafts with bounded retry feedback',await kept()&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.samlInfo().entityId==='open-locale-fixture'&&c.samlInfoRefreshNotice().includes('could not')&&!c.samlInfoRefreshNotice().includes('PRIVATE');}));await capture('failure');await start();await answer(await call('/auth/saml/sp-info',null,token));check('explicit retry reads only without IdP contact',await kept()&&writes===0&&external===0);
  await start();await answer({configured:false});check('unconfigured response replaces prior configured metadata only',await kept()&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.samlInfo().configured===false&&!c.samlInfo().entityId;})&&!await page.$eval('ol-settings',e=>e.textContent.includes('open-locale-fixture')));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).samlInfo.set(null));await settle();check('missing metadata not mislabeled as unconfigured or permanently loading',await page.$eval('[name=settingsSamlInfoUnloaded]',e=>e.textContent.includes('does not mean SAML is unconfigured')));await start();await answer(actual);check('explicit read recovers missing metadata without full Settings reload',await kept()&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).samlInfo().entityId==='open-locale-fixture'));
  await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).samlInfo.set({configured:true,entityId:'accepted-fixture'}));await answer({configured:false});check('replacement metadata fences stale response and clears pending',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.samlInfo().entityId==='accepted-fixture'&&c.samlInfoRefreshNotice()===''&&!c.samlInfoRefreshing();}));
  for(const fail of [false,true]){await start();await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-settings')).reload(undefined,true));await answer(fail?{message:'PRIVATE LATE'}:{configured:false},fail?503:200);check('project-only reload fences old '+(fail?'failure':'success'),await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.samlInfo().entityId==='accepted-fixture'&&c.samlInfoRefreshNotice()==='';}));}
  for(const fail of [false,true]){await start();await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-settings')).reload());await answer(fail?{message:'PRIVATE LATE'}:{configured:false},fail?503:200);check('full Settings reload fences older '+(fail?'failure':'success'),await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.samlInfo().entityId==='open-locale-fixture'&&c.samlInfoRefreshNotice()==='';}));}
  await start();await page.evaluate(()=>window.departedSettings=ng.getComponent(document.querySelector('ol-settings')));const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'{"configured":false}'}).catch(()=>{});await settle();check('actual route departure suppresses pending display feedback',await page.evaluate(()=>window.departedSettings.samlInfoRefreshNotice()===''&&!window.departedSettings.samlInfoRefreshing())&&!await page.$('[name=settingsSamlInfoRefreshNotice]'));
  check('UI zero mutations and zero external contact',writes===0&&external===0);
  check('no translations publications tokens tasks webhooks deliveries or rules',await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no SAML refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
