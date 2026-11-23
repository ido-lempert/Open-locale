// Real local browser -> Activity screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55689, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-activity-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('activity_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/activity_browser`;
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
  await prisma.activityEvent.createMany({data:Array.from({length:55},(_,i)=>({projectId:project.id,actorId:owner.user.id,action:'translation.value',keyName:`event-${i}`,detail:{previousValue:'before',value:'after'}}))});
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  await page.goto(`${WEB}${P}/activity`,{waitUntil:'networkidle0'});await page.waitForSelector('.load-more');
  await page.select('[aria-label="Filter by action"]','translation.value');await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');await page.select('[name=actActor]',owner.user.id);await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  let hideActors=true;await page.setRequestInterception(true);
  const memberOptions=req=>{if(hideActors&&new URL(req.url()).pathname===`/api${P}/members`)return req.respond({status:200,contentType:'application/json',body:'[]'});return req.continue();};page.on('request',memberOptions);
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-activity')).loadMembers());await page.waitForSelector('[name=activityRetainedActor]');
  check('missing actor option retains exact native selection and explains membership limits',await page.$eval('[name=actActor]',(e,id)=>e.value===id&&e.selectedOptions[0].textContent.includes('outside options'),owner.user.id)&&await page.$eval('[name=activityRetainedActor]',e=>e.textContent.includes('not cleared or verified')));
  await page.$eval('[name=activityRetainedActor]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-retained-actor-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=activityRetainedActor]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-retained-actor-mobile.png'});check('retained actor select fits390px viewport',await page.$eval('[name=actActor]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});
  hideActors=false;await page.click('[name=refreshActivityActors]');await page.waitForFunction(()=>!document.querySelector('[name=activityRetainedActor]'));
  check('restored actual member read removes fallback without clearing actor selection',await page.$eval('[name=actActor]',(e,id)=>e.value===id&&!e.selectedOptions[0].textContent.includes('outside options'),owner.user.id));
  page.off('request',memberOptions);await page.setRequestInterception(false);
  let reads=0,writes=0,hold=false,held,fail=false;const urls=[];await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}if(u.pathname===`/api${P}/activity`){urls.push(u);if(hold&&u.searchParams.has('key')){held=req;return;}if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}return req.continue();});
  await page.$eval('[name=actKey]',e=>{e.value='event-1';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('[name=clearActivityFilters]');await page.waitForSelector('.load-more');await new Promise(r=>setTimeout(r,350));
  check('Clear cancels pending key debounce and makes one unfiltered first-page request',reads===1&&writes===0&&urls.length===1&&[...urls[0].searchParams].length===0);
  check('all three controls clear and current first page replaces filtered results',await page.$eval('[aria-label="Filter by action"]',e=>e.value==='')&&await page.$eval('[name=actActor]',e=>e.value==='')&&await page.$eval('[name=actKey]',e=>e.value==='')&&await page.$$eval('.activity-row',es=>es.length===50)&&await page.$eval('[name=clearActivityFilters]',e=>e.disabled));
  hold=true;await page.$eval('[name=actKey]',e=>{e.value='event-2';e.dispatchEvent(new Event('input',{bubbles:true}));});for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('filtered request not held');await page.click('[name=clearActivityFilters]');await page.waitForSelector('.load-more');const stable=await page.$eval('.activity-list',e=>e.textContent);await held.continue();await new Promise(r=>setTimeout(r,150));
  check('late actual filtered response cannot replace cleared current page',reads===3&&await page.$eval('.activity-list',(e,s)=>e.textContent===s,stable)&&await page.$eval('[name=actKey]',e=>e.value==='')&&!!await page.$('.load-more'));
  const beforeSearch=reads;
  await page.$eval('[name=activitySearch]',e=>{e.value='EVENT-1';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>document.querySelectorAll('.activity-row').length<50);
  check('literal local metadata search filters loaded rows without requests',reads===beforeSearch&&writes===0&&await page.$$eval('.activity-row',es=>es.length>0&&es.every(e=>e.querySelector('.activity-key')?.textContent.toLowerCase().includes('event-1'))));
  await page.$eval('[name=activitySearch]',e=>{e.value='NO LOCAL MATCH';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForSelector('[name=activityEmpty]');
  check('local no-match keeps pagination and loaded-scope warning',reads===beforeSearch&&!!await page.$('.load-more')&&await page.$eval('[name=activityEmpty]',e=>e.textContent.includes('No loaded activity metadata'))&&await page.$eval('[name=activitySearchScope]',e=>e.textContent.includes('Download includes all loaded')));
  await page.$eval('[name=activitySearch]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-local-search-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=activitySearch]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-local-search-mobile.png'});await page.setViewport({width:1280,height:900});
  await page.click('[name=clearActivitySearch]');await page.waitForFunction(()=>document.querySelectorAll('.activity-row').length===50);check('clear local search restores loaded rows without request',reads===beforeSearch&&writes===0);
  await page.screenshot({path:'/downloads/activity-clear-filters.png',fullPage:false});
  hold=false;await page.select('[aria-label="Filter by action"]','translation.value');await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');fail=true;await page.click('[name=clearActivityFilters]');await page.waitForSelector('[name=retryActivity]');
  check('failed Clear shows fixed error with cleared controls not empty-success',!await page.$('[name=activityEmpty]')&&!(await page.content()).includes('PRIVATE')&&await page.$eval('[aria-label="Filter by action"]',e=>e.value===''));
  fail=false;const before=reads;await page.click('[name=retryActivity]');await page.waitForSelector('.load-more');check('Retry repeats unfiltered current first page only',reads===before+1&&[...urls.at(-1).searchParams].length===0&&await page.$$eval('.activity-row',es=>es.length===50)&&writes===0);
  const pageResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${P}/activity`&&new URL(r.url()).searchParams.has('cursor'));await page.click('.load-more');await pageResponse;await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');check('pagination still reads earlier entries after Clear recovery',await page.$$eval('.activity-row',es=>es.length>50)&&!await page.$('.load-more'));
  await page.setViewport({width:390,height:844});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await new Promise(r=>setTimeout(r,120));await page.screenshot({path:'/downloads/activity-clear-filters-narrow.png',fullPage:false});check('scope guidance bounds history and no runtime error',await page.$eval('[name=activityFilterScope]',e=>e.textContent.includes('not a complete history'))&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
