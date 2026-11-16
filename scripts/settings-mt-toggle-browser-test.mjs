// Real local browser -> guarded pseudo-provider enabled state -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55996, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mt-toggle-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('mt_toggle_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/mt_toggle_browser`;
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


  const first=await call(P+'/mt/providers',{name:'First provider',type:'pseudo'},token);
  const other=await call(P+'/mt/providers',{name:'Other provider',type:'pseudo'},token);
  const rule=await call(P+'/automations',{name:'Saved disabled rule',trigger:'translation.value',action:'pretranslate',config:{providerId:first.id,locales:['he']},enabled:false},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=startRemoveMtProvider-${first.id}]`);await page.waitForNetworkIdle({idleTime:200});
  const savedProviders=JSON.stringify(await prisma.mtProvider.findMany({orderBy:{id:'asc'},select:{id:true,name:true,type:true,config:true,createdAt:true}})),savedRules=JSON.stringify(await prisma.automationRule.findMany({orderBy:{id:'asc'}}));
  let patches=0,reads=0,held,refuse=true,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/mt/providers`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='PATCH'&&path===`/api${P}/mt/providers/${first.id}`){patches++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=(id,enabled)=>page.evaluate(({id,enabled})=>ng.getComponent(document.querySelector('ol-settings')).toggleMtProvider({id,enabled}),{id,enabled});
  await direct('missing',true);check('missing provider state change makes no request',patches===0&&reads===0);
  await direct(first.id,false);check('stale loaded enabled state makes no request',patches===0&&reads===0);if(failures)throw new Error('Provider state guard absent');
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.mtProviderId.set(id);c.newMtName.set('Unsent provider');c.newRuleTitle.set('Next title');c.name.set('Other draft');},first.id);await settle();await click('toggleMtProvider-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains enabled state selection and forms without reload',patches===1&&reads===0&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviders().find(h=>h.id===id).enabled&&c.mtProviderId()===id&&c.error()==='Permission denied'&&!c.mtToggleNotice();},first.id));
  refuse=false;failRead=true;await click('toggleMtProvider-'+first.id);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Provider PATCH not held');await direct(first.id,true);await direct(other.id,true);await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.askRemoveMtProvider(id);},first.id);await settle();check('held enabled change blocks duplicate other target and delete',patches===2&&await page.$eval(`[name=toggleMtProvider-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=toggleMtProvider-${other.id}]`,e=>e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).confirmingMtProvider()===null));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(first.id,true);const hooks=await call(P+'/mt/providers',null,token);check('accepted disable503 updates local and server state without stale replay',patches===2&&reads===1&&!hooks.find(h=>h.id===first.id).enabled&&hooks.find(h=>h.id===other.id).enabled&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.mtProviders().find(h=>h.id===id).enabled&&c.error()==='Refresh failed'&&c.mtToggleNotice().includes('disabled');},first.id));
  check('accepted disable keeps selection drafts and saved rule',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviderId()===id&&c.newMtName()==='Unsent provider'&&c.newRuleTitle()==='Next title'&&c.name()==='Other draft';},first.id)&&savedRules===JSON.stringify(await prisma.automationRule.findMany({orderBy:{id:'asc'}})));
  await page.$eval('[name=settingsMtToggleNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-mt-toggle-disabled-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsMtToggleNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/settings-mt-toggle-disabled-mobile.png'});check('390px disabled receipt fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  failRead=false;held=null;await click('toggleMtProvider-'+first.id);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Provider enable PATCH not held');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('explicit fresh enable changes only submitted enabled state and providers-only refresh',patches===3&&reads===2&&(await call(P+'/mt/providers',null,token)).find(h=>h.id===first.id).enabled&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviders().find(h=>h.id===id).enabled&&c.mtToggleNotice().includes('enabled')&&c.newMtName()==='Unsent provider'&&c.name()==='Other draft';},first.id));
  await page.setViewport({width:1280,height:900});await page.$eval('[name=settingsMtToggleNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-mt-toggle-enabled-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsMtToggleNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/settings-mt-toggle-enabled-mobile.png'});
  check('disable and enable preserve provider metadata and saved rule bytes',savedProviders===JSON.stringify(await prisma.mtProvider.findMany({orderBy:{id:'asc'},select:{id:true,name:true,type:true,config:true,createdAt:true}}))&&savedRules===JSON.stringify(await prisma.automationRule.findMany({orderBy:{id:'asc'}})));
  check('no tasks translations or emitted deliveries or Fill empty effects',await prisma.task.count()===0&&await prisma.translation.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no pseudo-provider enabled state runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
