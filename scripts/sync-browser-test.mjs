// Real local browser -> Angular file preview -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55479, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, mock, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-sync-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('sync_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/sync_browser`;
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token)=>{const r=await fetch(`${API}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const member=await call('/auth/signup',{email:'sync-member@example.com',password:'pass1234',displayName:'Member'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  await call(`${P}/members`,{email:member.user.email,role:'MEMBER'},token);
  await call(`${P}/import/en`,{entries:{title:'Local title',conflict:'Local edit',remote:'Old text',empty:''}},token);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);
  await page.goto(`${WEB}/projects/${project.id}`,{waitUntil:'networkidle0'});
  await page.click('.sync-link');await page.waitForSelector('textarea[name=syncBaseline]');
  check('editor links to file preview screen',new URL(page.url()).pathname.endsWith('/sync'));
  check('provenance and no-write warning visible',(await page.content()).includes('not verified with GitHub') && (await page.content()).includes('Nothing is uploaded, imported or saved'));
  const set=async(name,value)=>page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await set('syncSha','a'.repeat(40));
  await set('syncBaseline',JSON.stringify({title:'Old title',conflict:'Old edit',remote:'Old text',empty:''}));
  await set('syncRemote',JSON.stringify({title:'Old title',conflict:'Remote edit',remote:'New text',empty:''}));
  await page.click('button[name=syncPreview]');await page.waitForSelector('section[aria-label="Preview results"]');
  check('real API preview shows local remote and manual directions',(await page.$eval('tbody',e=>e.textContent)).includes('Local to remote') && (await page.$eval('tbody',e=>e.textContent)).includes('Remote to local') && (await page.$eval('tbody',e=>e.textContent)).includes('Manual review'));
  check('empty string displayed distinctly',(await page.$eval('tbody',e=>e.textContent)).includes('[empty string]'));
  check('preview has no apply action',!(await page.$$eval('button',nodes=>nodes.some(n=>/apply|push|pull|save/i.test(n.textContent)))));
  await page.screenshot({path:'/downloads/sync-preview-desktop.png',fullPage:true});
  await page.setViewport({width:480,height:900});await page.screenshot({path:'/downloads/sync-preview-narrow.png',fullPage:true});
  check('narrow screen has no document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('comparison table has its own horizontal scroll',await page.$eval('.table-wrap',e=>e.scrollWidth>e.clientWidth));
  await set('syncRemote','{');check('input change clears stale preview',!(await page.$('section[aria-label="Preview results"]')));
  await page.click('button[name=syncPreview]');await page.waitForSelector('[role=alert]');
  check('invalid JSON reports error without old preview',!(await page.$('section[aria-label="Preview results"]')) && (await page.$eval('[role=alert]',e=>e.textContent)).includes('duplicate-free'));
  // Delay one real API response and edit input while it is in flight.
  let release; const gate=new Promise(resolve=>release=resolve);let held=false;
  await page.setRequestInterception(true);
  const intercept=async request=>{if(!held&&request.url().endsWith('/sync/preview')){held=true;await gate;}await request.continue();};
  page.on('request',intercept);
  await set('syncRemote','{}');await page.click('button[name=syncPreview]');
  await page.waitForFunction(()=>document.querySelector('button[name=syncPreview]').disabled);
  await set('syncBaseline','{}');release();await new Promise(r=>setTimeout(r,700));
  check('input change discards in-flight stale result',!(await page.$('section[aria-label="Preview results"]')));
  page.off('request',intercept);await page.setRequestInterception(false);
  const after=await call(`${P}/export/en?flat=true`,undefined,token);
  check('browser comparison did not write local translations',after.title==='Local title'&&after.remote==='Old text'&&after.conflict==='Local edit');
  // Caller strings must render literally, not execute as markup.
  const hostile='<img src=x onerror="window.syncXss=true">';
  await set('syncBaseline','{}');await set('syncRemote',JSON.stringify({unsafe:hostile}));await page.click('button[name=syncPreview]');
  await page.waitForSelector('section[aria-label="Preview results"]');
  check('caller file values rendered as literal text without HTML execution',await page.$eval('tbody',e=>e.textContent.includes('<img src=x')) && !(await page.$('tbody img')) && !await page.evaluate(()=>window.syncXss));
  const many=Object.fromEntries(Array.from({length:121},(_,i)=>['key'+String(i).padStart(3,'0'),'remote '+i]));
  await set('syncRemote',JSON.stringify(many));await page.click('button[name=syncPreview]');await page.waitForSelector('button[name=syncNext]');
  check('large comparison renders only fifty rows',await page.$$eval('tbody tr',rows=>rows.length===50));
  check('first page has disabled Previous',await page.$eval('button[name=syncPrevious]',e=>e.disabled));
  await page.click('button[name=syncNext]');
  await page.waitForFunction(()=>document.querySelector('tbody')?.textContent.includes('key050'));
  check('next page shows distinct keys',await page.$eval('tbody',e=>e.textContent.includes('key050')&&!e.textContent.includes('key000')));
  await page.click('button[name=syncNext]');
  await page.waitForFunction(()=>document.querySelector('tbody')?.textContent.includes('key120'));
  check('last page preserves remaining keys and disables Next',await page.$eval('tbody',e=>e.textContent.includes('key120')) && await page.$eval('button[name=syncNext]',e=>e.disabled));
  await page.$eval('nav[aria-label="Comparison pages"]',e=>e.scrollIntoView({block:'end'}));
  await page.screenshot({path:'/downloads/sync-preview-pagination.png'});
  await set('syncRemote','{}');await page.click('button[name=syncPreview]');await page.waitForSelector('section[aria-label="Preview results"]');
  check('new preview resets pagination to first page',!(await page.$('button[name=syncNext]')) && await page.$eval('tbody',e=>e.textContent.includes('title')));
  // Drive Router navigation without reloading to prove reused scope resets.
  const second=await call('/projects',{name:'Second scope',slug:'second-scope',locales:['en']},token);
  await page.evaluate(id=>{const link=window.ng.getDirectives(document.querySelector('.back')).find(d=>d.router);return link.router.navigateByUrl('/projects/'+id+'/sync');},second.id);
  await page.waitForFunction(id=>location.pathname==='/projects/'+id+'/sync',{},second.id);
  await page.waitForSelector('textarea[name=syncBaseline]');
  check('same-component project navigation resets file inputs',await page.$eval('[name=syncBaseline]',e=>e.value==='') && await page.$eval('[name=syncRemote]',e=>e.value==='') && !(await page.$('section[aria-label="Preview results"]')));
  await page.goto(`${WEB}/projects/${project.id}/sync`,{waitUntil:'networkidle0'});await page.waitForSelector('.history-link');await page.click('.history-link');
  await page.waitForFunction(()=>document.body.textContent.includes('No diagnostic preview records'));
  check('preview links to empty diagnostic history with non-sync explanation',(await page.content()).includes('not completed syncs or accepted baselines') && !(await page.$('article')));
  const recordInput={branch:'main',locale:'en',baselineJson:'{}',remoteJson:'{"title":"remote diagnostic"}',remoteSha:'a'.repeat(40)};
  const saved=await call(`${P}/sync/preview-records`,recordInput,token);
  await page.click('button[name=syncHistoryRefresh]');await page.waitForSelector('article');
  check('explicit API record appears after UI refresh',(await page.$eval('article',e=>e.textContent)).includes(saved.record.fingerprint) && (await page.$eval('article',e=>e.textContent)).includes('not applied'));
  check('history displays counts not private file values',!(await page.content()).includes('remote diagnostic') && (await page.$eval('article',e=>e.textContent)).includes('keys'));
  check('history has no apply action',!(await page.$$eval('button',nodes=>nodes.some(n=>/apply|save|push/i.test(n.textContent)))));
  await page.setViewport({width:1280,height:900});await page.screenshot({path:'/downloads/sync-history-desktop.png',fullPage:true});
  await page.setViewport({width:480,height:900});await page.screenshot({path:'/downloads/sync-history-narrow.png',fullPage:true});
  check('history fingerprint wraps without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(id=>{const link=window.ng.getDirectives(document.querySelector('.back')).find(d=>d.router);return link.router.navigateByUrl('/projects/'+id+'/sync/history');},second.id);
  await page.waitForFunction(()=>document.body.textContent.includes('No diagnostic preview records'));
  check('same-component history navigation clears previous project record',!(await page.$('article')) && !(await page.content()).includes(saved.record.fingerprint));
  await page.evaluate(t=>localStorage.setItem('ol_token',t),member.accessToken);
  await page.goto(`${WEB}/projects/${project.id}/sync`,{waitUntil:'networkidle0'});await page.waitForSelector('textarea[name=syncBaseline]');
  await set('syncSha','a'.repeat(40));await set('syncBaseline','{}');await set('syncRemote','{}');await page.click('button[name=syncPreview]');await page.waitForSelector('[role=alert]');
  check('member gets explicit permission error and no preview',(await page.$eval('[role=alert]',e=>e.textContent)).includes('admin')&&!(await page.$('section[aria-label="Preview results"]')));
  await page.goto(`${WEB}/projects/${project.id}/sync/history`,{waitUntil:'networkidle0'});await page.waitForSelector('[role=alert]');
  check('member history denial exposes no saved record',!(await page.$('article')) && (await page.$eval('[role=alert]',e=>e.textContent)).includes('admin'));
  console.log(failures?'SYNC BROWSER CHECKS FAILED':'ALL SYNC BROWSER CHECKS PASSED');process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
finally {
  await browser?.close();
  // Nx serve launches a child server. Reap its process group, not only Nx,
  // so a successful suite does not leave the web listener behind.
  const stopped = [web,api,mock].filter(Boolean).map(child => new Promise(resolve => {
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
