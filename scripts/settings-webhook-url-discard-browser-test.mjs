// Real local browser -> settings pending member draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_WEBHOOK_TEST_PG_PORT ?? 55974), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-webhook-draft-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('webhook_draft_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/webhook_draft_browser`;
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


  // Hosts are stored only. No event-triggering writes or outbound deliveries.
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=hookUrl]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/webhooks`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(path.startsWith('/api/')&&['POST','PATCH','PUT','DELETE'].includes(req.method())){writes++;if(req.method()==='POST'&&path===`/api${P}/webhooks`){held=req;return;}}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const replace=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Webhook POST not held');};
  const done=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  check('empty URL discard disabled',await page.$eval('[name=discardSettingsWebhookUrl]',e=>e.disabled));
  await replace('hookUrl','INVALID URL');await replace('name','Other project draft');await click('hookEvTx');await click('hookEvRestore');await click('discardSettingsWebhookUrl');check('invalid URL cleared locally while events and other form stay',writes===0&&reads===0&&await page.$eval('[name=hookUrl]',e=>e.value==='')&&await page.$eval('[name=name]',e=>e.value==='Other project draft')&&await page.$eval('[name=hookEvTx]',e=>!e.checked)&&await page.$eval('[name=hookEvRestore]',e=>e.checked));if(failures)throw new Error('URL discard absent');
  await replace('hookUrl','https://first.example/hook');await click('createSettingsWebhook');await poll();await replace('hookUrl','https://next.example/hook');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).discardWebhookUrlDraft());check('pending create blocks button and direct discard preserving newer URL',writes===1&&await page.$eval('[name=discardSettingsWebhookUrl]',e=>e.disabled)&&await page.$eval('[name=hookUrl]',e=>e.value==='https://next.example/hook'));await held.continue();await done();
  const beforeReads=reads,beforeWrites=writes;const savedId=await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).createdWebhook().id);await click('discardSettingsWebhookUrl');let hooks=await call(P+'/webhooks',null,token);check('discard keeps actual webhook events and submitted secret without requests or stale retained claim',hooks.length===1&&hooks[0].id===savedId&&hooks[0].url==='https://first.example/hook'&&JSON.stringify(hooks[0].events)==='["project.restored"]'&&reads===beforeReads&&writes===beforeWrites&&await page.$eval('[name=hookUrl]',e=>e.value==='')&&await page.$eval('[name=settingsWebhookDraftNotice]',e=>e.textContent.includes('URL draft was discarded')&&!e.textContent.includes('kept here'))&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.createdWebhook().id===id&&c.createdWebhook().secret.length>=24&&!c.hookTranslationUpdated()&&c.hookProjectRestored();},savedId));
  held=null;failRead=true;await replace('hookUrl','https://saved.example/hook');await click('createSettingsWebhook');await poll();await replace('hookUrl','https://unsent.example/hook');await held.continue();await done();const failedReads=reads,failedWrites=writes;await click('discardSettingsWebhookUrl');hooks=await call(P+'/webhooks',null,token);check('503 reset preserves accepted webhook reveal error and events without requests',hooks.length===2&&hooks.some(h=>h.url==='https://saved.example/hook')&&!hooks.some(h=>h.url==='https://unsent.example/hook')&&reads===failedReads&&writes===failedWrites&&await page.$eval('[name=hookUrl]',e=>e.value==='')&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.error()==='Refresh failed'&&c.createdWebhook().id&&c.createdWebhook().secret.length>=24&&!c.hookTranslationUpdated()&&c.hookProjectRestored();})&&await page.$eval('[name=settingsWebhookDraftNotice]',e=>e.textContent.includes('URL draft was discarded')));
  await replace('hookUrl','New invalid URL');await page.evaluate(()=>{for(const e of document.querySelectorAll('.token-reveal code'))e.textContent='[local fixture signing secret hidden]';});await page.$eval('[name=discardSettingsWebhookUrl]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-webhook-url-discard-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=discardSettingsWebhookUrl]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-webhook-url-discard-mobile.png'});check('390px URL discard and receipt fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsWebhookDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  check('no deliveries enqueued or attempted',await prisma.webhookDelivery.count()===0);
  check('no URL discard runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
