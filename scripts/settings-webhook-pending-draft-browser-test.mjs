// Real local browser -> settings pending member draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55959, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  // No key/translation/restore/event-triggering writes. Hosts below are stored only.
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=hookUrl]');await page.waitForNetworkIdle({idleTime:200});
  let creates=0,reads=0,held,failCreate=false,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='POST'&&path===`/api${P}/webhooks`){creates++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async(value)=>page.$eval('[name=hookUrl]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Webhook request not held');};
  const submit=()=>page.$eval('[name=createSettingsWebhook]',e=>e.form.requestSubmit());
  const done=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  const setEvents=(tx,restore)=>page.evaluate((t,r)=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.hookTranslationUpdated.set(t);c.hookProjectRestored.set(r);},tx,restore);
  await replace('https://first.example/hook');await submit();await poll();await replace('https://newer.example/hook');await page.click('[name=hookEvTx]');await page.click('[name=hookEvRestore]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).createWebhook());check('pending duplicate blocked with exact original URL and event selection',creates===1&&payloads[0].url==='https://first.example/hook'&&JSON.stringify(payloads[0].events)==='["translation.updated"]');await held.continue();await done();check('successful earlier POST keeps entire newer webhook draft and explicit uncreated receipt',await page.$eval('[name=hookUrl]',e=>e.value==='https://newer.example/hook')&&await page.$eval('[name=hookEvTx]',e=>!e.checked)&&await page.$eval('[name=hookEvRestore]',e=>e.checked)&&await page.$eval('[name=settingsWebhookDraftNotice]',e=>e.textContent.includes('submitted webhook was created')&&e.textContent.includes('has not been created')&&e.textContent.includes('secret above belongs to the submitted webhook')));if(failures)throw new Error('Webhook draft preservation absent or mismatched');
  let hooks=await call(P+'/webhooks',null,token);check('only original webhook stored and one-time reveal is bound to submitted ID',hooks.length===1&&hooks[0].url==='https://first.example/hook'&&JSON.stringify(hooks[0].events)==='["translation.updated"]'&&!('secret' in hooks[0])&&await page.evaluate(id=>{const w=ng.getComponent(document.querySelector('ol-settings')).createdWebhook();return w.id===id&&typeof w.secret==='string'&&w.secret.length>=24;},hooks[0].id)&&reads>0);
  // Keep generated fixture signing secret out of screenshots; verify reveal above by ID only.
  await page.evaluate(()=>{for(const e of document.querySelectorAll('.token-reveal code'))e.textContent='[local fixture signing secret hidden]';});
  await page.$eval('[name=settingsWebhookDraftNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-webhook-pending-draft-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=hookUrl]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-webhook-pending-draft-mobile.png'});check('390px whole webhook draft and receipt fit without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsWebhookDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  const beforeNoEvents=creates;await setEvents(false,false);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).createWebhook());check('no-event direct attempt keeps receipt and sends no webhook',creates===beforeNoEvents&&await page.$('[name=settingsWebhookDraftNotice]')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Pick at least one event'));
  await setEvents(false,true);held=null;await submit();await poll();check('newer webhook submitted only on explicit second Create and receipt clears',creates===2&&payloads[1].url==='https://newer.example/hook'&&JSON.stringify(payloads[1].events)==='["project.restored"]'&&!await page.$('[name=settingsWebhookDraftNotice]'));await held.continue();await done();hooks=await call(P+'/webhooks',null,token);check('unchanged success clears URL keeps selected events and reveals actual second webhook',hooks.length===2&&await page.$eval('[name=hookUrl]',e=>e.value==='')&&await page.$eval('[name=hookEvRestore]',e=>e.checked)&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).createdWebhook().id===id,hooks.find(h=>h.url==='https://newer.example/hook').id)&&!await page.$('[name=settingsWebhookDraftNotice]'));
  const before=reads;failCreate=true;await replace('https://refused.example/hook');await submit();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('POST refusal retains draft with no created claim or refresh',reads===before&&await page.$eval('[name=hookUrl]',e=>e.value==='https://refused.example/hook')&&!await page.$('[name=settingsWebhookDraftNotice]'));
  failCreate=false;failRead=true;held=null;await replace('https://saved.example/hook');await submit();await poll();await replace('https://next.example/hook');await setEvents(true,false);await held.continue();await done();hooks=await call(P+'/webhooks',null,token);check('refresh failure preserves newer draft with accurate receipt and original DB webhook',hooks.length===3&&hooks.some(h=>h.url==='https://saved.example/hook'&&JSON.stringify(h.events)==='["project.restored"]')&&!hooks.some(h=>h.url==='https://next.example/hook'||h.url==='https://refused.example/hook')&&await page.$eval('[name=hookUrl]',e=>e.value==='https://next.example/hook')&&await page.$eval('[name=settingsWebhookDraftNotice]',e=>e.textContent.includes('submitted webhook was created')&&e.textContent.includes('has not been created'))&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed'));
  check('no webhook deliveries enqueued or attempted by draft fixture',await prisma.webhookDelivery.count()===0);
  check('no pending webhook draft runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
