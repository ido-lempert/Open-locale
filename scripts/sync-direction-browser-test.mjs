// Real local browser -> Activity screen -> built API + PostgreSQL.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SYNC_DIRECTION_TEST_PG_PORT ?? 56350), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-sync-direction-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('sync_direction_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/sync_direction_browser`;
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


  const values=['none','push','pull','manual','toString','__proto__','constructor','hasOwnProperty','<img src=x onerror=fail>',null,42,{},[]],decisions=values.map((suggested,i)=>({key:'row'+i,base:'Old',local:'Local',remote:'Remote',suggested,kind:'conflict'}));let previews=0,otherWrites=0;
  await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname===`/api${P}/sync/preview`&&req.method()==='POST'){previews++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({projectId:project.id,branch:'main',locale:'en',fingerprint:'fixture',remoteSha:'a'.repeat(40),baselineVerified:false,remoteVerified:false,canApply:false,requiresManual:true,decisions})});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))otherWrites++;req.continue();});await page.goto(`${WEB}${P}/sync`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=syncBaseline]');const set=async(name,value)=>page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await set('syncSha','a'.repeat(40));await set('syncBaseline','{"row":"Old"}');await set('syncRemote','{"row":"Remote"}');await page.$eval('[name=syncPreview]',e=>e.click());await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===13);
  const scopedHeaders=()=>page.$$eval('thead th',es=>es.length===6&&es.every(e=>e.scope==='col')&&es.map(e=>e.textContent.trim()).join('|')==='Key|Baseline|Local|Remote|Suggested direction|Draft selection');
  check('file comparison headings declare exact column scope',await scopedHeaders());
  await page.$eval('thead th',e=>e.removeAttribute('scope'));check('negative missing file comparison heading scope detected',!await scopedHeaders());await page.$eval('thead th',e=>e.scope='col');check('file comparison scope restored after isolated probe',await scopedHeaders());
  const expected=['No change','Local to remote','Remote to local','Manual review',...values.slice(4,9),'Direction unavailable','Direction unavailable','Direction unavailable','Direction unavailable'].map(s=>s+' (conflict)');check('known literal unknown and malformed directions render exactly',await page.$$eval('tbody tr',rs=>JSON.stringify(rs.map(r=>r.cells[4].textContent.trim())),[])===JSON.stringify(expected));check('literal markup creates no element or inherited function display',!await page.$('tbody img')&&!(await page.$eval('tbody',e=>e.textContent)).includes('function toString()'));
  check('all conflicting rows still require explicit choice',await page.$$eval('[data-resolution-key]',es=>es.length===13&&es.every(e=>e.value===''))&&await page.$eval('[name=syncResolve]',e=>e.disabled));check('preview remains unverified not applied and no apply control',await page.$eval('section[aria-label="Preview results"]',e=>e.textContent.includes('Not applied.')&&e.textContent.includes('Remote and baseline remain unverified.'))&&!await page.$$eval('button',es=>es.some(e=>/apply|push|pull|save/i.test(e.textContent))));
  await page.screenshot({path:'/downloads/sync-direction-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/sync-direction-mobile.png',fullPage:true});check('390px comparison scroll is internal',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('.table-wrap',e=>e.scrollWidth>e.clientWidth));await page.$eval('.table-wrap',e=>{e.scrollLeft=e.querySelector('tbody tr').cells[4].offsetLeft-16;e.scrollIntoView({block:'start'});});await new Promise(r=>setTimeout(r,350));await page.screenshot({path:'/downloads/sync-direction-mobile-labels.png'});check('narrow scroll exposes literal and bounded direction cells',await page.$$eval('tbody tr',rs=>rs.every(r=>{const x=r.cells[4].getBoundingClientRect();return x.left>=0&&x.right<=innerWidth;})));
  await page.$eval('[data-resolution-key=row4]',e=>{e.value='local';e.dispatchEvent(new Event('change',{bubbles:true}));});check('direction display does not autochoose remaining conflicts',await page.$eval('[name=syncResolve]',e=>e.disabled)&&await page.$$eval('[data-resolution-key]',es=>es.filter(e=>e.value).length===1));await set('syncRemote','{"row":"Changed"}');await page.waitForFunction(()=>!document.querySelector('section[aria-label="Preview results"]'));check('input edit invalidates preview and choices without mutation',!await page.$('[name=syncResolve]')&&previews===1&&otherWrites===0);check('no direction runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

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
