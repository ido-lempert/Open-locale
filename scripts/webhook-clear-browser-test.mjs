// Real local browser -> Diagnostic history timestamp fallback -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.WEBHOOK_CLEAR_TEST_PG_PORT ?? 56296), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-snapshot-ready-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('snapshot_ready_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/snapshot_ready_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  await call(`${P}/import/en`,{entries:{title:'Local title',conflict:'Local edit',remote:'Old text',empty:''}},token);
  await call(`${P}/tasks`,{title:'Actual task recovery'},token);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);




  const hook=await prisma.webhook.create({data:{projectId:project.id,url:'https://example.com/fixture',secret:'private-fixture-secret',events:['translation.updated']}});
  const rows=[{id:'bad',event:'translation.updated',success:false,createdAt:'bad'},{id:'old',event:'translation.updated',success:false,createdAt:'2026-12-12T23:59:59.100Z'},{id:'new',event:'snapshot.restored',success:true,createdAt:'2026-12-13T02:00:00.001+02:00'},{id:'tie',event:'translation.updated',success:false,createdAt:'2026-12-13T00:00:00.001Z'},{id:'empty',event:'translation.updated',success:false,createdAt:''}].map(r=>({...r,httpStatus:r.id==='bad'||r.id==='empty'?null:r.success?204:503,attempts:1,durationMs:5}));
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname===`/api${P}/webhooks/${hook.id}/deliveries`&&req.method()==='GET'){reads++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify(rows)});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});
  await page.goto(`${WEB}${P}/webhooks/${hook.id}/deliveries`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=deliveryTime]');const ids=()=>page.$$eval('[name=deliveryTime]',es=>es.map(e=>e.getAttribute('datetime')??'bad'));
  check('Clear all starts disabled with no local filters',await page.$eval('[name=clearAllDeliveryFilters]',e=>e.disabled));
  await page.select('[name=deliveryHttpFilter]','unavailable');await page.select('[name=deliveryStatus]','succeeded');await page.select('[name=deliveryOrder]','oldest');await page.$eval('[name=deliveryEventSearch]',e=>{e.value='missing';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForSelector('[name=deliveriesEmpty]');check('combined empty intersection enables explicit clear',!await page.$eval('[name=clearAllDeliveryFilters]',e=>e.disabled)&&await page.$$eval('.delivery-row',es=>es.length===0));
  await page.$eval('[name=clearAllDeliveryFilters]',e=>e.click());check('Clear all restores full loaded records but retains chosen order',await page.$$eval('.delivery-row',es=>es.length===5)&&await page.$eval('[name=deliveryOrder]',e=>e.value==='oldest')&&await page.$eval('[name=clearAllDeliveryFilters]',e=>e.disabled)&&reads===1&&writes===0);
  await page.$eval('[name=clearAllDeliveryFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/webhook-clear-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=clearAllDeliveryFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/webhook-clear-mobile.png'});check('390px Clear all and local-only scope fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=clearAllDeliveryFiltersScope]',e=>e.textContent.includes('Time order and loaded records stay')));
  await page.$eval('[name=deliveryEventSearch]',e=>{e.value='   ';e.dispatchEvent(new Event('input',{bubbles:true}));});check('whitespace-only search can be explicitly cleared',!await page.$eval('[name=clearAllDeliveryFilters]',e=>e.disabled));await page.$eval('[name=clearAllDeliveryFilters]',e=>e.click());
  let fail=true;page.removeAllListeners('request');page.on('request',req=>{if(new URL(req.url()).pathname===`/api${P}/webhooks/${hook.id}/deliveries`&&req.method()==='GET'){reads++;return req.respond({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{message:'PRIVATE'}:rows)});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});await page.select('[name=deliveryStatus]','failed');await page.$eval('[name=refreshDeliveries]',e=>e.click());await page.waitForSelector('[role=alert]');await page.$eval('[name=clearAllDeliveryFilters]',e=>e.click());check('clearing after failed read cannot display successful empty or old rows',!!await page.$('[role=alert]')&&!await page.$('.delivery-row')&&!await page.$('[name=deliveriesEmpty]')&&await page.$eval('[name=downloadDeliveries]',e=>e.disabled)&&reads===2&&writes===0);
  fail=false;await page.$eval('[name=refreshDeliveries]',e=>e.click());await page.waitForSelector('.delivery-row');check('explicit retry recovers full list without reset time order',await page.$$eval('.delivery-row',es=>es.length===5)&&await page.$eval('[name=deliveryOrder]',e=>e.value==='oldest')&&reads===3&&writes===0);
  check('no clear-filter runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;

} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
