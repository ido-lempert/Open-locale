// Real local browser -> Activity screen -> built API + PostgreSQL.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.RECOVERY_REASON_TEST_PG_PORT ?? 56351), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-recovery-reason-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('recovery_reason_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/recovery_reason_browser`;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  let reason='toString',checks=0,reviews=0,writes=0;const auditId='audit-fixture',asOf='2026-01-01T00:00:00Z';
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;let body;if(path===`/api${P}/sync/deletion-audits`)body={source:'local-deletion-audit-metadata',audits:[{id:auditId,keyId:'key-fixture',keyName:'Title',localeCode:'en',createdAt:asOf,actorId:'actor-fixture'}],nextCursor:null,snapshotIncluded:false,canRestore:false};if(path===`/api${P}/sync/deletion-audits/${auditId}/recovery-preview`){checks++;body={source:'deletion-recovery-eligibility-preview',asOf,eligibleNow:false,reason,canRestore:false,snapshotIncluded:false,historyReplay:false,reservationHeld:false};}if(path===`/api${P}/sync/deletion-audits/${auditId}/recovery-value-review`){reviews++;body={source:'deletion-recovery-value-review',asOf,reviewAvailable:false,reason,value:null,maxValueBytes:32768,canRestore:false,snapshotIncluded:false,historyReplay:false,reservationHeld:false};}if(body)return req.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});await page.goto(`${WEB}${P}/sync/targets`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=auditLoad]');await page.$eval('[name=auditLoad]',e=>e.click());await page.waitForSelector('[name=auditCheck]');
  for(const value of ['toString','__proto__','constructor','hasOwnProperty','valueOf','<private provider detail>',null,42,{},[]]){reason=value;const n=checks;await page.$eval('[name=auditCheck]',e=>e.click());await page.waitForFunction(()=>document.querySelector('.audit-list')?.textContent.includes('Current recovery checks do not pass.'));check('eligibility generic denial '+JSON.stringify(value),checks===n+1&&!await page.$('.recovery-value'));const m=reviews;await page.$eval('[name=auditValueReview]',e=>e.click());await page.waitForSelector('.recovery-value');check('value review generic denial '+JSON.stringify(value),reviews===m+1&&await page.$eval('.recovery-value',e=>e.textContent.includes('Current checks do not allow value review.')&&!e.querySelector('pre'))&&!await page.$('[name=auditRecoverPrepare]'));}
  check('denial never renders provider detail or inherited native text',await page.$eval('.audit-list',e=>!e.textContent.includes('<private provider detail>')&&!e.textContent.includes('function ')&&!e.textContent.includes('[object Object]'))&&!await page.$('.audit-list img'));await page.screenshot({path:'/downloads/recovery-reason-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/recovery-reason-mobile.png',fullPage:true});check('390px denials fit without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-repository-targets')),id='table-fixture';c.targets.set([{id,revision:1,localBranch:'main',locale:'en',owner:'owner',repo:'repo',path:'local.json',remoteBranch:'main'}]);c.previewResult.set({targetId:id,targetRevision:1,baselineVersion:1,branch:'main',locale:'en',remoteSha:'fixture',decisions:[{key:'title',base:'Same retained value',local:'Same retained value',remote:'Same retained value',kind:'unchanged',suggested:'local'}],requiresManual:false});c.draft.set({json:'{}',contentDigest:'fixture',outputKeys:1,absentKeys:0,localChangePlan:{changes:[],setValues:0,removeLocaleValues:0,unchangedValues:1}});});
  await page.waitForSelector('[aria-label="Local draft changes table"]');
  const tableScopes=()=>page.evaluate(()=>{const comparison=document.querySelector('[aria-label="Repository comparison table"]'),changes=document.querySelector('[aria-label="Local draft changes table"]');return comparison.querySelectorAll('th').length===6&&changes.querySelectorAll('th').length===4&&[...comparison.querySelectorAll('th'),...changes.querySelectorAll('th')].every(e=>e.scope==='col')&&changes.querySelector('tbody td').colSpan===4;});
  check('repository comparison and local changes declare all column scopes',await tableScopes());
  await page.$eval('[aria-label="Repository comparison table"] th',e=>e.removeAttribute('scope'));check('negative missing repository heading scope detected',!await tableScopes());await page.$eval('[aria-label="Repository comparison table"] th',e=>e.scope='col');check('repository column scope restored after isolated probe',await tableScopes());
  await page.setViewport({width:1280,height:900});await page.$eval('[aria-label="Repository comparison"]',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:'/downloads/repository-columns-desktop.png'});
  await page.setViewport({width:390,height:844});await page.$eval('[aria-label="Local draft changes table"]',e=>{e.scrollLeft=e.scrollWidth;e.scrollIntoView({block:'center'});});await page.screenshot({path:'/downloads/repository-columns-mobile.png'});check('repository column tables keep390px document fit and no mutation',writes===0&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  reason='value-exists';await page.$eval('[name=auditCheck]',e=>e.click());await page.waitForFunction(()=>document.querySelector('.audit-list')?.textContent.includes('A current locale value already exists. It will not be overwritten.'));await page.$eval('[name=auditValueReview]',e=>e.click());await page.waitForFunction(()=>document.querySelector('.recovery-value')?.textContent.includes('Check the current value before any further recovery.'));check('known overwrite protection guidance retained',!await page.$('[name=auditRecoverPrepare]'));check('read-only denial flows issue no mutations',checks===11&&reviews===11&&writes===0);check('no reason runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

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
