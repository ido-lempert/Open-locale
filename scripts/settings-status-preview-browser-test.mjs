// Real local browser -> read-only custom-status Add preview -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56106, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
let completed=false;
process.on('exit',()=>{if(!completed)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-status-preview-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('status_preview_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/status_preview_browser`;
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


  await call(P,{customStatuses:['KEPT']},token,'PATCH');
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=newStatus]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,held,refuse=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET')reads++;else{writes++;if(path===`/api${P}`){payloads.push(JSON.parse(r.postData()));if(refuse)return r.respond({status:403,contentType:'application/json',body:JSON.stringify({message:'Permission denied'})});held=r;return;}}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const replace=async value=>{await page.$eval('[name=newStatus]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const entries=()=>page.$$eval('[name=settingsStatusPreviewEntries] li',es=>es.map(e=>e.textContent));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.statusDraftNotice.set('Earlier receipt');c.error.set('Independent error');c.name.set('Other draft');});await replace(' next ');
  check('preview matches trimmed uppercase name plus loaded ordered list',JSON.stringify(await entries())==='["KEPT","NEXT"]'&&await page.$eval('[name=settingsStatusNormalized]',e=>e.textContent==='NEXT')&&await page.$eval('[name=newStatus]',e=>e.value===' next '));
  check('preview zero read/write preserves earlier receipt error and other draft',reads===0&&writes===0&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.error()==='Independent error'&&c.statusDraftNotice()==='Earlier receipt'&&c.name()==='Other draft';}));
  const capture=async label=>{await page.keyboard.press('Escape');for(const [size,width,height]of [['desktop',1280,900],['mobile',390,844]]){await page.setViewport({width,height});await page.$eval('[name=settingsStatusPreview]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-85));await settle();await page.screenshot({path:`/downloads/settings-status-preview-${label}-${size}.png`});check(label+' '+size+' fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.setViewport({width:1280,height:900});};await capture('valid');
  await replace(' kept ');check('duplicate entry shown twice as sent without dedup or save',JSON.stringify(await entries())==='["KEPT","KEPT"]'&&writes===0&&reads===0);
  await replace('<img src=x onerror=alert(1)>');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addStatus());check('invalid escaped normalized markup retains raw and guard/no effects',await page.$eval('[name=settingsStatusNormalized]',e=>e.textContent==='<IMG SRC=X ONERROR=ALERT(1)>'&&!e.querySelector('img'))&&await page.$eval('[name=newStatus]',e=>e.value==='<img src=x onerror=alert(1)>')&&writes===0&&reads===0&&await page.$eval('[name=addSettingsStatus]',e=>e.disabled));
  await replace('x'.repeat(300));await capture('invalid');
  check('long full preview not truncated and explicit invalid/not-saved limits',await page.$eval('[name=settingsStatusNormalized]',e=>e.textContent==='X'.repeat(300))&&!!await page.$('[name=settingsStatusPreviewInvalid]')&&await page.$eval('#settingsStatusPreviewScope',e=>e.textContent.includes('not a conflict-checked merge')&&e.textContent.includes('Nothing is saved')));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project.update(p=>({...p,customStatuses:['NEWLY_LOADED']})));await settle();check('loaded list replacement updates preview without replacing raw draft',JSON.stringify(await entries())===JSON.stringify(['NEWLY_LOADED','X'.repeat(300)])&&writes===0&&reads===0);
  await page.$eval('[name=discardSettingsStatus]',e=>e.click());await settle();check('existing Discard clears draft and preview only',JSON.stringify(await entries())==='["NEWLY_LOADED","(empty)"]'&&await page.$eval('[name=newStatus]',e=>e.value==='')&&writes===0&&reads===0);
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project.update(p=>({...p,customStatuses:[]})));await replace(' ready ');check('empty loaded list preview has only normalized draft',JSON.stringify(await entries())==='["READY"]');
  await page.$eval('[name=addSettingsStatus]',e=>e.form.requestSubmit());for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Status not held');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addStatus());check('existing Add sends exact preview once and busy guard holds',writes===1&&JSON.stringify(payloads[0])==='{"customStatuses":["READY"]}'&&await page.$eval('[name=addSettingsStatus]',e=>e.disabled));await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await settle();
  check('real saved replacement read refresh and draft clear reflected',JSON.stringify((await call(P,null,token)).customStatuses)==='["READY"]'&&reads===1&&JSON.stringify(await entries())==='["READY","(empty)"]');
  await replace('later');refuse=true;const before=reads;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addStatus());await settle();check('server refusal keeps preview and raw draft without GET',reads===before&&JSON.stringify(await entries())==='["READY","LATER"]'&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied'));
  check('no translations keys tasks rules publications tokens webhooks deliveries',await prisma.translation.count()===0&&await prisma.key.count()===0&&await prisma.automationRule.count()===0&&await prisma.task.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no status preview runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
completed=failures===0;
process.exit(failures?1:0);
