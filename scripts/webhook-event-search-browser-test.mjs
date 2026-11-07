// Real local browser -> Webhook journal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.WEBHOOK_JOURNAL_TEST_PG_PORT ?? 55691), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-webhook-journal-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('webhook_journal_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/webhook_journal_browser`;
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


  const hook=await prisma.webhook.create({data:{projectId:project.id,url:'https://example.com/hook',secret:'private-signing-secret',events:['translation.updated']}});
  const emptyHook=await prisma.webhook.create({data:{projectId:project.id,url:'https://example.com/empty',secret:'other-private-secret',events:['translation.updated']}});
  const longEvent='translation.'+'x'.repeat(160)+'<img src=x onerror=alert(1)>';
  await prisma.webhookDelivery.createMany({data:[
    {webhookId:hook.id,event:'translation.updated',httpStatus:204,success:true,attempts:1,durationMs:15,createdAt:new Date('2026-11-05T12:00:00Z')},
    {webhookId:hook.id,event:longEvent,httpStatus:503,success:false,attempts:2,durationMs:200,error:'private-network-error',createdAt:new Date('2026-11-05T11:00:00Z')},
    {webhookId:hook.id,event:'snapshot.restored',httpStatus:null,success:false,attempts:2,durationMs:5,error:'private-dns-error',createdAt:new Date('2026-11-05T10:00:00Z')},
  ]});
  const journal=`${WEB}${P}/webhooks/${hook.id}/deliveries`;
  await page.goto(journal,{waitUntil:'networkidle0'});await page.waitForSelector('.delivery-row');let reads=0,writes=0,fail=false;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}if(fail&&u.pathname.endsWith('/deliveries'))return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});req.continue();});
  await page.type('[name=deliveryEventSearch]',' TRANSLATION ');await page.waitForFunction(()=>document.querySelectorAll('.delivery-row').length===2);check('trimmed case-insensitive loaded event search reads nothing and retains full journal',reads===0&&writes===0&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-webhook-deliveries')).items().length===3));
  await page.select('[name=deliveryStatus]','failed');await page.waitForFunction(()=>document.querySelectorAll('.delivery-row').length===1);check('event and status combine on persisted failure without HTTP processing claim',await page.$eval('.delivery-list',e=>e.textContent.includes('HTTP 503'))&&await page.$eval('main',e=>e.textContent.includes('not that it processed the event')));await page.screenshot({path:'/downloads/webhook-event-search-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/webhook-event-search-mobile.png',fullPage:true});check('narrow event-search journal wraps long literal event',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{const e=document.querySelector('[name=deliveryEventSearch]');e.value='zz[.*]';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>document.querySelectorAll('.delivery-row').length===0);check('literal no-match explains both filters without losing loaded records',reads===0&&writes===0&&await page.$eval('[name=deliveriesEmpty]',e=>e.textContent.includes('event search and status'))&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-webhook-deliveries')).items().length===3));
  await page.click('[name=clearDeliveryEventSearch]');await page.waitForFunction(()=>document.querySelectorAll('.delivery-row').length===2);check('Clear event search retains status and restores failed loaded rows without requests',reads===0&&writes===0&&await page.$eval('[name=deliveryStatus]',e=>e.value==='failed'));
  await page.type('[name=deliveryEventSearch]','snapshot');await page.waitForFunction(()=>document.querySelectorAll('.delivery-row').length===1);await page.click('[name=refreshDeliveries]');for(let n=0;n<100&&reads===0;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-webhook-deliveries')).loading()&&document.querySelectorAll('.delivery-row').length===1);check('explicit current reread retains query and status',reads===1&&writes===0&&await page.$eval('[name=deliveryEventSearch]',e=>e.value==='snapshot')&&await page.$eval('[name=deliveryStatus]',e=>e.value==='failed'));
  fail=true;await page.click('[name=refreshDeliveries]');await page.waitForSelector('[role=alert]');await page.click('[name=clearDeliveryEventSearch]');check('clearing search after failed read cannot display successful empty result or raw detail',!await page.$('[name=deliveriesEmpty]')&&!await page.$('.delivery-row')&&!(await page.content()).includes('PRIVATE'));
  fail=false;await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'));},`${P}/webhooks/${emptyHook.id}/deliveries`);await page.waitForSelector('[name=deliveriesEmpty]');check('new webhook resets query and status to genuine empty journal',await page.$eval('[name=deliveryEventSearch]',e=>e.value==='')&&await page.$eval('[name=deliveryStatus]',e=>e.value==='')&&await page.$eval('[name=deliveriesEmpty]',e=>e.textContent.includes('No recorded deliveries'))&&writes===0);check('no event-search runtime errors or secret disclosure',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d))&&!(await page.content()).includes('private-signing-secret'));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(process.exitCode??1);
