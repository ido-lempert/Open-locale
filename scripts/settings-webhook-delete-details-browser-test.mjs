// Real local browser -> guarded webhook deletion -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56120, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
let completed=false;process.on('exit',()=>{if(!completed)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-webhook-delete-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('webhook_delete_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/webhook_delete_browser`;
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


  const first=await call(P+'/webhooks',{url:'https://example.com/first',events:['translation.updated']},token);
  const other=await call(P+'/webhooks',{url:'https://example.com/first',events:['translation.updated']},token);
  for(const h of [first,other])await prisma.webhookDelivery.create({data:{webhookId:h.id,event:'translation.updated',httpStatus:200,success:true,attempts:1,durationMs:1}}); // seeded history, no delivery sent
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=startDeleteHook-${first.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let deletes=0,reads=0,held,refuse=true,failRead=false;const readPaths=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;readPaths.push(path);if(failRead&&path===`/api${P}/webhooks`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='DELETE'&&path===`/api${P}/webhooks/${first.id}`){deletes++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=id=>page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).removeHook(id),id);
  await direct(first.id);check('unconfirmed direct webhook delete makes no request',deletes===0&&reads===0);if(failures)throw new Error('Webhook confirmation guard absent');
  await click('startDeleteHook-'+other.id);await direct(first.id);check('wrong target confirmation does not authorize delete',deletes===0);await click('cancelDeleteHook-'+other.id);
  await click('startDeleteHook-'+first.id);
  const originalHooks=await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).webhooks());
  const events=['project.restored','<img>'+ 'X'.repeat(300),'translation.updated','project.restored'];const longUrl='https://example.com/'+ 'Y'.repeat(300)+'?literal=<img>';
  await page.evaluate(({id,events,longUrl})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.webhooks.set(c.webhooks().map(h=>h.id===id?{...h,events,url:longUrl,active:false}:h));c.hookUrl.set('Unsent draft');c.hookDeleteNotice.set('Earlier receipt');c.error.set('Independent error');},{id:first.id,events,longUrl});await settle();
  check('exact selected webhook ID endpoint and loaded state displayed',await page.$eval('[name=settingsWebhookDeleteId]',e=>e.textContent)===first.id&&await page.$eval('[name=settingsWebhookDeleteUrl]',e=>e.textContent)===longUrl&&await page.$eval('[name=settingsWebhookDeleteState]',e=>e.textContent)==='disabled');
  check('full escaped event list preserves order duplicates and long raw names',JSON.stringify(await page.$$eval('[name=settingsWebhookDeleteEvents] li',es=>es.map(e=>e.textContent)))===JSON.stringify(events)&&await page.$eval('[name=settingsWebhookDeleteDetails]',e=>!e.querySelector('img,a')));
  check('read-only details preserve drafts receipts errors and no effects',reads===0&&deletes===0&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.hookUrl()==='Unsent draft'&&c.hookDeleteNotice()==='Earlier receipt'&&c.error()==='Independent error';}));
  check('explicit local ownership delivery secret and duplicate-registration limits',await page.$eval('[name=settingsWebhookDeleteDetails]',e=>e.textContent.includes('not a read of newer server values')&&e.textContent.includes('does not contact the endpoint')&&e.textContent.includes('copy a signing secret')&&e.textContent.includes('not other registrations at the same URL')));
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.webhooks.set(c.webhooks().map(h=>h.id===id?{...h,events:[],active:true}:h));},first.id);await settle();check('replacement list reflects empty events and enabled state without requests',!!await page.$('[name=settingsWebhookDeleteNoEvents]')&&!await page.$('[name=settingsWebhookDeleteEvents]')&&await page.$eval('[name=settingsWebhookDeleteState]',e=>e.textContent)==='enabled'&&reads===0&&deletes===0);
  await page.evaluate(({id,events})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.webhooks.set(c.webhooks().map(h=>h.id===id?{...h,events,active:false}:h));},{id:first.id,events});await settle();await page.$eval('[name=settingsWebhookDeleteDetails]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-60));await page.screenshot({path:'/downloads/settings-webhook-delete-details-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(`[name=confirmDeleteHook-${first.id}]`,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-webhook-delete-details-confirm-mobile.png'});check('390px loaded webhook details fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.$eval('[name=settingsWebhookDeleteDetails]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-60));await page.screenshot({path:'/downloads/settings-webhook-delete-details-confirm-mobile-top.png'});await page.setViewport({width:1280,height:900});await page.evaluate(rows=>ng.getComponent(document.querySelector('ol-settings')).webhooks.set(rows),originalHooks);await settle();await click('cancelDeleteHook-'+first.id);await direct(first.id);check('cancel requires new explicit matching confirmation',deletes===0&&!!await page.$(`[name=startDeleteHook-${first.id}]`));
  await page.evaluate(({id,secret})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.createdWebhook.set({id,secret});c.hookUrl.set('https://example.com/unsent');c.name.set('Other draft');},{id:first.id,secret:first.secret});await settle();await click('startDeleteHook-'+first.id);await click('confirmDeleteHook-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains confirmation reveal and saved webhook without reload',deletes===1&&reads===0&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingHook()===id&&c.createdWebhook()?.id===id&&c.error()==='Permission denied'&&!c.hookDeleteNotice();},first.id)&&(await call(P+'/webhooks',null,token)).length===2);
  refuse=false;failRead=true;await click('confirmDeleteHook-'+first.id);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Webhook DELETE not held');await direct(first.id);await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.cancelDeleteHook();c.askDeleteHook(id);},other.id);await settle();check('held delete blocks duplicate cancel and other target start',deletes===2&&await page.$eval(`[name=confirmDeleteHook-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=cancelDeleteHook-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=startDeleteHook-${other.id}]`,e=>e.disabled)&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).confirmingHook()===id,first.id));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(first.id);await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).askDeleteHook(id),first.id);const hooks=await call(P+'/webhooks',null,token);check('accepted delete503 removes target locally and on server without retry or stale secret',deletes===2&&hooks.length===1&&hooks[0].id===other.id&&!await page.$(`[name=startDeleteHook-${first.id}]`)&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.webhooks().length===1&&c.webhooks()[0].id===id&&c.createdWebhook()===null&&c.confirmingHook()===null&&c.error()==='Refresh failed'&&c.hookUrl()==='https://example.com/unsent'&&c.name()==='Other draft'&&c.hookDeleteNotice().includes('were deleted');},other.id));
  check('delete cascades only selected seeded history and keeps other history',await prisma.webhookDelivery.count({where:{webhookId:first.id}})===0&&await prisma.webhookDelivery.count({where:{webhookId:other.id}})===1);
  await page.$eval('[name=settingsHookDeleteNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-webhook-delete-details-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsHookDeleteNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/settings-webhook-delete-details-mobile.png'});check('390px accepted deletion receipt fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('failed delete refresh reads webhooks only',reads===1&&readPaths.every(p=>p===`/api${P}/webhooks`));
  failRead=false;
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.name.set('Retained name');c.description.set('Retained description');c.hookUrl.set('https://example.com/next');c.hookTranslationUpdated.set(false);c.hookProjectRestored.set(true);c.newRuleName.set('Next rule');c.createdWebhook.set({id:'local-display-only',secret:'synthetic-display-only'});});await settle();
  await page.setViewport({width:1280,height:900});await click('startDeleteHook-'+other.id);await click('confirmDeleteHook-'+other.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  check('successful delete refresh keeps unrelated drafts and nonmatching display',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.webhooks().length===0&&c.name()==='Retained name'&&c.description()==='Retained description'&&c.hookUrl()==='https://example.com/next'&&!c.hookTranslationUpdated()&&c.hookProjectRestored()&&c.newRuleName()==='Next rule'&&c.createdWebhook()?.id==='local-display-only'&&c.error()===''&&c.hookDeleteNotice().includes('were deleted');}));
  check('successful delete uses webhooks-only read and deletes other seeded history',reads===2&&readPaths.every(p=>p===`/api${P}/webhooks`)&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no tasks translations or emitted deliveries after explicit second delete',await prisma.task.count()===0&&await prisma.translation.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no webhook delete runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
completed=failures===0;process.exit(failures?1:0);
