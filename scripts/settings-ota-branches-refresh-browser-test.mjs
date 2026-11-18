// Real local browser -> settings read-only OTA publish branch choices refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56065, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ota-branches-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('ota_branches_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/ota_branches_refresh_browser`;
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


  const provider=await call(P+'/mt/providers',{name:'Offline fixture only',type:'pseudo'},token);
  const chosen=await call(P+'/branches',{name:'chosen-branch'},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=otaBranch]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,holdNext=false,held;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}/branches`&&holdNext){holdNext=false;held=r;return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await settle();await page.click(`[name=${name}]`);await settle();};
  const field=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsOtaBranches');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Branch choices read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).otaBranchesRefreshing());await settle();};
  await field('name','Other draft');await field('newRuleName','Unsent rule');await page.select('[name=otaBranch]','chosen-branch');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.otaNotice.set('Earlier publish receipt');c.error.set('Independent error');c.otaListRefreshNotice.set('Independent publication feedback');window.originalPublications=JSON.stringify(c.otaPubs());window.originalMtBranches=JSON.stringify(c.branches());});
  const counts=[reads,writes];await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshOtaBranches());check('explicit branch GET once and duplicate button/handler refuse',reads===counts[0]+1&&writes===counts[1]&&await page.$eval('[name=refreshSettingsOtaBranches]',e=>e.disabled));
  await call(P+'/branches',{name:'external-branch'},token);await answer(await call(P+'/branches',null,token));
  check('real added branch preserves selection receipt publications drafts and independent state',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.otaPublishBranches().length===3&&c.otaPublishBranches().some(p=>p.name==='external-branch')&&c.otaBranch()==='chosen-branch'&&c.otaNotice()==='Earlier publish receipt'&&c.error()==='Independent error'&&c.name()==='Other draft'&&c.newRuleName()==='Unsent rule'&&JSON.stringify(c.otaPubs())===window.originalPublications&&c.otaListRefreshNotice()==='Independent publication feedback';}));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval('[name=refreshSettingsOtaBranches]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-ota-branches-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsOtaBranches]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await settle();await page.screenshot({path:`/downloads/settings-ota-branches-refresh-${label}-mobile.png`});check(label+' choice status fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsOtaBranchesRefreshNotice]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 retains previous choices selection receipt and bounded retry',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.otaPublishBranches().length===3&&c.otaBranch()==='chosen-branch'&&c.otaNotice()==='Earlier publish receipt'&&c.error()==='Independent error'&&c.otaBranchesRefreshNotice().includes('could not be refreshed')&&!c.otaBranchesRefreshNotice().includes('PRIVATE');}));await capture('failure');
  await start();await answer(await call(P+'/branches',null,token));check('explicit retry remains read-only',writes===counts[1]);
  await call(P+'/branches/'+chosen.id,null,token,'DELETE');await start();await answer(await call(P+'/branches',null,token));check('actually removed selected branch remains visible without fallback or Publish',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.otaPublishBranches().length===2&&c.otaBranch()==='chosen-branch'&&c.otaBranchMissing()&&c.otaNotice()==='Earlier publish receipt';})&&await page.$eval('[name=otaBranch]',e=>e.value==='chosen-branch'&&e.selectedOptions[0].textContent.includes('not in loaded choices'))&&!!await page.$('[name=settingsOtaBranchMissing]')&&writes===counts[1]);
  check('missing OTA selection never inserts an OTA-only option into pre-translation branches',await page.$eval('[name=mtBranch]',e=>![...e.options].some(o=>o.textContent.includes('not in loaded choices'))&&e.value==='main')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).mtBranch()==='main'&&JSON.stringify(ng.getComponent(document.querySelector('ol-settings')).branches())===window.originalMtBranches));
  await start();await answer([]);check('empty choices keep missing selection full drafts and literal read-only scope',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.otaPublishBranches().length===0&&c.otaBranch()==='chosen-branch'&&c.name()==='Other draft'&&c.newRuleName()==='Unsent rule';})&&await page.$eval('#settingsOtaBranchRefreshScope',e=>e.textContent.includes('not create, merge or delete')&&e.textContent.includes('not replaced')));
  for(const fail of [false,true]) {const old=await call(P+'/branches',null,token);await start();await call(P+'/branches',{name:fail?'reload-failure':'reload-success'},token);await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-settings'));await c.reload();});await answer(fail?{message:'PRIVATE LATE ERROR'}:old,fail?503:200);check('full reload fences old branch '+(fail?'failure':'success'),await page.evaluate(name=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.otaPublishBranches().some(p=>p.name===name)&&c.otaBranchesRefreshNotice()==='';},fail?'reload-failure':'reload-success'));}
  await start();await page.evaluate(()=>window.departedSettings=ng.getComponent(document.querySelector('ol-settings')));const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'[]'}).catch(()=>{});await settle();check('actual route departure suppresses pending choice feedback',await page.evaluate(()=>window.departedSettings.otaBranchesRefreshNotice()===''&&!window.departedSettings.otaBranchesRefreshing())&&!await page.$('[name=settingsOtaBranchesRefreshNotice]'));
  await call(P+'/mt/providers/'+provider.id,null,token,'DELETE');
  check('no publications translations effects providers tokens tasks webhooks deliveries or rules',await prisma.otaPublication.count()===0&&await prisma.translation.count()===0&&await prisma.mtProvider.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);check('no choice refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
