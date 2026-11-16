// Real local browser -> guarded custom-status removal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55990, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-status-remove-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('status_remove_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/status_remove_browser`;
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


  const first='NEEDS_WORK',other='APPROVED';
  await call(P,{customStatuses:[first,other]},token,'PATCH');
  const key=await call(P+'/keys',{name:'kept'},token);
  await call(P+`/keys/${key.id}/translations`,{locale:'he',value:'Kept text'},token,'PUT');
  await call(P+`/keys/${key.id}/translations/he/status`,{status:first},token,'PATCH');
  const priorTranslation=await prisma.translation.findFirst({where:{keyId:key.id}});
  const priorHistory=await prisma.translationHistory.count();
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=startRemoveStatus-0]');await page.waitForNetworkIdle({idleTime:200});
  let patches=0,reads=0,held,refuse=true,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='PATCH'&&path===`/api${P}`){patches++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=status=>page.evaluate(status=>ng.getComponent(document.querySelector('ol-settings')).removeStatus(status),status);
  await direct(first);check('unconfirmed direct removal sends nothing',patches===0&&reads===0);if(failures)throw new Error('Status confirmation guard absent');
  await click('startRemoveStatus-1');await direct(first);check('mismatched confirmation cannot remove another status',patches===0);await click('cancelRemoveStatus-1');
  await click('startRemoveStatus-0');await page.screenshot({path:'/downloads/settings-status-remove-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=confirmRemoveStatus-0]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-status-remove-confirm-mobile.png'});check('390px confirmation fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});await click('cancelRemoveStatus-0');await direct(first);check('cancel requires new explicit confirmation',patches===0&&!!await page.$('[name=startRemoveStatus-0]'));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newStatus.set('NEXT_STATUS');c.name.set('Other project draft');c.newRuleTitle.set('Next rule');});await settle();await click('startRemoveStatus-0');await click('confirmRemoveStatus-0');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains statuses confirmation and drafts without reload',patches===1&&reads===0&&await page.evaluate(first=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().customStatuses.length===2&&c.confirmingStatus()===first&&c.error()==='Permission denied'&&c.newStatus()==='NEXT_STATUS'&&!c.statusRemoveNotice();},first)&&(await call(P,null,token)).customStatuses.length===2);
  refuse=false;failRead=true;await click('confirmRemoveStatus-0');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Status PATCH not held');await direct(first);await page.evaluate(other=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.cancelRemoveStatus();c.askRemoveStatus(other);c.addStatus();},other);await settle();check('held update blocks duplicate cancel other confirmation and add status',patches===2&&await page.$eval('[name=confirmRemoveStatus-0]',e=>e.disabled)&&await page.$eval('[name=cancelRemoveStatus-0]',e=>e.disabled)&&await page.$eval('[name=startRemoveStatus-1]',e=>e.disabled)&&await page.$eval('[name=addSettingsStatus]',e=>e.disabled)&&await page.evaluate(first=>ng.getComponent(document.querySelector('ol-settings')).confirmingStatus()===first,first));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(first);await page.evaluate(first=>ng.getComponent(document.querySelector('ol-settings')).askRemoveStatus(first),first);const saved=await call(P,null,token);check('accepted503 saves remaining custom-status list locally and on server without stale retry',patches===2&&JSON.stringify(saved.customStatuses)===JSON.stringify([other])&&await page.evaluate(other=>{const c=ng.getComponent(document.querySelector('ol-settings'));return JSON.stringify(c.project().customStatuses)===JSON.stringify([other])&&c.confirmingStatus()===null&&c.error()==='Refresh failed'&&c.statusRemoveNotice().includes('custom-status list was saved')&&c.newStatus()==='NEXT_STATUS'&&c.name()==='Other project draft'&&c.newRuleTitle()==='Next rule';},other));
  check('actual database contains accepted remaining custom-status list',JSON.stringify((await prisma.project.findUnique({where:{id:project.id}})).customStatuses)===JSON.stringify([other]));
  await page.$eval('[name=settingsStatusRemoveNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-status-remove-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsStatusRemoveNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-status-remove-mobile.png'});check('390px accepted receipt fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  held=null;await click('startRemoveStatus-0');await click('confirmRemoveStatus-0');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Final status PATCH not held');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('final status removal saves empty custom-status list and accurate local state',(await call(P,null,token)).customStatuses.length===0&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().customStatuses.length===0&&c.confirmingStatus()===null&&c.statusRemoveNotice().includes('custom-status list was saved')&&c.error()==='Refresh failed';}));
  await call(P,{customStatuses:[first]},token,'PATCH');await page.evaluate(first=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.project.update(p=>({...p,customStatuses:[first]}));c.name.set('Still unsent');c.newStatus.set('NEWER_STATUS');},first);await settle();failRead=false;held=null;const previousReads=reads;await click('startRemoveStatus-0');await click('confirmRemoveStatus-0');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Success-refresh PATCH not held');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('successful project-only refresh preserves independent drafts and receipt',reads===previousReads+1&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().customStatuses.length===0&&c.newStatus()==='NEWER_STATUS'&&c.name()==='Still unsent'&&c.newRuleTitle()==='Next rule'&&c.statusRemoveNotice().includes('custom-status list was saved')&&c.error()==='';}));
  const afterTranslation=await prisma.translation.findFirst({where:{keyId:key.id}});
  check('translation carrying removed status and its history remain byte-for-byte unchanged',JSON.stringify(afterTranslation)===JSON.stringify(priorTranslation)&&afterTranslation.status===first&&await prisma.translationHistory.count()===priorHistory);
  check('no tasks extra translations or webhook deliveries',await prisma.task.count()===0&&await prisma.translation.count()===1&&await prisma.webhookDelivery.count()===0);
  check('no status removal runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
