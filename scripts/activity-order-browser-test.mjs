// Real local browser -> Activity screen -> built API + PostgreSQL.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.ACTIVITY_ORDER_TEST_PG_PORT ?? 56265), WEB_PORT = 4200, API_PORT = 3000;
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


  const times=['2026-11-23T09:00:00.500Z','2026-11-23T08:00:00Z','2026-11-23T09:00:00.000Z','2026-11-23T09:00:00.000Z','2026-11-23T07:00:00Z','2020-01-01T00:00:00Z'];
  const names=['late','bad','tie-a','tie-b','empty','old'];
  for(let i=0;i<names.length;i++)await prisma.activityEvent.create({data:{projectId:project.id,actorId:owner.user.id,action:'key.created',keyName:names[i],detail:{value:'PRIVATE'},createdAt:new Date(times[i])}});
  const seed=await prisma.activityEvent.findMany({where:{projectId:project.id,action:'key.created'}});
  const rows=names.map((keyName,i)=>({...seed.find(row=>row.keyName===keyName),actor:{displayName:'Owner'},createdAt:i===1?'malformed':i===4?'':i===2?'2026-11-23T11:00:00+02:00':times[i]}));
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{const url=new URL(req.url());if(url.pathname===`/api${P}/activity`&&req.method()==='GET'){reads++;const older=url.searchParams.has('cursor');return req.respond({status:200,contentType:'application/json',body:JSON.stringify({items:older?rows.slice(5):rows.slice(0,5),nextCursor:older?null:'older'})});}if(['POST','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});
  await page.goto(`${WEB}${P}/activity`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=activityOrder]');
  const keys=()=>page.$$eval('.activity-key',es=>es.map(e=>e.textContent).join(','));
  const select=async value=>{await page.select('[name=activityOrder]',value);await new Promise(r=>setTimeout(r,70));};
  check('loaded default preserves server order and explicit local-only scope',await keys()==='late,bad,tie-a,tie-b,empty'&&await page.$eval('[name=activityOrder]',e=>e.value==='loaded')&&await page.$eval('[name=activityOrderScope]',e=>e.textContent.includes('Downloads keep loaded order')));
  await select('oldest');check('oldest uses full timestamps with stable offset-equivalent ties and unavailable last',await keys()==='tie-a,tie-b,late,bad,empty'&&reads===1&&writes===0);
  await select('newest');check('newest retains subsecond precision without reversing ties or unavailable rows',await keys()==='late,tie-a,tie-b,bad,empty'&&reads===1&&writes===0);
  const search=async value=>{await page.$eval('[name=activitySearch]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await new Promise(r=>setTimeout(r,70));};
  await search('TIE-');check('literal case-insensitive search combines with local order without reads',await keys()==='tie-a,tie-b'&&reads===1);await search('');
  await page.evaluate(()=>{window.__activityDownload=null;URL.createObjectURL=blob=>{blob.text().then(text=>window.__activityDownload=JSON.parse(text));return 'blob:local-test';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});
  await page.click('[name=downloadActivity]');await page.waitForFunction(()=>!!window.__activityDownload);
  check('download retains loaded order and raw timestamps, omits detail and local order',await page.evaluate(()=>{const d=window.__activityDownload;return d.entries.map(e=>e.keyName).join(',')==='late,bad,tie-a,tie-b,empty'&&d.entries[1].createdAt==='malformed'&&!JSON.stringify(d).includes('PRIVATE')&&!('order'in d)&&d.hasMore;}));
  await page.click('.load-more');await page.waitForFunction(()=>document.querySelectorAll('.activity-key').length===6);
  check('load more merges earlier rows into current local order without mutating first loaded rows',await keys()==='late,tie-a,tie-b,old,bad,empty'&&reads===2);
  await select('oldest');check('new older page moves first under oldest order',await keys()==='old,tie-a,tie-b,late,bad,empty');
  await page.setViewport({width:1280,height:900});await page.screenshot({path:'/downloads/activity-order-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=activityOrder]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/activity-order-mobile.png'});
  check('390px local order controls and guidance have no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await select('loaded');check('loaded restores original page concatenation after sort',await keys()==='late,bad,tie-a,tie-b,empty,old');await select('oldest');
  await page.$eval('[name=refreshActivity]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=refreshActivity]');await page.waitForFunction(()=>document.querySelectorAll('.activity-key').length===5);
  check('explicit refresh retains local order and resets loaded pages',await keys()==='tie-a,tie-b,late,bad,empty'&&reads===3&&await page.$eval('[name=activityOrder]',e=>e.value==='oldest'));
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.goto(`${WEB}${P}/activity`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=activityOrder]');
  check('new route instance resets local order rather than persisting it',await page.$eval('[name=activityOrder]',e=>e.value==='loaded')&&await keys()==='late,bad,tie-a,tie-b,empty');
  check('local controls never write and produce no runtime errors',writes===0&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;
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
