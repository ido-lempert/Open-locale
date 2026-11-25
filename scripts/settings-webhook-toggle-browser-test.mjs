// Real local browser -> guarded webhook active state -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_METADATA_GUARD_TEST_PG_PORT ?? 55995), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-webhook-toggle-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('webhook_toggle_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/webhook_toggle_browser`;
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


  const first=await call(P+'/webhooks',{url:'https://example.com/first',events:['translation.updated']},token);
  const other=await call(P+'/webhooks',{url:'https://example.com/other',events:['translation.updated']},token);
  for(const h of [first,other])await prisma.webhookDelivery.create({data:{webhookId:h.id,event:'translation.updated',httpStatus:200,success:true,attempts:1,durationMs:1}}); // seeded history, no delivery sent
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=startDeleteHook-${first.id}]`);await page.waitForNetworkIdle({idleTime:200});
  const savedHooks=JSON.stringify(await prisma.webhook.findMany({orderBy:{id:'asc'},select:{id:true,url:true,events:true,secret:true,createdAt:true}})),savedHistory=JSON.stringify(await prisma.webhookDelivery.findMany({orderBy:{id:'asc'}}));
  let patches=0,reads=0,held,refuse=true,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/webhooks`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='PATCH'&&path===`/api${P}/webhooks/${first.id}`){patches++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=(id,active)=>page.evaluate(({id,active})=>ng.getComponent(document.querySelector('ol-settings')).toggleHook({id,active}),{id,active});
  await direct('missing',true);check('missing webhook state change makes no request',patches===0&&reads===0);
  await direct(first.id,false);check('stale loaded active state makes no request',patches===0&&reads===0);if(failures)throw new Error('Webhook state guard absent');
  await page.evaluate(({id,secret})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.createdWebhook.set({id,secret});c.hookUrl.set('https://example.com/unsent');c.name.set('Other draft');},{id:first.id,secret:first.secret});await settle();await click('toggleHook-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains active state secret and forms without reload',patches===1&&reads===0&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.webhooks().find(h=>h.id===id).active&&c.createdWebhook()?.id===id&&c.error()==='Permission denied'&&!c.hookToggleNotice();},first.id));
  refuse=false;failRead=true;await click('toggleHook-'+first.id);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Webhook PATCH not held');await direct(first.id,true);await direct(other.id,true);await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.askDeleteHook(id);},first.id);await settle();check('held active change blocks duplicate other target and delete',patches===2&&await page.$eval(`[name=toggleHook-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=toggleHook-${other.id}]`,e=>e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).confirmingHook()===null));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(first.id,true);const hooks=await call(P+'/webhooks',null,token);check('accepted disable503 updates local and server state without stale replay',patches===2&&reads===1&&!hooks.find(h=>h.id===first.id).active&&hooks.find(h=>h.id===other.id).active&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.webhooks().find(h=>h.id===id).active&&c.error()==='Refresh failed'&&c.hookToggleNotice().includes('disabled');},first.id));
  check('accepted disable keeps secret other drafts metadata and both histories',await page.evaluate(({id,secret})=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.createdWebhook()?.id===id&&c.createdWebhook()?.secret===secret&&c.hookUrl()==='https://example.com/unsent'&&c.name()==='Other draft';},{id:first.id,secret:first.secret})&&hooks.find(h=>h.id===first.id).url===first.url&&await prisma.webhookDelivery.count()===2);
  await page.$eval('[name=settingsHookToggleNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-webhook-toggle-disabled-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsHookToggleNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/settings-webhook-toggle-disabled-mobile.png'});check('390px disabled receipt fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.$eval('.token-reveal',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-webhook-toggle-secret-mobile.png'});
  failRead=false;held=null;await click('toggleHook-'+first.id);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Webhook enable PATCH not held');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('explicit fresh enable changes only submitted active state and webhooks-only refresh',patches===3&&reads===2&&(await call(P+'/webhooks',null,token)).find(h=>h.id===first.id).active&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.webhooks().find(h=>h.id===id).active&&c.hookToggleNotice().includes('enabled')&&c.hookUrl()==='https://example.com/unsent'&&c.name()==='Other draft';},first.id));
  await page.setViewport({width:1280,height:900});await page.$eval('[name=settingsHookToggleNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-webhook-toggle-enabled-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsHookToggleNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/settings-webhook-toggle-enabled-mobile.png'});
  check('disable and enable preserve URL events signing secret and exact history bytes',savedHooks===JSON.stringify(await prisma.webhook.findMany({orderBy:{id:'asc'},select:{id:true,url:true,events:true,secret:true,createdAt:true}}))&&savedHistory===JSON.stringify(await prisma.webhookDelivery.findMany({orderBy:{id:'asc'}})));
  check('no tasks translations or emitted deliveries beyond seeded history',await prisma.task.count()===0&&await prisma.translation.count()===0&&await prisma.webhookDelivery.count()===2);
  check('no webhook active state runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
