// Local browser -> loaded diagnostic-history search -> real API/Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55726, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;const downloadDir=mkdtempSync(join(tmpdir(),'ol-qa-download-'));
process.exitCode = 1;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  await call(`${P}/import/en`,{entries:{title:'Base'}},token);await call(`${P}/import/he`,{entries:{title:'Local'}},token);
  await call(`${P}/sync/preview-records`,{branch:'main',locale:'he',baselineJson:'{"title":"Old"}',remoteJson:'{"title":"Remote"}',remoteSha:'a'.repeat(40)},token);
  await call(`${P}/sync/preview-records`,{branch:'main',locale:'en',baselineJson:'{}',remoteJson:'{}',remoteSha:'b'.repeat(40)},token);
  const expected=await call(`${P}/sync/preview-records`,undefined,token);if(expected.records.length!==2||expected.records.filter(r=>r.summary.conflict>0).length!==1)throw new Error('Expected real conflict diagnostic');
  const second=await call('/projects',{name:'Empty',slug:'empty-attention',locales:['en']},token);await page.goto(`${WEB}${P}/sync/history`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}req.continue();});await page.select('[name=syncHistoryAttention]','conflict');await page.waitForFunction(()=>document.querySelectorAll('article').length===1);check('recorded conflict filter isolates real caller diagnostic without requests',reads===0&&writes===0&&await page.$eval('article',e=>e.textContent.includes('main / he')));
  await page.type('[name=syncHistorySearch]',' EN ');await page.waitForFunction(()=>document.querySelectorAll('article').length===0);check('attention/search intersection explains filtered empty without losing diagnostic disclaimer',await page.$eval('.empty',e=>e.textContent.includes('attention filter and search'))&&await page.$eval('.notice',e=>e.textContent.includes('No record can apply changes')));
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'sync-diagnostics.json');await page.click('[name=downloadSyncHistory]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const data=JSON.parse(readFileSync(file,'utf8'));rmSync(file);check('actual downloaded JSON retains both loaded records despite filters and keeps unverified flags',data.records.length===2&&data.canApply===false&&data.baselineVerified===false&&data.remoteVerified===false&&reads===0&&writes===0&&await page.$eval('[name=syncHistoryDownloadScope]',e=>e.textContent.includes('regardless of search or attention filter')));
  await page.screenshot({path:'/downloads/sync-history-attention-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/sync-history-attention-mobile.png',fullPage:true});check('390px attention controls/scope fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=syncHistoryAttentionScope]',e=>e.textContent.includes('recorded caller-file counts only')));
  await page.click('[name=clearSyncHistorySearch]');await page.waitForFunction(()=>document.querySelectorAll('article').length===1);await page.select('[name=syncHistoryAttention]','manual');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-sync-history')).loading());const manual=expected.records.filter(r=>r.summary.manual>0).length;await page.waitForFunction(n=>document.querySelectorAll('article').length===n,{},manual);check('manual-review filter matches actual persisted summary counts',await page.$$eval('article',es=>es.length)===manual&&reads===0&&writes===0);
  await page.click('[name=clearSyncHistoryAttention]');await page.waitForFunction(()=>document.querySelectorAll('article').length===2);check('Clear restores all loaded records locally',reads===0&&writes===0);await page.select('[name=syncHistoryAttention]','conflict');await page.$eval('[name=syncHistoryRefresh]',e=>e.click());for(let n=0;n<100&&reads!==1;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-sync-history')).loading()&&document.querySelectorAll('article').length===1);check('explicit reread retains recorded attention',reads===1&&writes===0&&await page.$eval('[name=syncHistoryAttention]',e=>e.value==='conflict'));
  await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${second.id}/sync/history`);await page.waitForFunction(()=>document.body.textContent.includes('No diagnostic preview records'));check('reused project resets attention and original data',await page.$eval('[name=syncHistoryAttention]',e=>e.value==='')&&await page.$$eval('article',es=>es.length===0));await page.evaluate(()=>{window.lastHistory=ng.getComponent(document.querySelector('ol-sync-history'));history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-sync-history'));await page.evaluate(()=>window.lastHistory.setAttention('manual'));check('departed filter rejects state changes',await page.evaluate(()=>window.lastHistory.attention()==='')&&writes===0);
  check('no attention filter runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
