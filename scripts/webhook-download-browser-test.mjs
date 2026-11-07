// Real local browser -> Webhook journal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.WEBHOOK_JOURNAL_TEST_PG_PORT ?? 55692), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
const downloadDir=mkdtempSync(join(tmpdir(),'ol-webhook-download-'));
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
  const loadedApi=await call(`${P}/webhooks/${hook.id}/deliveries`,undefined,token);
  const expected=loadedApi.map(({id,event,httpStatus,success,attempts,durationMs,createdAt})=>({id,event,httpStatus,success,attempts,durationMs,createdAt}));
  await page.goto(journal,{waitUntil:'networkidle0'});await page.waitForSelector('.delivery-row');
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  let reads=0,writes=0,held,fail=false;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.endsWith('/deliveries')){if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});held=req;return;}}req.continue();});
  const file=join(downloadDir,'webhook-deliveries.json');
  const readDownload=async()=>{for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));if(!existsSync(file))throw new Error('download did not finish');return JSON.parse(readFileSync(file,'utf8'));};
  await page.type('[name=deliveryEventSearch]','snapshot');await page.select('[name=deliveryStatus]','failed');await page.waitForFunction(()=>document.querySelectorAll('.delivery-row').length===1);
  await prisma.webhookDelivery.create({data:{webhookId:hook.id,event:'newer.unread',httpStatus:201,success:true,attempts:1,durationMs:1}});
  await page.click('[name=downloadDeliveries]');const report=await readDownload();
  check('actual JSON exactly matches full displayed metadata from API despite combined filter and newer unread row',isDeepStrictEqual(report,{schemaVersion:1,projectId:project.id,webhookId:hook.id,scope:'all-loaded-records',deliveries:expected})&&report.deliveries.length===3);
  check('download is local without reads/writes, excludes private errors/secrets and keeps bounded feedback',reads===0&&writes===0&&loadedApi.some(d=>d.error==='private-network-error')&&!JSON.stringify(report).includes('private-')&&await page.$eval('[name=deliveryDownloadNotice]',e=>e.textContent.includes('does not confirm'))&&await page.$eval('[name=deliveryDownloadScope]',e=>e.textContent.includes('regardless of event search or status filter')));
  await page.screenshot({path:'/downloads/webhook-journal-download-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/webhook-journal-download-mobile.png',fullPage:true});check('narrow download scope/feedback readable without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));rmSync(file);
  await page.click('[name=refreshDeliveries]');await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-webhook-deliveries')).loading());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>document.querySelector('[name=downloadDeliveries]')?.disabled&&!document.querySelector('[name=deliveryDownloadNotice]'));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-webhook-deliveries')).download());check('held read disables download, clears notice and captured handler cannot export prior rows',reads===1&&await page.$eval('[name=downloadDeliveries]',e=>e.disabled)&&!await page.$('[name=deliveryDownloadNotice]')&&readdirSync(downloadDir).length===0);
  await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-webhook-deliveries')).loading());await page.click('[name=downloadDeliveries]');const fresh=await readDownload();check('explicit current read updates downloadable full set without changing filters',fresh.deliveries.length===4&&fresh.deliveries.some(x=>x.event==='newer.unread')&&await page.$eval('[name=deliveryEventSearch]',e=>e.value==='snapshot')&&await page.$eval('[name=deliveryStatus]',e=>e.value==='failed')&&reads===1&&writes===0);rmSync(file);
  fail=true;await page.click('[name=refreshDeliveries]');await page.waitForSelector('[role=alert]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-webhook-deliveries')).download());check('failed current read rejects download without raw error or successful empty state',reads===2&&await page.$eval('[name=downloadDeliveries]',e=>e.disabled)&&readdirSync(downloadDir).length===0&&!await page.$('[name=deliveryDownloadNotice]')&&!(await page.content()).includes('PRIVATE'));
  fail=false;await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'));},`${P}/webhooks/${emptyHook.id}/deliveries`);await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-webhook-deliveries')).loading());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await held.continue();held=null;await page.waitForSelector('[name=deliveriesEmpty]');await page.click('[name=downloadDeliveries]');const empty=await readDownload();check('successful empty new webhook exports exact new scope not prior journal',empty.webhookId===emptyHook.id&&empty.projectId===project.id&&empty.deliveries.length===0&&reads===3&&writes===0);rmSync(file);
  await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('PRIVATE');};ng.getComponent(document.querySelector('ol-webhook-deliveries')).download();});await page.waitForFunction(()=>document.querySelector('[name=deliveryDownloadNotice]')?.textContent.includes('could not be started'));check('local download failure shows fixed guidance not raw detail',!(await page.content()).includes('PRIVATE'));
  await page.evaluate(()=>{window.departedJournal=ng.getComponent(document.querySelector('ol-webhook-deliveries'));window.createdAfterDestroy=0;URL.createObjectURL=()=>{window.createdAfterDestroy++;return 'blob:local';};history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-webhook-deliveries'));await page.evaluate(()=>window.departedJournal.download());check('departed captured handler cannot export journal',await page.evaluate(()=>window.createdAfterDestroy===0)&&readdirSync(downloadDir).length===0);
  check('no download runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
finally {
  await browser?.close();rmSync(downloadDir,{recursive:true,force:true});
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
