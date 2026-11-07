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
const PG_PORT = 55708, WEB_PORT = 4200, API_PORT = 3000;
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


  await prisma.activityEvent.createMany({data:Array.from({length:55},(_,i)=>({projectId:project.id,actorId:owner.user.id,action:'translation.value',keyName:`event-${i}`,localeCode:'he',detail:{previousValue:'PRIVATE_TRANSLATION',value:'PRIVATE_TRANSLATION',error:'PRIVATE_ERROR'},createdAt:new Date(Date.UTC(2026,10,7,10,0,i))}))});
  const path=`/projects/${project.id}/activity`,emptyProject=await call('/projects',{name:'Empty',slug:'empty',locales:['en']},token);
  const expected=(res)=>res.items.map(ev=>({id:ev.id,action:ev.action,actorName:ev.actor?.displayName??'Former user',keyName:ev.keyName,localeCode:ev.localeCode,createdAt:ev.createdAt}));const initial=await call(`${P}/activity`,undefined,token);
  await page.goto(`${WEB}${path}`,{waitUntil:'networkidle0'});await page.waitForSelector('.load-more');const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  const file=join(downloadDir,'activity-metadata.json'),readDownload=async()=>{for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));if(!existsSync(file))throw new Error('download not finished');return JSON.parse(readFileSync(file,'utf8'));};
  let reads=0,writes=0,held,hold=false,fail=false;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.endsWith('/activity')){if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_API'})});if(hold){held=req;return;}}}req.continue();});
  await prisma.activityEvent.create({data:{projectId:project.id,actorId:owner.user.id,action:'task.created',detail:{title:'Newer unread'}}});await page.click('[name=downloadActivity]');const first=await readDownload();check('actual JSON exact loaded first-page whitelist with has-more not complete history',isDeepStrictEqual(first,{schemaVersion:1,projectId:project.id,scope:'loaded-filtered-pages',filters:{action:'',actorId:'',key:''},hasMore:true,entries:expected(initial)})&&first.entries.length===50);check('local export does not read/write or include raw detail, private actor email or newer event',reads===0&&writes===0&&!JSON.stringify(first).includes('PRIVATE_')&&!JSON.stringify(first).includes('sync-owner@example.com')&&await page.$eval('[name=activityDownloadNotice]',e=>e.textContent.includes('does not confirm')));rmSync(file);
  await page.click('.load-more');await page.waitForFunction(()=>!document.querySelector('[name=activityLoading]')&&!document.querySelector('.load-more'));await page.click('[name=downloadActivity]');const appended=await readDownload();check('loaded older page appended once and exported without newer unread event',appended.entries.length===55&&!appended.hasMore&&new Set(appended.entries.map(e=>e.id)).size===55&&!appended.entries.some(e=>e.action==='task.created')&&writes===0);rmSync(file);
  await page.type('[name=actKey]','event-1');await page.waitForFunction(()=>!document.querySelector('[name=activityLoading]')&&document.querySelectorAll('.activity-row').length===11);await page.click('[name=downloadActivity]');const filtered=await readDownload(),filteredApi=await call(`${P}/activity?key=event-1`,undefined,token);check('filtered JSON exact current loaded result and trimmed key scope',isDeepStrictEqual(filtered.entries,expected(filteredApi))&&filtered.filters.key==='event-1'&&filtered.entries.length===11&&!filtered.hasMore&&filtered.projectId===project.id);await page.screenshot({path:'/downloads/activity-download-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/activity-download-mobile.png',fullPage:true});check('narrow metadata scope and requested feedback fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=activityDownloadScope]',e=>e.textContent.includes('Omits raw detail')));rmSync(file);
  hold=true;await page.$eval('[name=refreshActivity]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=downloadActivity]')?.disabled&&!document.querySelector('[name=activityDownloadNotice]'));for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-activity')).download());check('held read fences captured export and clears prior notice',readdirSync(downloadDir).length===0);hold=false;await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=activityLoading]'));
  fail=true;await page.$eval('[name=refreshActivity]',e=>e.click());await page.waitForSelector('[name=retryActivity]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-activity')).download());check('failed read disables export without raw API error or false empty',await page.$eval('[name=downloadActivity]',e=>e.disabled)&&readdirSync(downloadDir).length===0&&!(await page.content()).includes('PRIVATE_API')&&!await page.$('[name=activityEmpty]'));
  fail=false;await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${emptyProject.id}/activity`);await page.waitForSelector('[name=activityEmpty]');await page.waitForFunction(()=>!document.querySelector('[name=downloadActivity]')?.disabled);await page.$eval('[name=downloadActivity]',e=>e.click());const empty=await readDownload();check('empty new project exports exact new scope without previous records',empty.projectId===emptyProject.id&&empty.entries.length===0&&!empty.hasMore&&isDeepStrictEqual(empty.filters,{action:'',actorId:'',key:''}));rmSync(file);
  await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('PRIVATE_DOWNLOAD');};ng.getComponent(document.querySelector('ol-activity')).download();});await page.waitForFunction(()=>document.querySelector('[name=activityDownloadNotice]')?.textContent.includes('could not be started'));check('local failure bounded and no raw exception',!(await page.content()).includes('PRIVATE_DOWNLOAD'));
  await page.evaluate(()=>{window.oldActivity=ng.getComponent(document.querySelector('ol-activity'));window.afterDestroy=0;URL.createObjectURL=()=>{window.afterDestroy++;return 'blob:local';};history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-activity'));await page.evaluate(()=>window.oldActivity.download());check('departed captured handler cannot export',await page.evaluate(()=>window.afterDestroy===0)&&readdirSync(downloadDir).length===0&&writes===0);
  check('no activity download runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
