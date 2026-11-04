// Real local browser -> Activity screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55536, WEB_PORT = 4200, API_PORT = 3000;
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

  await page.setViewport({width:480,height:900});
  await page.goto(`${WEB}/projects/${project.id}/activity`,{waitUntil:'networkidle0'});await page.waitForSelector('.load-more');
  const initial=await page.$$eval('.activity-row',rows=>rows.length);check('actual activity has first page and more cursor',initial===50);
  let olderHeld=false,releaseOlder,olderReads=0;const olderGate=new Promise(r=>releaseOlder=r);await page.setRequestInterception(true);
  const holdOlder=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(req.url()).searchParams.has('cursor')){olderHeld=true;olderReads++;await olderGate;}return req.continue();};page.on('request',holdOlder);
  await page.click('.load-more');for(let n=0;n<50&&!olderHeld;n++)await new Promise(r=>setTimeout(r,20));if(!olderHeld)throw new Error('older page not held');
  await page.click('.load-more');await new Promise(r=>setTimeout(r,100));
  check('held older page disables repeated load more and makes one actual request',olderReads===1&&await page.$eval('.load-more',e=>e.disabled)&&await page.$$eval('.activity-row',rows=>rows.length===50)&&!!await page.$('[name=activityLoading]'));
  await page.$eval('[name=actKey]',e=>{e.value='event-1';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');const latestRows=await page.$$eval('.activity-row',rows=>rows.map(r=>r.textContent));
  const olderResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(r.url()).searchParams.has('cursor'));releaseOlder();await olderResponse;await new Promise(r=>setTimeout(r,100));page.off('request',holdOlder);await page.setRequestInterception(false);
  check('late older activity page cannot append across same-project key filter',latestRows.length===11&&await page.$$eval('.activity-row',(rows,texts)=>JSON.stringify(rows.map(r=>r.textContent))===JSON.stringify(texts),latestRows)&&!(await page.$('.load-more'))&&!(await page.$('[name=activityLoading]')));
  await page.screenshot({path:'/downloads/activity-same-project-race-full.png',fullPage:true});
  await page.$eval('[name=actKey]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForSelector('.load-more');
  let pageReads=0;await page.setRequestInterception(true);const failPage=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(req.url()).searchParams.has('cursor')){pageReads++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-page-error'})});}return req.continue();};page.on('request',failPage);
  await page.click('.load-more');await page.waitForSelector('[name=retryActivity]');
  check('failed activity page retains prior rows without empty-success or raw detail',await page.$$eval('.activity-row',rows=>rows.length)===initial&&!(await page.$('[name=activityEmpty]'))&&!(await page.content()).includes('private-page-error')&&pageReads===1);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await new Promise(r=>setTimeout(r,120));await page.screenshot({path:'/downloads/activity-page-failure-full.png',fullPage:true});page.off('request',failPage);await page.setRequestInterception(false);
  await page.$eval('[name=retryActivity]',e=>e.scrollIntoView({block:'center',behavior:'instant'}));await new Promise(r=>setTimeout(r,120));await page.click('[name=retryActivity]');await page.waitForFunction(()=>document.querySelectorAll('.activity-row').length>50);
  check('real activity page retry appends remaining events once',await page.$$eval('.activity-row',rows=>rows.length===new Set(rows.map(r=>r.textContent)).size)&&!(await page.$('[name=retryActivity]'))&&!(await page.$('.load-more')));
  const linkedKey=await prisma.key.findFirstOrThrow({where:{projectId:project.id,name:'title'}});
  const linkedTask=await call(`${P}/tasks`,{title:'<b>Activity filter task</b>',keyIds:[linkedKey.id]},token);
  const taskResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(r.url()).searchParams.get('action')==='task.created');await page.select('[aria-label="Filter by action"]','task.created');const taskEvents=await (await taskResponse).json();await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  check('new task action option filters real created-task activity',taskEvents.items.length===1&&taskEvents.items[0].action==='task.created'&&await page.$$eval('.activity-row',rows=>rows.length===1&&rows[0].textContent.includes('created task'))&&await page.$eval('[aria-label="Filter by action"]',e=>e.value==='task.created'));
  check('actual linked-key task creation is visible exactly once in filtered activity',linkedTask.keys.length===1&&taskEvents.items.length===1&&taskEvents.items[0].detail.title==='<b>Activity filter task</b>');
  check('actual task title snapshot renders as literal text without HTML elements',await page.$eval('.activity-row',e=>e.textContent.includes('<b>Activity filter task</b>')&&!e.querySelector('b')));
  await page.screenshot({path:'/downloads/activity-task-filter-full.png',fullPage:true});
  await call(`${P}/glossary`,{term:'<i>checkout</i>'},token);
  const glossaryResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(r.url()).searchParams.get('action')==='glossary.created');await page.select('[aria-label="Filter by action"]','glossary.created');await glossaryResponse;await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  check('actual glossary term snapshot renders literal text in filtered activity',await page.$$eval('.activity-row',rows=>rows.length===1&&rows[0].textContent.includes('<i>checkout</i>')&&!rows[0].querySelector('i')));
  await page.screenshot({path:'/downloads/activity-glossary-filter-full.png',fullPage:true});
  await prisma.activityEvent.createMany({data:['member.updated','group.updated'].flatMap(action=>[
    {projectId:project.id,actorId:owner.user.id,action,detail:{from:null,to:{role:42,allowedLocales:'bad'}}},
    {projectId:project.id,actorId:owner.user.id,action,detail:{email:'member@example.com',name:'Reviewers',from:{role:'MEMBER',allowedLocales:[]},to:{role:'ADMIN',allowedLocales:['he']}}}
  ])});
  for(const action of ['member.updated','group.updated']){
    await page.select('[aria-label="Filter by action"]',action);await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
    check(`actual ${action} incomplete persisted snapshot cannot break valid feed rendering`,await page.$$eval('.activity-row',rows=>rows.length===2&&rows.some(r=>r.textContent.includes('member → admin, locales all → he')))&&!diagnostics.some(d=>/TypeError|Cannot read properties/.test(d)));
  }
  await page.screenshot({path:'/downloads/activity-incomplete-snapshot-full.png',fullPage:true});
  await prisma.activityEvent.createMany({data:[
    {projectId:project.id,actorId:owner.user.id,action:'task.updated',detail:{title:'Malformed task snapshot',changes:'private-bogus-change'}},
    {projectId:project.id,actorId:owner.user.id,action:'task.updated',detail:{title:'Mixed task snapshot',changes:{invalid:{from:{private:'private-object-value'},to:['valid',42]},status:{from:'OPEN',to:'DONE'},lockKeys:{from:false,to:true}}}}
  ]});
  await page.select('[aria-label="Filter by action"]','task.updated');await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  check('actual task change snapshots omit malformed details but preserve valid neighbors',await page.$$eval('.activity-row',rows=>rows.length===2&&rows.some(r=>r.textContent.includes('Mixed task snapshot - status: OPEN → DONE; lockKeys: false → true'))&&rows.some(r=>r.textContent.includes('Malformed task snapshot'))&&!rows.some(r=>/private-bogus|private-object|invalid:|undefined|\[object Object\]/.test(r.textContent))));
  await page.screenshot({path:'/downloads/activity-task-change-shapes-full.png',fullPage:true});
  let actorReads=0,feedReads=0;await page.setRequestInterception(true);
  const failActors=req=>{const path=new URL(req.url()).pathname;if(path===`/api/projects/${project.id}/activity`)feedReads++;if(path===`/api/projects/${project.id}/members`){actorReads++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-actor-error'})});}return req.continue();};page.on('request',failActors);
  // A same-project route reload triggers the real metadata read independently.
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[name=retryActivityActors]');await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  const stableFeed=await page.$eval('.activity-list',e=>e.textContent);const stableReads=feedReads;
  check('actor metadata failure is explicit without hiding completed feed or leaking raw errors',actorReads===1&&!!await page.$('.activity-row')&&!(await page.content()).includes('private-actor-error')&&await page.$eval('[name=actActor]',e=>e.options.length===1));
  await page.screenshot({path:'/downloads/activity-actor-failure-full.png',fullPage:false});page.off('request',failActors);
  let actorHeld=false,releaseActors;const actorsGate=new Promise(r=>releaseActors=r);
  const holdActors=async req=>{const path=new URL(req.url()).pathname;if(path===`/api/projects/${project.id}/activity`)feedReads++;if(path===`/api/projects/${project.id}/members`){actorReads++;actorHeld=true;await actorsGate;}return req.continue();};page.on('request',holdActors);
  await page.click('[name=retryActivityActors]');await page.waitForSelector('[name=activityActorsLoading]');if(!actorHeld)throw new Error('actor retry not held');
  check('held actor retry announces independent loading without rereading or replacing feed',feedReads===stableReads&&await page.$eval('.activity-list',(e,t)=>e.textContent===t,stableFeed)&&await page.$eval('[name=actActor]',e=>e.getAttribute('aria-busy')==='true')&&!(await page.$('[name=retryActivityActors]')));
  await page.screenshot({path:'/downloads/activity-actor-loading-full.png',fullPage:false});releaseActors();await page.waitForFunction(()=>document.querySelector('[name=actActor]')?.options.length>1);await page.waitForFunction(()=>!document.querySelector('[name=activityActorsLoading]'));
  check('actor retry restores real member options without feed reread or replacement',actorReads===2&&feedReads===stableReads&&await page.$eval('.activity-list',(e,t)=>e.textContent===t,stableFeed)&&!(await page.$('[name=activityActorsError]'))&&await page.$eval('[name=actActor]',e=>e.options[1].textContent==='Owner'));
  await page.screenshot({path:'/downloads/activity-actor-recovered-full.png',fullPage:false});page.off('request',holdActors);await page.setRequestInterception(false);
  await page.select('[aria-label="Filter by action"]','task.created');await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  await page.select('[name=actActor]',owner.user.id);await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  await call(`${P}/tasks`,{title:'Fresh activity task'},token);
  let refreshReads=0,refreshMembers=0,releaseRefresh,refreshHeld=false;const refreshGate=new Promise(r=>releaseRefresh=r);await page.setRequestInterception(true);
  const holdRefresh=async req=>{const path=new URL(req.url()).pathname;if(path===`/api/projects/${project.id}/members`)refreshMembers++;if(path===`/api/projects/${project.id}/activity`){refreshReads++;refreshHeld=true;await refreshGate;}return req.continue();};page.on('request',holdRefresh);
  await page.click('[name=refreshActivity]');await page.waitForSelector('[name=activityLoading]');if(!refreshHeld)throw new Error('refresh not held');await page.click('[name=refreshActivity]');await new Promise(r=>setTimeout(r,100));
  check('held activity refresh clears old feed and suppresses duplicate real reads',refreshReads===1&&refreshMembers===0&&await page.$eval('[name=refreshActivity]',e=>e.disabled)&&!(await page.$('.activity-row'))&&!(await page.$('[name=activityEmpty]')));
  releaseRefresh();await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  check('explicit refresh shows new real task and preserves action and actor without metadata reload',refreshReads===1&&refreshMembers===0&&await page.$$eval('.activity-row',rows=>rows.length===2&&rows.some(r=>r.textContent.includes('Fresh activity task')))&&await page.$eval('[aria-label="Filter by action"]',e=>e.value==='task.created')&&await page.$eval('[name=actActor]',(e,id)=>e.value===id,owner.user.id)&&!await page.$eval('[name=refreshActivity]',e=>e.disabled));
  await page.screenshot({path:'/downloads/activity-refresh-full.png',fullPage:true});page.off('request',holdRefresh);await page.setRequestInterception(false);
  let held=false,release;const gate=new Promise(r=>release=r);await page.setRequestInterception(true);const hold=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(req.url()).searchParams.get('action')==='translation.value'){held=true;await gate;}return req.continue();};page.on('request',hold);
  await page.select('[aria-label="Filter by action"]','translation.value');for(let n=0;n<50&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('activity not held');
  check('held activity filter clears previous rows and announces loading',!(await page.$('.activity-row'))&&!!await page.$('[name=activityLoading]')&&!(await page.$('[name=activityEmpty]')));
  const next=await call('/projects',{name:'Activity next',slug:'activity-next',locales:['en','fr']},token);
  await page.evaluate(id=>{history.pushState({},'',`/projects/${id}/activity`);window.dispatchEvent(new PopStateEvent('popstate'));},next.id);await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  const currentText=await page.$eval('.activity-list',e=>e.textContent);const late=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/activity`&&new URL(r.url()).searchParams.get('action')==='translation.value');release();await late;await new Promise(r=>setTimeout(r,100));page.off('request',hold);await page.setRequestInterception(false);
  check('late activity cannot cross reused project route',await page.$eval('.activity-list',(e,t)=>e.textContent===t,currentText)&&await page.$eval('[aria-label="Filter by action"]',e=>e.value==='')&&await page.$eval('.back',(e,id)=>e.getAttribute('href')===`/projects/${id}`,next.id));
  const oldOnly=await call('/auth/signup',{email:'old-actor@example.com',password:'pass1234',displayName:'Old project only'},undefined);
  await call(`${P}/members`,{email:oldOnly.user.email,role:'MEMBER'},token);
  const otherOwner=await call('/auth/signup',{email:'other-team@example.com',password:'pass1234',displayName:'Other team owner'},undefined);
  const actorNext=await call('/projects',{name:'Separate team',slug:'separate-team',locales:['en','fr']},otherOwner.accessToken);
  await call(`/projects/${actorNext.id}/members`,{email:owner.user.email,role:'MEMBER'},otherOwner.accessToken);
  let oldActorsHeld=false,releaseOldActors;const oldActorsGate=new Promise(r=>releaseOldActors=r);await page.setRequestInterception(true);
  const holdOldActors=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/members`){oldActorsHeld=true;await oldActorsGate;}return req.continue();};page.on('request',holdOldActors);
  await page.evaluate(id=>{history.pushState({},'',`/projects/${id}/activity`);window.dispatchEvent(new PopStateEvent('popstate'));},project.id);
  await page.waitForSelector('[name=activityActorsLoading]');await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');if(!oldActorsHeld)throw new Error('old actor metadata not held');
  check('actual held old-project actor read stays independent from completed activity',await page.$eval('[name=actActor]',e=>e.getAttribute('aria-busy')==='true'&&e.options.length===1)&&!!await page.$('.activity-row'));
  await page.evaluate(id=>{history.pushState({},'',`/projects/${id}/activity`);window.dispatchEvent(new PopStateEvent('popstate'));},actorNext.id);
  await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false'&&document.querySelector('[name=actActor]')?.getAttribute('aria-busy')==='false');
  const newestFeed=await page.$eval('.activity-list',e=>e.textContent);const newestOptions=await page.$eval('[name=actActor]',e=>Array.from(e.options).map(o=>[o.value,o.textContent]));
  const oldActorResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/members`);releaseOldActors();const oldActorBody=await (await oldActorResponse).json();await new Promise(r=>setTimeout(r,120));
  check('late actual old-project members cannot enter reused new-project selector or settle its feed',oldActorBody.some(m=>m.id===oldOnly.user.id)&&!newestOptions.some(o=>o[0]===oldOnly.user.id)&&await page.$eval('[name=actActor]',(e,options)=>JSON.stringify(Array.from(e.options).map(o=>[o.value,o.textContent]))===JSON.stringify(options),newestOptions)&&await page.$eval('.activity-list',(e,text)=>e.textContent===text,newestFeed)&&!(await page.$('[name=activityActorsLoading]'))&&!(await page.$('[name=activityActorsError]'))&&await page.$eval('.back',(e,id)=>e.getAttribute('href')===`/projects/${id}`,actorNext.id));
  page.off('request',holdOldActors);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/activity-actor-project-race-full.png',fullPage:true});
  check('activity recovery fits narrow viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/downloads/activity-recovered-full.png',fullPage:true});
  console.log(failures?'ACTIVITY BROWSER CHECKS FAILED':'ALL ACTIVITY BROWSER CHECKS PASSED');process.exitCode=failures?1:0;
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
