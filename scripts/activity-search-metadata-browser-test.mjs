// Real local browser -> Activity screen -> built API + PostgreSQL.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.ACTIVITY_SEARCH_META_TEST_PG_PORT ?? 56342), WEB_PORT = 4200, API_PORT = 3000;
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


  const values=[null,42,true,{},[]],rows=values.map((value,i)=>({id:'bad'+i,actor:{displayName:value},action:'key.created',keyName:value,localeCode:value,createdAt:'2026-01-01T00:00:00Z'}));rows.push({id:'valid',actor:{displayName:'Owner'},action:'key.created',keyName:'Title [A]',localeCode:'he',createdAt:'2026-01-01T00:00:00Z'});let reads=0,writes=0;
  await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname===`/api${P}/activity`&&req.method()==='GET'){reads++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({items:rows,nextCursor:null})});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});await page.goto(`${WEB}${P}/activity`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=activitySearch]');
  const search=async value=>{await page.$eval('[name=activitySearch]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));};
  await search('[a]');check('valid literal key still matches beside malformed source metadata',await page.$$eval('.activity-key',es=>es.length===1&&es[0].textContent==='Title [A]')&&reads===1&&writes===0);
  for(const value of ['42','true','object']){await search(value);await page.waitForSelector('[name=activityEmpty]');check('nonstring source metadata not coerced into query '+value,await page.$$eval('.activity-key',es=>es.length===0)&&reads===1&&writes===0);}
  await page.$eval('[name=activitySearch]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-search-metadata-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=activitySearch]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-search-metadata-mobile.png'});check('390px typed-search empty guidance fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__activityDownload=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};window.__activityAnchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};});await page.$eval('[name=downloadActivity]',e=>e.click());await page.waitForFunction(()=>!!window.__activityDownload);check('full loaded metadata download preserves raw allowlisted fields',await page.evaluate(expected=>JSON.stringify(window.__activityDownload.entries.map(r=>r.keyName))===JSON.stringify(expected.map(r=>r.keyName))&&window.__activityDownload.entries.length===6,rows)&&reads===1&&writes===0);
  await page.$eval('[name=clearActivitySearch]',e=>e.click());await page.waitForFunction(()=>document.querySelectorAll('.activity-action').length===6);check('clear restores loaded order without reread or repair',reads===1&&writes===0);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-activity'));c.actionFilter.set('task.created');c.actorFilter.set('owner');c.keyFilter.set('retained-key');c.search('missing');c.setOrder('oldest');});await page.waitForSelector('[name=activityEmpty]');
  await page.$eval('[name=resetActivityView]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-local-view-mobile.png'});await page.setViewport({width:1280,height:900});await page.$eval('[name=resetActivityView]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-local-view-desktop.png'});
  await page.$eval('[name=resetActivityView]',e=>e.click());await page.waitForFunction(()=>document.querySelectorAll('.activity-action').length===6);
  const localResetReady=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-activity'));return c.query()===''&&c.order()==='loaded'&&c.actionFilter()==='task.created'&&c.actorFilter()==='owner'&&c.keyFilter()==='retained-key'&&!!c.downloadNotice()&&document.querySelector('[name=resetActivityView]').disabled;});
  check('local view reset restores loaded rows preserving server filters and feedback without read',await localResetReady()&&reads===1&&writes===0);
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-activity')).order.set('oldest'));check('negative retained local order probe detected',!await localResetReady());await page.$eval('[name=resetActivityView]',e=>e.click());check('local view reset restored after isolated probe',await localResetReady()&&reads===1&&writes===0);
  await page.evaluate(()=>{HTMLAnchorElement.prototype.click=window.__activityAnchorClick;delete window.__activityAnchorClick;const c=ng.getComponent(document.querySelector('ol-activity'));window.__departedActivity=c;c.actionFilter.set('task.created');c.actorFilter.set('original');c.downloadNotice.set('Keep departure feedback');window.__departedActivityRows=c.items();c.search('Keep local query');c.setOrder('newest');history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-activity'));
  await page.evaluate(()=>{window.__departedActivity.setFilter('translation.value');window.__departedActivity.setActor('late');window.__departedActivity.resetLocalView();});
  check('departed captured action and actor handlers keep scope rows and feedback without reads',reads===1&&writes===0&&await page.evaluate(()=>{const c=window.__departedActivity;return c.query()==='Keep local query'&&c.order()==='newest'&&c.actionFilter()==='task.created'&&c.actorFilter()==='original'&&c.items()===window.__departedActivityRows&&c.downloadNotice()==='Keep departure feedback';}));await page.evaluate(()=>{delete window.__departedActivity;delete window.__departedActivityRows;});
  check('no activity search metadata runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

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
