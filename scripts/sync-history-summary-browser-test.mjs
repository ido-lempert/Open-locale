// Real local browser -> Webhook recorded-success metadata -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SYNC_HISTORY_SUMMARY_TEST_PG_PORT ?? 56332), WEB_PORT = 4200, API_PORT = 3000;
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




  const values=[null,'1',1,true,[],[1],{}, {total:1,conflict:1,manual:1,privateField:'PRIVATE_SUMMARY'}],rows=values.map((summary,i)=>({id:'r'+i,branch:'main',locale:'en',remoteSha:'aa',fingerprint:'bb',createdAt:'2026-01-01T00:00:00Z',summary}));rows.push({id:'omitted',branch:'main',locale:'en',remoteSha:'aa',fingerprint:'bb',createdAt:'2026-01-01T00:00:00Z'});let reads=0,writes=0;
  await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname===`/api${P}/sync/preview-records`&&req.method()==='GET'){reads++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({records:rows})});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});
  await page.goto(`${WEB}${P}/sync/history`,{waitUntil:'networkidle0'});await page.waitForSelector('article');check('missing and malformed summary containers render bounded unavailable counts',await page.$$eval('article',es=>es.length===9&&[...es.slice(0,7),es[8]].every(e=>e.textContent.includes('Key count unavailable')&&e.textContent.includes('Conflict count unavailable')&&e.textContent.includes('Manual-review count unavailable'))));check('valid summary retains counts without extra private field rendering',await page.$$eval('article',es=>es[7].textContent.includes('1 key')&&es[7].textContent.includes('1 conflict')&&es[7].textContent.includes('1 manual-review key'))&&!(await page.content()).includes('PRIVATE_SUMMARY'));
  await page.$eval('article',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/sync-history-summary-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('article',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/sync-history-summary-mobile.png'});check('390px missing-summary labels fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const kind of ['conflict','manual']){await page.select('[name=syncHistoryAttention]',kind);await page.waitForFunction(()=>document.querySelectorAll('article').length===1);check(`${kind} safely skips unavailable summary without requests`,await page.$eval('article',e=>e.textContent.includes('1 manual-review key'))&&reads===1&&writes===0);}await page.click('[name=clearAllSyncHistoryFilters]');await page.waitForFunction(()=>document.querySelectorAll('article').length===9);check('clear restores malformed containers without source repair',reads===1&&writes===0);
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__diagnosticDownload=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.click('[name=downloadSyncHistory]');await page.waitForFunction(()=>!!window.__diagnosticDownload);check('download safely projects allowlisted summary fields without private extras',await page.evaluate(()=>{const d=window.__diagnosticDownload;return d.records.length===9&&[...d.records.slice(0,7),d.records[8]].every(r=>JSON.stringify(r.summary)==='{}')&&JSON.stringify(d.records[7].summary)==='{"total":1,"conflict":1,"manual":1}'&&!JSON.stringify(d).includes('PRIVATE_SUMMARY')&&d.canApply===false&&d.remoteVerified===false&&d.baselineVerified===false;}));
  check('no summary-container runtime errors or writes',writes===0&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

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
