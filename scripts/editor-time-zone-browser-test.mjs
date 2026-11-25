// Real local browser -> Settings metadata timestamp fallback -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.EDITOR_TIME_ZONE_TEST_PG_PORT ?? 56360), WEB_PORT = 4200, API_PORT = 3000;
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




  const keys=await call(`${P}/keys`,null,token),key=keys.find(k=>k.name==='title');
  const root=await call(`${P}/keys/${key.id}/comments`,{body:'Stored root'},token);await call(`${P}/keys/${key.id}/comments`,{body:'Stored reply',parentId:root.id},token);
  const comments=await call(`${P}/keys/${key.id}/comments`,null,token);let writes=0,reads=0,mode='valid';const invalid='<img src=x> '+ 'X'.repeat(400);
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&(path.endsWith('/comments')||path.endsWith('/history'))){reads++;const rows=path.endsWith('/comments')?comments:[{id:path,value:'Saved history value',status:'TRANSLATED',changedBy:{displayName:'Owner'},createdAt:'2026-11-05T10:00:00Z'}];return req.respond({status:200,contentType:'application/json',body:JSON.stringify(rows.map((r,i)=>({...r,createdAt:mode==='valid'?(i?'2026-11-05T12:00:59+02:00':'2026-11-05T10:00:59Z'):i?'':invalid})))});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.comments-toggle');
  const headers=()=>page.$$eval('.grid thead th',es=>es.length===4&&es.every(e=>e.scope==='col')&&es.map(e=>e.textContent).join('|')==='Key|en|he|Actions');
  check('editor key locale and action headers have column scope',await headers());
  await page.$eval('.grid thead th',e=>e.removeAttribute('scope'));
  check('negative missing editor column scope detected',!await headers());
  await page.$eval('.grid thead th',e=>e.scope='col');
  check('column scope restored after isolated probe',await headers());
  const toggle=async cls=>page.evaluate(cls=>{const row=[...document.querySelectorAll('.grid tbody tr:not(.history-row)')].find(r=>r.textContent.includes('title'));row.querySelector(cls).click();},cls);
  await toggle('.comments-toggle');await page.waitForSelector('[name=replyTime]');
  check('expanded metadata spans exact grid columns',await page.$$eval('.history-row > td',es=>es.length>0&&es.every(e=>e.colSpan===document.querySelectorAll('.grid thead th').length)));
  check('root and reply equivalent instants show explicit displayed zone',await page.$$eval('[name=commentTime],[name=replyTime]',es=>es.length===2&&es[0].textContent===es[1].textContent&&/GMT|UTC/.test(es[0].textContent)));check('root and reply datetime keeps exact source',await page.$$eval('[name=commentTime],[name=replyTime]',es=>es.every(e=>e.tagName==='TIME')&&es[0].getAttribute('datetime')==='2026-11-05T10:00:59Z'&&es[1].getAttribute('datetime')==='2026-11-05T12:00:59+02:00'));await page.$eval('[name=commentDraft]',e=>{e.value='Unsubmitted draft';e.dispatchEvent(new Event('input',{bubbles:true}));});
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval(label==='history'?'[name=historyTime]':'[name=commentTime]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`/downloads/editor-zone-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval(label==='history'?'[name=historyTime]':'[name=commentTime]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`/downloads/editor-zone-${label}-mobile.png`});check(`${label} medium zone timestamps fit390px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));};await capture('comments');mode='invalid';await page.$eval('[name=refreshComments]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=commentTime]')?.textContent==='Time unavailable');check('invalid comment reread retains draft and omits datetime',await page.$eval('[name=commentDraft]',e=>e.value==='Unsubmitted draft')&&await page.$$eval('[name=commentTime],[name=replyTime]',es=>es.every(e=>e.textContent==='Time unavailable'&&!e.hasAttribute('datetime'))));mode='valid';await toggle('.history-toggle');await page.waitForSelector('[name=historyTime]');check('history recorded clocks include zone and valid raw datetime',await page.$$eval('[name=historyTime]',es=>es.length===2&&es.every(e=>/GMT|UTC/.test(e.textContent)&&e.getAttribute('datetime')==='2026-11-05T10:00:59Z')));await capture('history');mode='invalid';await page.$eval('[name=refreshHistory]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=historyTime]')?.textContent==='Time unavailable');check('invalid history retains stored value with fallback no datetime',await page.$eval('[name=historyTime]',e=>!e.hasAttribute('datetime')&&e.closest('.history-row').textContent.includes('Saved history value')));check('source timestamps and drafts never written by display',writes===0&&reads===6);check('no editor timezone runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;

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
