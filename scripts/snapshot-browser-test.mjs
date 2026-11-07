// Real local browser -> Snapshots screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55543, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-snapshot-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('snapshot_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/snapshot_browser`;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  await call(`${P}/snapshots`,{label:'Persisted snapshot'},token);
  await page.setViewport({width:480,height:900});await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForSelector('.snapshot-row');
  let blankCaptures=0;
  const watchBlank=req=>{if(req.method()==='POST'&&new URL(req.url()).pathname===`/api${P}/snapshots`)blankCaptures++;};
  page.on('request',watchBlank);
  await page.waitForFunction(()=>document.querySelector('.snapshot-create button')?.disabled);
  await page.click('.snapshot-create button');await page.type('[name=label]','   ');
  await page.waitForFunction(()=>document.querySelector('.snapshot-create button')?.disabled);
  await page.click('.snapshot-create button');await new Promise(r=>setTimeout(r,100));
  check('blank and whitespace labels disable actual capture click without POST or feedback',blankCaptures===0&&await page.$eval('.snapshot-create button',e=>e.disabled&&e.getAttribute('aria-busy')==='false'&&(!document.querySelector('[name=label]').value.trim()||!document.querySelector('.snapshot-create button').disabled))&&!(await page.$('.notice'))&&!(await page.$('[role=alert]')));
  await page.type('[name=label]','Ready label');await page.waitForFunction(()=>!document.querySelector('.snapshot-create button')?.disabled);
  check('valid label enables actual capture action without submitting prematurely',blankCaptures===0&&await page.$eval('[name=label]',e=>e.value==='   Ready label')&&await page.$eval('.snapshot-create button',e=>!e.disabled));
  await page.screenshot({path:'/downloads/snapshots-valid-label-ready-full.png',fullPage:true});
  await page.$eval('[name=label]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});page.off('request',watchBlank);
  check('snapshot screen renders persisted capture',await page.$eval('.snapshot-list',e=>e.textContent.includes('Persisted snapshot')));
  await page.type('[name=label]','Capture before failed list');let failedReads=0;await page.setRequestInterception(true);const failList=req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/snapshots`){failedReads++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-snapshot-list'})});}return req.continue();};page.on('request',failList);await page.click('.snapshot-create button');await page.waitForSelector('[name=retrySnapshotList]');
  check('failed post-capture list hides stale restore rows and empty success without raw detail',failedReads===1&&!(await page.$('.snapshot-list'))&&!(await page.$('.restore'))&&!(await page.$('[name=snapshotListEmpty]'))&&!(await page.content()).includes('private-snapshot-list')&&await page.$eval('[name=snapshotListError]',e=>e.textContent==='Snapshots unavailable. No snapshots are shown. Retry this read or reload the page.'));
  await page.screenshot({path:'/downloads/snapshots-list-failure-full.png',fullPage:true});page.off('request',failList);let held=false,release;const gate=new Promise(r=>release=r);const holdList=async req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/snapshots`){held=true;await gate;}return req.continue();};page.on('request',holdList);await page.type('[name=label]','Keep retry label');await page.click('[name=retrySnapshotList]');await page.waitForSelector('[name=snapshotListLoading]');if(!held)throw new Error('snapshot retry not held');
  check('pending snapshot retry hides rows empty guidance and retry while retaining label',!(await page.$('.snapshot-list'))&&!(await page.$('[name=snapshotListEmpty]'))&&!(await page.$('[name=retrySnapshotList]'))&&await page.$eval('[name=label]',e=>e.value==='Keep retry label'));await page.screenshot({path:'/downloads/snapshots-retry-loading-full.png',fullPage:true});release();await page.waitForFunction(()=>!document.querySelector('[name=snapshotListLoading]')&&document.querySelector('.snapshot-list')?.textContent.includes('Capture before failed list'));
  check('actual snapshot retry restores persisted rows and label without list error',await page.$eval('.snapshot-list',e=>e.textContent.includes('Persisted snapshot')&&e.textContent.includes('Capture before failed list'))&&await page.$eval('[name=label]',e=>e.value==='Keep retry label')&&!(await page.$('[name=snapshotListError]'))&&!(await page.$('[name=snapshotListEmpty]')));
  check('snapshot recovery has no runtime error or document overflow',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d))&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));page.off('request',holdList);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-list-recovered-full.png',fullPage:true});

  let captureCount=0,captureHeld=false,releaseCapture;const captureGate=new Promise(r=>releaseCapture=r);await page.setRequestInterception(true);const holdCapture=async req=>{if(req.method()==='POST'&&new URL(req.url()).pathname===`/api${P}/snapshots`){captureCount++;captureHeld=true;await captureGate;}return req.continue();};page.on('request',holdCapture);await page.click('.snapshot-create button');for(let n=0;n<100&&!captureHeld;n++)await new Promise(r=>setTimeout(r,20));if(!captureHeld)throw new Error('capture not held');await page.$eval('[name=label]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.type('[name=label]','Newer pending snapshot draft');await page.click('.snapshot-create button');
  check('actual held capture exposes only capture live status',await page.$eval('[name=snapshotCreating]',e=>e.getAttribute('role')==='status'&&e.textContent==='Capturing snapshot...')&&!(await page.$('[name=snapshotRestoring]')));await page.screenshot({path:'/downloads/snapshots-capturing-status-full.png',fullPage:true});
  check('held snapshot capture keeps label editable and duplicate click suppressed',captureCount===1&&await page.$eval('.snapshot-create button',e=>e.disabled)&&await page.$eval('[name=label]',e=>!e.disabled&&e.value==='Newer pending snapshot draft'));
  const captureResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===`/api${P}/snapshots`);releaseCapture();const capturedBody=await(await captureResponse).json();await page.waitForFunction(()=>document.querySelector('.snapshot-create button')?.getAttribute('aria-busy')==='false'&&(!document.querySelector('[name=label]').value.trim()||!document.querySelector('.snapshot-create button').disabled)&&!document.querySelector('[name=snapshotListLoading]')&&document.querySelector('.snapshot-list')?.textContent.includes('Keep retry label'));const capturedSnapshots=await call(`${P}/snapshots`,null,token);
  check('successful actual capture persists old submitted label and retains newer draft without extra capture',captureCount===1&&capturedBody.label==='Keep retry label'&&capturedSnapshots.some(s=>s.label==='Keep retry label')&&!capturedSnapshots.some(s=>s.label==='Newer pending snapshot draft')&&await page.$eval('[name=label]',e=>e.value==='Newer pending snapshot draft')&&!(await page.$('[role=alert]')));page.off('request',holdCapture);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-newer-capture-draft-full.png',fullPage:true});

  let failedCaptures=0,failedCaptureHeld=false,releaseFailedCapture;const failedCaptureGate=new Promise(r=>releaseFailedCapture=r);await page.setRequestInterception(true);const failCapture=async req=>{if(req.method()==='POST'&&new URL(req.url()).pathname===`/api${P}/snapshots`){failedCaptures++;failedCaptureHeld=true;await failedCaptureGate;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-capture-error'})});}return req.continue();};page.on('request',failCapture);const beforeFailedCapture=await page.$eval('.snapshot-list',e=>e.textContent);await page.click('.snapshot-create button');for(let n=0;n<100&&!failedCaptureHeld;n++)await new Promise(r=>setTimeout(r,20));if(!failedCaptureHeld)throw new Error('failed capture not held');await page.waitForFunction(()=>document.querySelector('.snapshot-create button')?.disabled&&!document.querySelector('.notice'));
  check('new held snapshot capture clears stale success notice without dropping current list or draft',!(await page.$('.notice'))&&await page.$eval('.snapshot-create button',e=>e.disabled)&&await page.$eval('[name=label]',e=>e.value==='Newer pending snapshot draft')&&await page.$eval('.snapshot-list',(e,text)=>e.textContent===text,beforeFailedCapture));
  const failedCaptureResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===`/api${P}/snapshots`);releaseFailedCapture();const failedCaptureBody=await(await failedCaptureResponse).json();await page.waitForSelector('[role=alert]');await page.waitForFunction(()=>document.querySelector('.snapshot-create button')?.getAttribute('aria-busy')==='false');
  check('actual failed snapshot capture keeps draft and rows with fixed uncertain-outcome guidance not raw detail',failedCaptures===1&&failedCaptureBody.message==='private-capture-error'&&await page.$eval('[role=alert]',e=>e.textContent.includes('Capture outcome unconfirmed.'))&&!(await page.content()).includes('private-capture-error')&&!(await page.$('.notice'))&&await page.$eval('[name=label]',e=>e.value==='Newer pending snapshot draft')&&await page.$eval('.snapshot-list',(e,text)=>e.textContent===text,beforeFailedCapture)&&!(await page.$('[name=snapshotListError]')));page.off('request',failCapture);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-capture-failure-full.png',fullPage:true});

  await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForSelector('.snapshot-row');await page.type('[name=label]','Capture before leaving');let leavingHeld=false,releaseLeaving;const leavingGate=new Promise(r=>releaseLeaving=r);await page.setRequestInterception(true);const holdLeaving=async req=>{if(req.method()==='POST'&&new URL(req.url()).pathname===`/api${P}/snapshots`){leavingHeld=true;await leavingGate;}return req.continue();};page.on('request',holdLeaving);await page.click('.snapshot-create button');for(let n=0;n<100&&!leavingHeld;n++)await new Promise(r=>setTimeout(r,20));if(!leavingHeld)throw new Error('leaving capture not held');await page.click('.back');await page.waitForSelector('.sync-link');let afterLeaveReads=0;const watchAfterLeave=req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/snapshots`)afterLeaveReads++;};page.on('request',watchAfterLeave);const leavingResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===`/api${P}/snapshots`);releaseLeaving();const leavingBody=await(await leavingResponse).json();await new Promise(r=>setTimeout(r,200));const leavingSnapshots=await call(`${P}/snapshots`,null,token);
  check('late successful capture persists submitted snapshot without stale list read or notice after leaving component',leavingBody.label==='Capture before leaving'&&leavingSnapshots.some(s=>s.label==='Capture before leaving')&&afterLeaveReads===0&&new URL(page.url()).pathname===P&&!(await page.$('.snapshot-list'))&&!(await page.content()).includes('Snapshot captured'));
  check('destroyed snapshot capture completion leaves editor without runtime error',!!(await page.$('.sync-link'))&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));page.off('request',watchAfterLeave);page.off('request',holdLeaving);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-capture-leave-full.png',fullPage:true});

  await page.click('a[href$="/snapshots"]');await page.waitForSelector('.snapshot-row');await page.type('[name=label]','Failed capture after leaving');let lateFailureHeld=false,releaseLateFailure;const lateFailureGate=new Promise(r=>releaseLateFailure=r);await page.setRequestInterception(true);const failLeaving=async req=>{if(req.method()==='POST'&&new URL(req.url()).pathname===`/api${P}/snapshots`){lateFailureHeld=true;await lateFailureGate;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-capture-after-leave'})});}return req.continue();};page.on('request',failLeaving);await page.click('.snapshot-create button');for(let n=0;n<100&&!lateFailureHeld;n++)await new Promise(r=>setTimeout(r,20));if(!lateFailureHeld)throw new Error('late failed capture not held');await page.click('.back');await page.waitForSelector('.sync-link');await page.waitForFunction(()=>document.querySelectorAll('td.key').length===4);const beforeLateFailure=await page.$eval('main',e=>e.textContent);let lateFailureReads=0;const watchLateFailure=req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/snapshots`)lateFailureReads++;};page.on('request',watchLateFailure);const lateFailureResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===`/api${P}/snapshots`);releaseLateFailure();const lateFailureBody=await(await lateFailureResponse).json();await new Promise(r=>setTimeout(r,200));
  check('late failed capture after destroy cannot publish snapshot error or list read on current editor',lateFailureBody.message==='private-capture-after-leave'&&lateFailureReads===0&&new URL(page.url()).pathname===P&&await page.$eval('main',(e,text)=>e.textContent===text,beforeLateFailure)&&!(await page.$('.snapshot-list'))&&!(await page.$('[role=alert]'))&&!(await page.content()).includes('Capturing snapshot failed'));
  check('late destroyed capture failure keeps raw detail private without runtime error',!(await page.content()).includes('private-capture-after-leave')&&!!(await page.$('.sync-link'))&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));page.off('request',watchLateFailure);page.off('request',failLeaving);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-capture-late-failure-full.png',fullPage:true});

  await page.click('a[href$="/snapshots"]');await page.waitForSelector('.snapshot-row');await page.type('[name=label]','Capture before restore failure');await page.click('.snapshot-create button');await page.waitForFunction(()=>document.querySelector('.snapshot-create button')?.getAttribute('aria-busy')==='false'&&(!document.querySelector('[name=label]').value.trim()||!document.querySelector('.snapshot-create button').disabled)&&!document.querySelector('[name=snapshotListLoading]')&&document.querySelector('.notice')?.textContent==='Snapshot captured');await page.type('[name=label]','Keep restore draft');const beforeRestoreFailure=await page.$eval('.snapshot-list',e=>e.textContent);let restoreHeld=false,restoreCalls=0,releaseRestore;const restoreGate=new Promise(r=>releaseRestore=r);await page.setRequestInterception(true);const failRestore=async req=>{if(req.method()==='POST'&&new URL(req.url()).pathname.startsWith(`/api${P}/snapshots/`)&&new URL(req.url()).pathname.endsWith('/restore')){restoreCalls++;restoreHeld=true;await restoreGate;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-snapshot-restore'})});}return req.continue();};page.on('request',failRestore);let dialogMessage='';page.once('dialog',async dialog=>{dialogMessage=dialog.message();await dialog.accept();});await page.click('.restore');for(let n=0;n<100&&!restoreHeld;n++)await new Promise(r=>setTimeout(r,20));if(!restoreHeld)throw new Error('restore not held');await page.waitForFunction(()=>!document.querySelector('.notice')&&[...document.querySelectorAll('.restore')].every(e=>e.disabled));
  check('actual held restore exposes only restore live status',await page.$eval('[name=snapshotRestoring]',e=>e.getAttribute('role')==='status'&&e.textContent==='Restoring snapshot...')&&!(await page.$('[name=snapshotCreating]')));await page.screenshot({path:'/downloads/snapshots-restoring-status-full.png',fullPage:true});
  check('confirmed held restore clears old capture notice and disables restore controls with draft retained',dialogMessage.includes('permanently removed')&&dialogMessage.includes('recoverable')&&restoreCalls===1&&await page.$eval('[name=label]',e=>e.value==='Keep restore draft')&&await page.$eval('.snapshot-list',(e,text)=>e.textContent===text,beforeRestoreFailure));
  const restoreResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/restore'));releaseRestore();const restoreBody=await(await restoreResponse).json();await page.waitForSelector('[role=alert]');await page.waitForFunction(()=>!!document.querySelector('[name=snapshotRestoreUnknown]')&&!document.querySelector('[name=snapshotRestoring]'));
  check('actual failed restore retains list and draft with fixed uncertain-outcome error instead of raw detail',restoreBody.message==='private-snapshot-restore'&&await page.$eval('[role=alert]',e=>e.textContent==='Restoring snapshot failed. Check the project before trying again.')&&!(await page.content()).includes('private-snapshot-restore')&&!(await page.$('.notice'))&&await page.$eval('[name=label]',e=>e.value==='Keep restore draft')&&await page.$eval('.snapshot-list',(e,text)=>e.textContent===text,beforeRestoreFailure));page.off('request',failRestore);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-restore-failure-full.png',fullPage:true});await page.click('[name=refreshSnapshots]');await page.waitForFunction(()=>!document.querySelector('[name=snapshotRestoreUnknown]')&&!!document.querySelector('.restore')&&!document.querySelector('.restore').disabled);

  await call(`${P}/keys`,{name:'after-captured-restore'},token);let leavingRestoreHeld=false,releaseLeavingRestore;const leavingRestoreGate=new Promise(r=>releaseLeavingRestore=r);await page.setRequestInterception(true);const holdLeavingRestore=async req=>{if(req.method()==='POST'&&new URL(req.url()).pathname.startsWith(`/api${P}/snapshots/`)&&new URL(req.url()).pathname.endsWith('/restore')){leavingRestoreHeld=true;await leavingRestoreGate;}return req.continue();};page.on('request',holdLeavingRestore);page.once('dialog',dialog=>dialog.accept());await page.click('.restore');for(let n=0;n<100&&!leavingRestoreHeld;n++)await new Promise(r=>setTimeout(r,20));if(!leavingRestoreHeld)throw new Error('leaving restore not held');await page.click('.back');await page.waitForSelector('.sync-link');await page.waitForFunction(()=>document.querySelectorAll('td.key').length===5);let leavingRestoreReads=0;const watchLeavingRestore=req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/snapshots`)leavingRestoreReads++;};page.on('request',watchLeavingRestore);const leavingRestoreResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/restore'));releaseLeavingRestore();const leavingRestoreBody=await(await leavingRestoreResponse).json();await new Promise(r=>setTimeout(r,200));const afterLeavingRestore=await call(`${P}/export/en?flat=true`,null,token);
  check('late successful restore persists server effect without snapshot refetch or notice after leaving component',leavingRestoreBody.restored===true&&leavingRestoreBody.keysRemoved===1&&!('after-captured-restore' in afterLeavingRestore)&&leavingRestoreReads===0&&new URL(page.url()).pathname===P&&!(await page.$('.snapshot-list'))&&!(await page.content()).includes('Restored:'));
  check('destroyed restore completion leaves current editor without runtime error',!!(await page.$('.sync-link'))&&!(await page.$('[role=alert]'))&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));page.off('request',watchLeavingRestore);page.off('request',holdLeavingRestore);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-restore-leave-full.png',fullPage:true});

  await page.click('a[href$="/snapshots"]');await page.waitForSelector('.snapshot-row');const next=await call('/projects',{name:'Next snapshots',slug:'next-snapshots',locales:['en']},token);await call(`/projects/${next.id}/snapshots`,{label:'Next project snapshot'},token);let reusedRestoreHeld=false,releaseReusedRestore;const reusedRestoreGate=new Promise(r=>releaseReusedRestore=r);await page.setRequestInterception(true);const failReusedRestore=async req=>{if(req.method()==='POST'&&new URL(req.url()).pathname.startsWith(`/api${P}/snapshots/`)&&new URL(req.url()).pathname.endsWith('/restore')){reusedRestoreHeld=true;await reusedRestoreGate;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-old-snapshot-visit'})});}return req.continue();};page.on('request',failReusedRestore);await page.type('[name=label]','Old visit draft');page.once('dialog',d=>d.accept());await page.click('.restore');for(let n=0;n<100&&!reusedRestoreHeld;n++)await new Promise(r=>setTimeout(r,20));if(!reusedRestoreHeld)throw new Error('reused restore not held');const route=async id=>page.evaluate(id=>{history.pushState({},'',`/projects/${id}/snapshots`);window.dispatchEvent(new PopStateEvent('popstate'));},id);await route(next.id);await page.waitForFunction(()=>document.querySelector('.snapshot-list')?.textContent.includes('Next project snapshot'));
  check('reused snapshot project route replaces list and clears draft pending notice error',await page.$eval('[name=label]',e=>e.value==='')&&await page.$$eval('.restore',es=>es.every(e=>!e.disabled))&&!(await page.$('[role=alert]'))&&!(await page.$('.notice'))&&await page.$eval('.back',(e,id)=>e.getAttribute('href')===`/projects/${id}`,next.id));await route(project.id);await page.waitForFunction(()=>document.querySelector('.snapshot-list')?.textContent.includes('Capture before restore failure'));await page.type('[name=label]','Repeated project draft');const repeatedVisitList=await page.$eval('.snapshot-list',e=>e.textContent);const reusedRestoreResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/restore'));releaseReusedRestore();const reusedRestoreBody=await(await reusedRestoreResponse).json();await new Promise(r=>setTimeout(r,200));
  check('late first-visit restore failure cannot alter repeated-project list draft or controls',reusedRestoreBody.message==='private-old-snapshot-visit'&&await page.$eval('.snapshot-list',(e,text)=>e.textContent===text,repeatedVisitList)&&await page.$eval('[name=label]',e=>e.value==='Repeated project draft')&&await page.$$eval('.restore',es=>es.every(e=>!e.disabled))&&!(await page.$('[role=alert]'))&&!(await page.$('.notice'))&&!(await page.content()).includes('private-old-snapshot-visit')&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));page.off('request',failReusedRestore);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-repeat-visit-restore-failure-full.png',fullPage:true});

  let oldVisitCaptureHeld=false,releaseOldVisitCapture;const oldVisitCaptureGate=new Promise(r=>releaseOldVisitCapture=r);await page.setRequestInterception(true);const holdOldVisitCapture=async req=>{if(req.method()==='POST'&&new URL(req.url()).pathname===`/api${P}/snapshots`){oldVisitCaptureHeld=true;await oldVisitCaptureGate;}return req.continue();};page.on('request',holdOldVisitCapture);await page.click('.snapshot-create button');for(let n=0;n<100&&!oldVisitCaptureHeld;n++)await new Promise(r=>setTimeout(r,20));if(!oldVisitCaptureHeld)throw new Error('old visit capture not held');await route(next.id);await page.waitForFunction(()=>document.querySelector('.snapshot-list')?.textContent.includes('Next project snapshot'));await route(project.id);await page.waitForFunction(()=>document.querySelector('.snapshot-list')?.textContent.includes('Capture before restore failure'));await page.type('[name=label]','Newer repeated capture draft');const currentCaptureList=await page.$eval('.snapshot-list',e=>e.textContent);let captureVisitReads=0;const watchCaptureVisit=req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/snapshots`)captureVisitReads++;};page.on('request',watchCaptureVisit);const oldVisitCaptureResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===`/api${P}/snapshots`);releaseOldVisitCapture();const oldVisitCaptureBody=await(await oldVisitCaptureResponse).json();await new Promise(r=>setTimeout(r,200));const captureVisitSnapshots=await call(`${P}/snapshots`,null,token);
  check('old successful capture persists submitted project label without clearing repeated-visit draft or refetching list',oldVisitCaptureBody.label==='Repeated project draft'&&captureVisitSnapshots.some(s=>s.id===oldVisitCaptureBody.id&&s.label==='Repeated project draft')&&captureVisitReads===0&&await page.$eval('[name=label]',e=>e.value==='Newer repeated capture draft')&&await page.$eval('.snapshot-list',(e,text)=>e.textContent===text,currentCaptureList)&&!await page.$eval('.snapshot-create button',e=>e.disabled));
  check('old capture success cannot publish notice error raw runtime failure on repeated visit',!(await page.$('.notice'))&&!(await page.$('[role=alert]'))&&new URL(page.url()).pathname===`${P}/snapshots`&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));page.off('request',watchCaptureVisit);page.off('request',holdOldVisitCapture);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-repeat-visit-capture-success-full.png',fullPage:true});

  let mutualCaptureHeld=false,releaseMutualCapture,mutualRestoreCalls=0,mutualDialogs=0;const mutualCaptureGate=new Promise(r=>releaseMutualCapture=r);await page.setRequestInterception(true);const holdMutualCapture=async req=>{const path=new URL(req.url()).pathname;if(req.method()==='POST'&&path.endsWith('/restore'))mutualRestoreCalls++;if(req.method()==='POST'&&path===`/api${P}/snapshots`){mutualCaptureHeld=true;await mutualCaptureGate;}return req.continue();};const watchMutualDialog=async d=>{mutualDialogs++;await d.dismiss();};page.on('dialog',watchMutualDialog);page.on('request',holdMutualCapture);await page.click('.snapshot-create button');for(let n=0;n<100&&!mutualCaptureHeld;n++)await new Promise(r=>setTimeout(r,20));if(!mutualCaptureHeld)throw new Error('mutual capture not held');await page.waitForFunction(()=>[...document.querySelectorAll('.restore')].every(e=>e.disabled));await page.click('.restore');await new Promise(r=>setTimeout(r,100));
  check('actual pending capture disables restore clicks before dialog or POST',mutualRestoreCalls===0&&mutualDialogs===0&&await page.$$eval('.restore',es=>es.length>0&&es.every(e=>e.disabled))&&await page.$eval('.snapshot-create button',e=>e.disabled));releaseMutualCapture();await page.waitForFunction(()=>document.querySelector('.snapshot-create button')?.getAttribute('aria-busy')==='false'&&(!document.querySelector('[name=label]').value.trim()||!document.querySelector('.snapshot-create button').disabled)&&!document.querySelector('[name=snapshotListLoading]'));page.off('dialog',watchMutualDialog);page.off('request',holdMutualCapture);await page.setRequestInterception(false);await page.type('[name=label]','Draft during restore');let mutualRestoreHeld=false,releaseMutualRestore,mutualCaptureCalls=0;const mutualRestoreGate=new Promise(r=>releaseMutualRestore=r);await page.setRequestInterception(true);const holdMutualRestore=async req=>{const path=new URL(req.url()).pathname;if(req.method()==='POST'&&path===`/api${P}/snapshots`)mutualCaptureCalls++;if(req.method()==='POST'&&path.endsWith('/restore')){mutualRestoreHeld=true;await mutualRestoreGate;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-mutual-restore'})});}return req.continue();};page.on('request',holdMutualRestore);page.once('dialog',d=>d.accept());await page.click('.restore');for(let n=0;n<100&&!mutualRestoreHeld;n++)await new Promise(r=>setTimeout(r,20));if(!mutualRestoreHeld)throw new Error('mutual restore not held');await page.waitForFunction(()=>document.querySelector('.snapshot-create button')?.disabled);await page.click('.snapshot-create button');await new Promise(r=>setTimeout(r,100));
  check('actual pending restore disables capture click without extra POST or lost draft',mutualCaptureCalls===0&&await page.$eval('.snapshot-create button',e=>e.disabled)&&await page.$eval('[name=label]',e=>e.value==='Draft during restore'));releaseMutualRestore();await page.waitForSelector('[role=alert]');await page.waitForFunction(()=>!document.querySelector('[name=snapshotRestoring]')&&!!document.querySelector('[name=snapshotRestoreUnknown]'));page.off('request',holdMutualRestore);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/snapshots-mutual-pending-released-full.png',fullPage:true});await page.click('[name=refreshSnapshots]');await page.waitForFunction(()=>!document.querySelector('[name=snapshotRestoreUnknown]')&&!!document.querySelector('.restore')&&!document.querySelector('.restore').disabled);

  // Restore from the first A visit completes only after A -> B -> A.
  await call(`${P}/keys`,{name:'after-repeat-restore-baseline'},token);
  let oldRestoreHeld=false,releaseOldRestore;
  const oldRestoreGate=new Promise(r=>releaseOldRestore=r);
  await page.setRequestInterception(true);
  const holdOldRestore=async req=>{
    const path=new URL(req.url()).pathname;
    if(req.method()==='POST'&&path.startsWith(`/api${P}/snapshots/`)&&path.endsWith('/restore')){
      oldRestoreHeld=true;await oldRestoreGate;
    }
    return req.continue();
  };
  page.on('request',holdOldRestore);page.once('dialog',d=>d.accept());await page.click('.restore');
  for(let n=0;n<100&&!oldRestoreHeld;n++)await new Promise(r=>setTimeout(r,20));
  if(!oldRestoreHeld)throw new Error('old successful restore not held');
  await route(next.id);await page.waitForFunction(()=>document.querySelector('.snapshot-list')?.textContent.includes('Next project snapshot'));
  await route(project.id);await page.waitForFunction(()=>document.querySelector('.snapshot-list')?.textContent.includes('Newer repeated capture draft'));
  await page.type('[name=label]','Newer repeated restore draft');
  const oldRestoreCurrentList=await page.$eval('.snapshot-list',e=>e.textContent);
  let oldRestoreReads=0;
  const watchOldRestore=req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/snapshots`)oldRestoreReads++;};
  page.on('request',watchOldRestore);
  const oldRestoreResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/restore'));
  releaseOldRestore();const oldRestoreBody=await(await oldRestoreResponse).json();
  await new Promise(r=>setTimeout(r,200));
  const oldRestoreExport=await call(`${P}/export/en?flat=true`,null,token);
  check('old successful restore persists server removal without refetching or replacing repeated-visit draft and list',oldRestoreBody.restored===true&&oldRestoreBody.keysRemoved===1&&!('after-repeat-restore-baseline' in oldRestoreExport)&&oldRestoreReads===0&&await page.$eval('[name=label]',e=>e.value==='Newer repeated restore draft')&&await page.$eval('.snapshot-list',(e,text)=>e.textContent===text,oldRestoreCurrentList));
  check('old restore success leaves repeated-visit controls enabled without stale notice error or runtime failure',new URL(page.url()).pathname===`${P}/snapshots`&&!await page.$eval('.snapshot-create button',e=>e.disabled)&&await page.$$eval('.restore',es=>es.length>0&&es.every(e=>!e.disabled))&&!(await page.$('.notice'))&&!(await page.$('[role=alert]'))&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  page.off('request',watchOldRestore);page.off('request',holdOldRestore);await page.setRequestInterception(false);
  await page.screenshot({path:'/downloads/snapshots-repeat-visit-restore-success-full.png',fullPage:true});

  const refreshServerRows=await call(`${P}/snapshots`,null,token);
  let refreshHeld=false,releaseRefresh,refreshReads=0,refreshPosts=0;
  const refreshGate=new Promise(r=>releaseRefresh=r);
  await page.setRequestInterception(true);
  const holdRefresh=async req=>{
    const path=new URL(req.url()).pathname;
    if(req.method()==='POST'&&path.startsWith(`/api${P}/snapshots`))refreshPosts++;
    if(req.method()==='GET'&&path===`/api${P}/snapshots`){refreshReads++;refreshHeld=true;await refreshGate;}
    return req.continue();
  };
  page.on('request',holdRefresh);await page.click('[name=refreshSnapshots]');
  for(let n=0;n<100&&!refreshHeld;n++)await new Promise(r=>setTimeout(r,20));
  if(!refreshHeld)throw new Error('snapshot refresh not held');
  await page.waitForSelector('[name=snapshotListLoading]');await page.click('[name=refreshSnapshots]');
  await new Promise(r=>setTimeout(r,100));
  check('explicit held refresh reads once and hides stale restore rows without mutation or draft loss',refreshReads===1&&refreshPosts===0&&await page.$eval('[name=refreshSnapshots]',e=>e.disabled)&&!(await page.$('.snapshot-list'))&&!(await page.$('[name=snapshotListEmpty]'))&&await page.$eval('[name=label]',e=>e.value==='Newer repeated restore draft'));
  releaseRefresh();await page.waitForFunction(n=>!document.querySelector('[name=snapshotListLoading]')&&document.querySelectorAll('.snapshot-row').length===n,{},refreshServerRows.length);
  check('actual refresh reveals latest automatic snapshot and retains current draft without stale feedback',refreshReads===1&&refreshPosts===0&&await page.$eval('.snapshot-list',e=>e.textContent.includes('before restore of Newer repeated capture draft'))&&await page.$eval('[name=label]',e=>e.value==='Newer repeated restore draft')&&!await page.$eval('[name=refreshSnapshots]',e=>e.disabled)&&!(await page.$('.notice'))&&!(await page.$('[role=alert]'))&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  page.off('request',holdRefresh);await page.setRequestInterception(false);
  await page.screenshot({path:'/downloads/snapshots-explicit-refresh-full.png',fullPage:true});

  // An uncertain capture outcome remains distinct from a failed explicit read.
  let explicitReads=0,explicitPosts=0;
  await page.setRequestInterception(true);
  const failExplicit=req=>{
    const path=new URL(req.url()).pathname;
    if(req.method()==='POST'&&path===`/api${P}/snapshots`){explicitPosts++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-explicit-capture'})});}
    if(req.method()==='GET'&&path===`/api${P}/snapshots`){explicitReads++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-explicit-list'})});}
    return req.continue();
  };
  page.on('request',failExplicit);await page.click('.snapshot-create button');
  await page.waitForFunction(()=>document.querySelector('[name=snapshotCaptureUnknown]')?.textContent.includes('Capture outcome unconfirmed.')&&document.querySelector('.snapshot-create button')?.getAttribute('aria-busy')==='false'&&document.querySelector('.snapshot-create button').disabled);
  await page.click('[name=refreshSnapshots]');await page.waitForSelector('[name=retrySnapshotList]');
  check('failed explicit refresh hides stale rows with separate list and mutation errors and preserved draft',explicitPosts===1&&explicitReads===1&&await page.$eval('[name=label]',e=>e.value==='Newer repeated restore draft')&&!(await page.$('.snapshot-list'))&&!(await page.$('.restore'))&&!(await page.$('[name=snapshotListEmpty]'))&&!(await page.$('[name=refreshSnapshots]'))&&await page.$$eval('[role=alert]',es=>es.length===2&&es.some(e=>e.textContent.includes('Capture outcome unconfirmed.'))&&es.some(e=>e.textContent==='Snapshots unavailable. No snapshots are shown. Retry this read or reload the page.'))&&!(await page.content()).includes('private-explicit-'));
  page.off('request',failExplicit);await page.setRequestInterception(false);
  const watchExplicitRetry=req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/snapshots`)explicitReads++;if(req.method()==='POST'&&path.startsWith(`/api${P}/snapshots`))explicitPosts++;};
  page.on('request',watchExplicitRetry);await page.click('[name=retrySnapshotList]');
  await page.waitForFunction(n=>!document.querySelector('[name=snapshotListLoading]')&&document.querySelectorAll('.snapshot-row').length===n,{},refreshServerRows.length);
  check('retry after failed explicit refresh only reads and restores rows while resolving capture unknown',explicitReads===2&&explicitPosts===1&&await page.$eval('[name=label]',e=>e.value==='Newer repeated restore draft')&&await page.$eval('.snapshot-list',e=>e.textContent.includes('before restore of Newer repeated capture draft'))&&!(await page.$('[name=snapshotListError]'))&&!(await page.$('[name=retrySnapshotList]'))&&!await page.$('[role=alert]')&&!await page.$('[name=snapshotCaptureUnknown]')&&!await page.$eval('[name=refreshSnapshots]',e=>e.disabled)&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  page.off('request',watchExplicitRetry);
  await page.screenshot({path:'/downloads/snapshots-explicit-refresh-retry-full.png',fullPage:true});
  check('settled snapshot mutations remove both pending live statuses',!(await page.$('[name=snapshotCreating]'))&&!(await page.$('[name=snapshotRestoring]')));

  const accessibleLabel='Accessible "quoted" <b>snapshot</b> & label';
  await call(`${P}/snapshots`,{label:accessibleLabel},token);
  await page.click('[name=refreshSnapshots]');
  await page.waitForFunction(label=>[...document.querySelectorAll('.snapshot-label')].some(e=>e.textContent===label),{},accessibleLabel);
  check('each actual restore action names its snapshot while visible text stays compact',await page.$$eval('.snapshot-row',rows=>rows.length>1&&rows.every(row=>{const b=row.querySelector('.restore');return b?.getAttribute('aria-label')==='Restore snapshot '+row.querySelector('.snapshot-label')?.textContent&&b?.textContent==='Restore';})));
  let accessibleRestoreCalls=0,accessibleDialog='';
  const watchAccessible=req=>{if(req.method()==='POST'&&new URL(req.url()).pathname.endsWith('/restore'))accessibleRestoreCalls++;};
  page.on('request',watchAccessible);page.once('dialog',async d=>{accessibleDialog=d.message();await d.dismiss();});
  await page.click('.restore');await new Promise(r=>setTimeout(r,100));
  check('special-character snapshot label stays text and canceled named restore submits nothing',accessibleDialog.includes(accessibleLabel)&&accessibleRestoreCalls===0&&await page.$eval('.snapshot-row',(row,label)=>row.querySelector('.restore')?.getAttribute('aria-label')==='Restore snapshot '+label&&row.querySelector('.snapshot-label')?.textContent===label&&!row.querySelector('.snapshot-label b'),accessibleLabel)&&await page.$eval('[name=label]',e=>e.value==='Newer repeated restore draft')&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  page.off('request',watchAccessible);
  await page.screenshot({path:'/downloads/snapshots-named-restore-actions-full.png',fullPage:true});

  const longLabel='L'.repeat(200);await call(`${P}/snapshots`,{label:longLabel},token);
  await page.setViewport({width:360,height:900});await page.click('[name=refreshSnapshots]');
  await page.waitForFunction(label=>document.querySelector('.snapshot-label')?.textContent===label,{},longLabel);
  check('maximum unbroken snapshot label stays complete with named restore inside narrow viewport',await page.$eval('.snapshot-row',(row,label)=>{const text=row.querySelector('.snapshot-label'),button=row.querySelector('.restore');return text?.textContent===label&&button?.getAttribute('aria-label')==='Restore snapshot '+label&&text.getBoundingClientRect().left>=0&&text.getBoundingClientRect().right<=innerWidth&&button.getBoundingClientRect().right<=innerWidth;},longLabel)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('long label layout retains draft and available refresh restore without runtime failure',await page.$eval('[name=label]',e=>e.value==='Newer repeated restore draft')&&!await page.$eval('.restore',e=>e.disabled)&&!await page.$eval('[name=refreshSnapshots]',e=>e.disabled)&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  await page.screenshot({path:'/downloads/snapshots-long-label-narrow-full.png',fullPage:true});

  await page.setViewport({width:480,height:900});
  await page.$eval('[name=label]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.type('[name=label]','Persisted despite lost capture response');
  let uncertainPosts=0,uncertainReads=0,persistedUncertain;
  await page.setRequestInterception(true);
  const loseCaptureResponse=async req=>{
    if(req.method()==='POST'&&new URL(req.url()).pathname===`/api${P}/snapshots`){
      uncertainPosts++;
      const server=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});
      if(!server.ok)throw new Error(`uncertain fixture server capture: ${server.status}`);
      persistedUncertain=await server.json();
      return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-lost-capture-response'})});
    }
    if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/snapshots`)uncertainReads++;
    return req.continue();
  };
  const beforeUncertainList=await page.$eval('.snapshot-list',e=>e.textContent);
  page.on('request',loseCaptureResponse);const uncertainResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===`/api${P}/snapshots`);await page.click('.snapshot-create button');await(await uncertainResponse).json();
  await page.waitForFunction(()=>document.querySelector('.snapshot-create button')?.getAttribute('aria-busy')==='false'&&document.querySelector('[name=snapshotCaptureUnknown]')?.textContent.includes('Capture outcome unconfirmed.'));
  const uncertainServerRows=await call(`${P}/snapshots`,null,token);
  check('lost capture response keeps uncertain guidance and draft even though real server snapshot persisted',uncertainPosts===1&&uncertainReads===0&&persistedUncertain?.label==='Persisted despite lost capture response'&&uncertainServerRows.some(row=>row.id===persistedUncertain.id)&&await page.$eval('.snapshot-list',(e,text)=>e.textContent===text,beforeUncertainList)&&await page.$eval('[name=label]',e=>e.value==='Persisted despite lost capture response')&&!(await page.content()).includes('private-lost-capture-response')&&!(await page.$('.notice')));
  await page.click('[name=refreshSnapshots]');
  await page.waitForFunction(()=>document.querySelector('.snapshot-label')?.textContent==='Persisted despite lost capture response'&&!document.querySelector('[name=snapshotListLoading]'));
  check('explicit refresh discovers committed uncertain capture without resubmission or draft loss and resolves unknown',uncertainPosts===1&&uncertainReads===1&&await page.$eval('[name=label]',e=>e.value==='Persisted despite lost capture response')&&!await page.$('[role=alert]')&&!await page.$('[name=snapshotCaptureUnknown]')&&!(await page.$('[name=snapshotListError]'))&&!(await page.$('.notice'))&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  page.off('request',loseCaptureResponse);await page.setRequestInterception(false);
  await page.screenshot({path:'/downloads/snapshots-committed-uncertain-capture-full.png',fullPage:true});

  await call(`${P}/keys`,{name:'after-uncertain-restore-baseline'},token);
  let uncertainRestorePosts=0,uncertainRestoreReads=0,committedRestore;
  await page.setRequestInterception(true);
  const loseRestoreResponse=async req=>{
    const path=new URL(req.url()).pathname;
    if(req.method()==='POST'&&path.startsWith(`/api${P}/snapshots/`)&&path.endsWith('/restore')){
      uncertainRestorePosts++;
      const server=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});
      if(!server.ok)throw new Error(`uncertain fixture server restore: ${server.status}`);
      committedRestore=await server.json();
      return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-lost-restore-response'})});
    }
    if(req.method()==='GET'&&path===`/api${P}/snapshots`)uncertainRestoreReads++;
    return req.continue();
  };
  const beforeUncertainRestoreList=await page.$eval('.snapshot-list',e=>e.textContent);
  page.on('request',loseRestoreResponse);page.once('dialog',d=>d.accept());
  const lostRestoreResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/restore'));
  await page.click('.restore');await(await lostRestoreResponse).json();
  await page.waitForFunction(()=>document.querySelector('.snapshot-create button')?.getAttribute('aria-busy')==='false'&&document.querySelector('[role=alert]')?.textContent==='Restoring snapshot failed. Check the project before trying again.');
  const uncertainRestoreExport=await call(`${P}/export/en?flat=true`,null,token);
  check('lost restore response keeps uncertain guidance and current list despite committed server removal',uncertainRestorePosts===1&&uncertainRestoreReads===0&&committedRestore?.restored===true&&committedRestore.keysRemoved===1&&!('after-uncertain-restore-baseline' in uncertainRestoreExport)&&await page.$eval('.snapshot-list',(e,text)=>e.textContent===text,beforeUncertainRestoreList)&&await page.$eval('[name=label]',e=>e.value==='Persisted despite lost capture response')&&!(await page.content()).includes('private-lost-restore-response')&&!(await page.$('.notice')));
  await page.click('[name=refreshSnapshots]');
  await page.waitForFunction(()=>document.querySelector('.snapshot-label')?.textContent==='before restore of Persisted despite lost capture response'&&!document.querySelector('[name=snapshotListLoading]'));
  check('explicit refresh exposes automatic snapshot after committed uncertain restore without resubmission',uncertainRestorePosts===1&&uncertainRestoreReads===1&&await page.$eval('[name=label]',e=>e.value==='Persisted despite lost capture response')&&!(await page.$('[name=snapshotRestoreUnknown]'))&&!(await page.$('[role=alert]'))&&!(await page.$('[name=snapshotListError]'))&&!(await page.$('.notice'))&&!(await page.$('[name=snapshotRestoring]'))&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  page.off('request',loseRestoreResponse);await page.setRequestInterception(false);
  await page.screenshot({path:'/downloads/snapshots-committed-uncertain-restore-full.png',fullPage:true});

  const emptyProject=await call('/projects',{name:'First snapshot project',slug:'first-snapshot-project',locales:['en']},token);
  const emptyP=`/projects/${emptyProject.id}`;
  await route(emptyProject.id);await page.waitForSelector('[name=snapshotListEmpty]');
  check('actual snapshot-free project shows empty read state without stale rows feedback or pending status',await page.$eval('[name=snapshotListEmpty]',e=>e.textContent==='No snapshots yet')&&!(await page.$('.snapshot-row'))&&!(await page.$('.restore'))&&!(await page.$('[role=alert]'))&&!(await page.$('.notice'))&&!(await page.$('[name=snapshotListLoading]'))&&!(await page.$('[name=snapshotCreating]'))&&await page.$eval('[name=label]',e=>e.value==='')&&await page.$eval('.snapshot-create button',e=>e.disabled)&&!await page.$eval('[name=refreshSnapshots]',e=>e.disabled));
  let firstCaptures=0;
  const watchFirstCapture=req=>{if(req.method()==='POST'&&new URL(req.url()).pathname===`/api${emptyP}/snapshots`)firstCaptures++;};
  page.on('request',watchFirstCapture);await page.type('[name=label]','First manual snapshot');
  await page.click('.snapshot-create button');
  await page.waitForFunction(()=>document.querySelector('.snapshot-label')?.textContent==='First manual snapshot'&&!document.querySelector('[name=snapshotListLoading]')&&document.querySelector('.notice')?.textContent==='Snapshot captured');
  const firstServerRows=await call(`${emptyP}/snapshots`,null,token);
  check('actual first capture replaces empty state with persisted row and clears unchanged draft',firstCaptures===1&&firstServerRows.length===1&&firstServerRows[0].label==='First manual snapshot'&&await page.$$eval('.snapshot-row',rows=>rows.length===1)&&!(await page.$('[name=snapshotListEmpty]'))&&await page.$eval('[name=label]',e=>e.value==='')&&await page.$eval('.snapshot-create button',e=>e.disabled&&e.getAttribute('aria-busy')==='false')&&await page.$eval('.restore',e=>!e.disabled&&e.getAttribute('aria-label')==='Restore snapshot First manual snapshot')&&!(await page.$('[role=alert]'))&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  page.off('request',watchFirstCapture);
  await page.screenshot({path:'/downloads/snapshots-first-capture-full.png',fullPage:true});
  console.log(failures?'SNAPSHOT BROWSER CHECKS FAILED':'ALL SNAPSHOT BROWSER CHECKS PASSED');process.exitCode=failures?1:0;
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
