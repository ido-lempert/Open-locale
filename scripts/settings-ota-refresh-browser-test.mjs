// Real local browser -> settings read-only OTA publication metadata refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_METADATA_GUARD_TEST_PG_PORT ?? 56063), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ota-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('ota_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/ota_refresh_browser`;
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


  await call(P+'/import/en',{entries:{title:'Fixture publication content'}},token);
  const first=await call(P+'/ota/publish',{branch:'main'},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=otaBranch]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,bundleReads=0,holdNext=false,held,holdPublish=false,heldPublish;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path.startsWith(`/api${P}/ota/`))bundleReads++;if(path===`/api${P}/ota`&&holdNext){holdNext=false;held=r;return;}}else {writes++;if(path===`/api${P}/ota/publish`&&holdPublish){holdPublish=false;heldPublish=r;return;}}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await settle();await page.click(`[name=${name}]`);await settle();};
  const field=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsOta');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Publication metadata read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).otaListRefreshing());await settle();};
  await field('name','Other draft');await field('newRuleName','Unsent rule');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.otaNotice.set('Earlier publish receipt');c.error.set('Independent error');window.originalBranches=JSON.stringify(c.branches());});
  const counts=[reads,writes];await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshOtaList());check('explicit metadata read once and duplicate button/handler refuse',reads===counts[0]+1&&writes===counts[1]&&await page.$eval('[name=refreshSettingsOta]',e=>e.disabled));
  await call(P+'/ota/publish',{branch:'main'},token);await answer(await call(P+'/ota',null,token));
  check('real newer publications preserve selected branch receipt all drafts and independent state',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.otaPubs().length===2&&c.otaPubs().some(p=>p.version===2)&&c.otaBranch()==='main'&&c.otaNotice()==='Earlier publish receipt'&&c.error()==='Independent error'&&c.name()==='Other draft'&&c.newRuleName()==='Unsent rule'&&JSON.stringify(c.branches())===window.originalBranches&&c.otaListRefreshNotice().includes('does not verify');}));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval('[name=refreshSettingsOta]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-ota-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsOta]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-95));await settle();await page.screenshot({path:`/downloads/settings-ota-refresh-${label}-mobile.png`});check(label+' metadata status fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsOtaListRefreshNotice]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 retains previous publications branch receipt and bounded retry',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.otaPubs().length===2&&c.otaBranch()==='main'&&c.otaNotice()==='Earlier publish receipt'&&c.error()==='Independent error'&&c.otaListRefreshNotice().includes('could not be refreshed')&&!c.otaListRefreshNotice().includes('PRIVATE');}));await capture('failure');
  await start();await answer(await call(P+'/ota',null,token));check('explicit retry stays read-only without bundle fetch',writes===counts[1]&&bundleReads===0&&await page.$eval('[name=settingsOtaListRefreshNotice]',e=>e.textContent.includes('was refreshed')));
  for(const fail of [false,true]) {
    const old=await call(P+'/ota',null,token);await start();heldPublish=null;holdPublish=true;const priorWrites=writes;await click('publishSettingsOta');for(let n=0;n<150&&!heldPublish;n++)await new Promise(r=>setTimeout(r,20));if(!heldPublish)throw new Error('Explicit publish not held');
    await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).publishOta());check('actual pending publish refuses duplicate handler '+fail,writes===priorWrites+1&&await page.$eval('[name=publishSettingsOta]',e=>e.disabled));await heldPublish.continue();heldPublish=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(fail?{message:'PRIVATE LATE ERROR'}:old,fail?503:200);
    const saved=await call(P+'/ota',null,token);check('late metadata '+(fail?'failure':'success')+' cannot replace actual newer publish or add feedback',await page.evaluate(saved=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.otaPubs().length===saved.length&&c.otaPubs()[0].id===saved[0].id&&c.otaNotice().includes('Published main v'+saved[0].version)&&c.otaListRefreshNotice()==='';},saved));
  }
  await prisma.otaPublication.deleteMany({where:{projectId:project.id}});await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).otaBranch.set('missing-retained-choice'));await start();await answer(await call(P+'/ota',null,token));check('empty retained snapshot preserves missing selection earlier receipt and literal limits',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.otaPubs().length===0&&c.otaBranch()==='missing-retained-choice'&&c.otaNotice().includes('Published main v4')&&c.name()==='Other draft'&&c.newRuleName()==='Unsent rule';})&&await page.$eval('#settingsOtaListRefreshScope',e=>e.textContent.includes('not a complete release history')&&e.textContent.includes('no longer retained')));
  await start();await page.evaluate(()=>window.departedSettings=ng.getComponent(document.querySelector('ol-settings')));const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'[]'}).catch(()=>{});await settle();check('actual route departure suppresses pending metadata feedback',await page.evaluate(()=>window.departedSettings.otaListRefreshNotice()===''&&!window.departedSettings.otaListRefreshing())&&!await page.$('[name=settingsOtaListRefreshNotice]'));
  check('no bundles fetched or effects providers tokens tasks webhooks deliveries rules remain',bundleReads===0&&await prisma.mtProvider.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0&&await prisma.otaPublication.count()===0);check('no metadata runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
