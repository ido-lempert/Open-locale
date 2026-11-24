// Local browser -> loaded diagnostic-history search -> real API/Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SYNC_HISTORY_CLEAR_TEST_PG_PORT ?? 56322), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;const downloadDir=mkdtempSync(join(tmpdir(),'ol-qa-download-'));
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-list-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_list_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_list_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  await call(`${P}/import/en`,{entries:{title:'Base'}},token);await call(`${P}/import/he`,{entries:{title:'Local'}},token);
  await call(`${P}/sync/preview-records`,{branch:'main',locale:'he',baselineJson:'{"title":"Old"}',remoteJson:'{"title":"Remote"}',remoteSha:'a'.repeat(40)},token);
  await call(`${P}/sync/preview-records`,{branch:'main',locale:'en',baselineJson:'{}',remoteJson:'{}',remoteSha:'b'.repeat(40)},token);
  const expected=await call(`${P}/sync/preview-records`,undefined,token);if(expected.records.length!==2||expected.records.filter(r=>r.summary.conflict>0).length!==1)throw new Error('Expected real conflict diagnostic');
  const second=await call('/projects',{name:'Empty',slug:'empty-attention',locales:['en']},token);await page.goto(`${WEB}${P}/sync/history`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
  let reads=0,writes=0,fail=false;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){if(req.method()==='GET'){reads++;if(fail)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE"}'});}else writes++;}req.continue();});
  check('Clear all disabled with no local choices',await page.$eval('[name=clearAllSyncHistoryFilters]',e=>e.disabled));await page.select('[name=syncHistoryOrder]','oldest');await page.select('[name=syncHistoryAttention]','conflict');await page.type('[name=syncHistorySearch]',' EN ');await page.waitForFunction(()=>document.querySelectorAll('article').length===0);check('combined no-match leaves explicit local reset available',!await page.$eval('[name=clearAllSyncHistoryFilters]',e=>e.disabled)&&await page.$eval('.empty',e=>e.textContent.includes('attention filter and search')));
  await page.click('[name=clearAllSyncHistoryFilters]');await page.waitForFunction(()=>document.querySelectorAll('article').length===2);check('Clear all restores both loaded records retaining time order without requests',reads===0&&writes===0&&await page.$eval('[name=syncHistoryAttention]',e=>e.value==='')&&await page.$eval('[name=syncHistorySearch]',e=>e.value==='')&&await page.$eval('[name=syncHistoryOrder]',e=>e.value==='oldest')&&await page.$eval('[name=clearAllSyncHistoryFilters]',e=>e.disabled));
  await page.$eval('[name=clearAllSyncHistoryFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/sync-history-clear-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=clearAllSyncHistoryFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/sync-history-clear-mobile.png'});check('390px reset and local-only scope fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=clearAllSyncHistoryFiltersScope]',e=>e.textContent.includes('Time order and loaded records stay')));
  await page.$eval('[name=syncHistorySearch]',e=>{e.value='   ';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>!document.querySelector('[name=clearAllSyncHistoryFilters]').disabled);check('whitespace-only search remains clearable',!await page.$eval('[name=clearAllSyncHistoryFilters]',e=>e.disabled));await page.click('[name=clearAllSyncHistoryFilters]');await page.waitForFunction(()=>document.querySelector('[name=syncHistorySearch]').value==='');
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-sync-history')).downloadNotice.set('Earlier download requested'));await page.select('[name=syncHistoryAttention]','manual');await page.click('[name=clearAllSyncHistoryFilters]');await page.waitForFunction(()=>document.querySelectorAll('article').length===2);check('reset preserves earlier download feedback and diagnostic caveat',await page.$eval('[name=syncHistoryDownloadNotice]',e=>e.textContent==='Earlier download requested')&&await page.$eval('.notice',e=>e.textContent.includes('No record can apply changes'))&&reads===0&&writes===0);
  fail=true;await page.click('[name=syncHistoryRefresh]');await page.waitForSelector('[role=alert]');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-sync-history'));c.query.set('x');c.setAttention('manual');c.clearFilters();});check('clear after failed read cannot claim loaded success or restore old records',!!await page.$('[role=alert]')&&!await page.$('article')&&await page.$eval('[name=downloadSyncHistory]',e=>e.disabled)&&reads===1&&writes===0);fail=false;await page.click('[name=syncHistoryRefresh]');await page.waitForFunction(()=>document.querySelectorAll('article').length===2);check('explicit retry restores records and chosen order',reads===2&&writes===0&&await page.$eval('[name=syncHistoryOrder]',e=>e.value==='oldest'));
  check('no clear-filter runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(!completed||failures?1:0);
