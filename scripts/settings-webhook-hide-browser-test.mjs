// Real local browser -> settings local signing-secret reveal hide -> built API + Postgres.
// No external provider requests. Requires nx build api.
import {createHash} from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56038, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-webhook-hide-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('webhook_hide_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/webhook_hide_browser`;
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


  // Disposable local webhooks only. No event-triggering writes or external delivery.
  // No signing secret bytes in logs or screenshots.
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=hookUrl]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,heldRead,holdRead=true,failRead=false,failWrite=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(path===`/api${P}/webhooks`&&holdRead){heldRead=req;return;}}if(path.startsWith('/api/')&&['POST','PATCH','PUT','DELETE'].includes(req.method())){writes++;if(path===`/api${P}/webhooks`&&req.method()==='POST'){if(failWrite)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}}req.continue();});
  const replace=async(value)=>{await page.$eval('[name=hookUrl]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
  const poll=async(kind)=>{for(let n=0;n<150;n++){if(kind==='write'?held:heldRead)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Webhook request not held: '+kind);};
  const submit=()=>page.$eval('[name=createSettingsWebhook]',e=>e.form.requestSubmit());
  const done=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  check('no hide control before one-time reveal',!await page.$('[name=hideCreatedWebhook]'));
  await replace('https://first.example/hook');await submit();await poll('write');await replace('https://newer.example/hook');await held.continue();await poll('read');
  check('accepted reveal visible while list refresh pending with Hide available',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.busy()&&!!c.createdWebhook()?.secret;})&&await page.$('[name=hideCreatedWebhook]')&&await page.$eval('[name=settingsWebhookRevealScope]',e=>e.textContent.includes('does not delete or disable')&&e.textContent.includes('clipboard')));
  check('created webhook remains active with stored signing key',await page.evaluate(()=>!!ng.getComponent(document.querySelector('ol-settings')).createdWebhook()?.id)&&(await call(P+'/webhooks',null,token))[0].active===true);
  await page.setViewport({width:390,height:844});check('actual one-time signing secret and Hide fit at390px before screenshot redaction',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=hideCreatedWebhook]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});
  // Screenshots redact only disposable test-secret DOM text, never print bytes.
  await page.evaluate(()=>{for(const e of document.querySelectorAll('.token-reveal code'))e.textContent='R'.repeat(e.textContent.length);});
  await page.$eval('[name=hideCreatedWebhook]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-webhook-hide-control-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('.token-reveal',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-webhook-hide-control-mobile.png'});await page.setViewport({width:1280,height:900});
  const savedBeforeHide=await prisma.webhook.findFirstOrThrow({where:{projectId:project.id}});const secretDigest=createHash('sha256').update(savedBeforeHide.secret).digest('hex');savedBeforeHide.secret='';
  const counts=[reads,writes];await page.click('[name=hideCreatedWebhook]');await page.waitForSelector('[name=settingsWebhookRevealNotice]');
  check('Hide clears signal and DOM with no request and keeps newer draft',reads===counts[0]&&writes===counts[1]&&!await page.$('[name=hideCreatedWebhook]')&&!await page.$('.token-reveal')&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.createdWebhook()===null&&c.hookUrl()==='https://newer.example/hook'&&c.hookTranslationUpdated()===true&&c.busy();}));
  check('hidden receipt says not deleted disabled rotated or cleared and draft receipt no longer claims reveal above',await page.$eval('[name=settingsWebhookRevealNotice]',e=>e.textContent.includes('not deleted or disabled')&&e.textContent.includes('not rotated')&&e.textContent.includes('not cleared'))&&await page.$eval('[name=settingsWebhookDraftNotice]',e=>e.textContent.includes('hidden signing-secret reveal belonged')&&!e.textContent.includes('secret above')));
  if(failures)throw new Error('Local webhook hide did not clear the reveal');
  holdRead=false;await heldRead.continue();await done();let hooks=await call(P+'/webhooks',null,token);
  check('successful held refresh cannot restore reveal or delete saved webhook',hooks.length===1&&hooks[0].url==='https://first.example/hook'&&hooks[0].active===true&&!('secret' in hooks[0])&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).createdWebhook()===null)&&!await page.$('.token-reveal'));
  const savedAfterHide=await prisma.webhook.findUniqueOrThrow({where:{id:hooks[0].id}});check('Hide preserves exact stored signing secret and active webhook state',savedAfterHide.active&&createHash('sha256').update(savedAfterHide.secret).digest('hex')===secretDigest);savedAfterHide.secret='';
  await page.$eval('[name=settingsWebhookRevealNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-webhook-hide-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsWebhookRevealNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-webhook-hide-mobile.png'});
  check('390px hidden status and draft receipt fit without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsWebhookRevealNotice]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.$eval('[name=settingsWebhookDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  await page.$eval('[name=discardSettingsWebhookUrl]',e=>e.click());await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));check('discard after hide keeps hidden status and truthful accepted receipt',await page.$eval('[name=hookUrl]',e=>e.value==='')&&await page.$eval('[name=settingsWebhookDraftNotice]',e=>e.textContent.includes('no longer shown')&&!e.textContent.includes('secret above'))&&await page.$('[name=settingsWebhookRevealNotice]'));
  held=null;heldRead=null;holdRead=true;await replace('https://second.example/hook');await submit();await poll('write');await held.continue();await poll('read');
  check('explicit later Create reveals only its new signing secret and clears hidden notice',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !!c.createdWebhook()?.secret&&c.createdWebhook().id!==id;},hooks[0].id)&&await page.$('[name=hideCreatedWebhook]')&&!await page.$('[name=settingsWebhookRevealNotice]'));
  await page.$eval('[name=hideCreatedWebhook]',e=>e.click());await page.waitForSelector('[name=settingsWebhookRevealNotice]');await heldRead.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});await done();hooks=await call(P+'/webhooks',null,token);
  check('503 after hide keeps both actual saved webhooks hidden without replay',hooks.length===2&&hooks.every(h=>h.active)&&writes===2&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.createdWebhook()===null&&c.error()==='Refresh failed';})&&!await page.$('.token-reveal'));
  const before=reads;failWrite=true;await replace('https://refused.example/hook');await submit();await done();check('refused later Create cannot restore bytes or clear hidden status',reads===before&&writes===3&&!await page.$('.token-reveal')&&await page.$('[name=settingsWebhookRevealNotice]')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied'));
  check('no unrelated tasks or webhook deliveries',await prisma.task.count()===0&&await prisma.webhookDelivery.count()===0);
  for(const t of hooks){const r=await fetch(`${API}${P}/webhooks/${t.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Demo webhook cleanup failed');}check('disposable test webhooks explicitly deleted at teardown',(await call(P+'/webhooks',null,token)).length===0);
  check('no webhook hide runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
