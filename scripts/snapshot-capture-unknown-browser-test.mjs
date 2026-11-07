// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55702, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-snapshot-unknown-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('snapshot_unknown_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/snapshot_unknown_browser`;
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

  await call(`${P}/snapshots`,{label:'Existing snapshot'},token);await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForSelector('.restore');await page.type('[name=label]','Keep capture draft');
  let restores=0,captures=0,reads=0,failRead=true,drop=true,committed=false;await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(req.method()==='POST'&&path.endsWith('/restore'))restores++;if(req.method()==='POST'&&path===`/api${P}/snapshots`){captures++;if(drop){const r=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('forwarded real capture failed');await r.json();committed=true;return req.abort('failed');}}if(req.method()==='GET'&&path===`/api${P}/snapshots`){reads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}req.continue();});let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.accept();});
  await page.click('.snapshot-create button');await page.waitForSelector('[name=snapshotCaptureUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=snapshotCreating]')&&document.querySelector('.snapshot-create button')?.disabled);
  const saved=await prisma.snapshot.findMany({where:{projectId:project.id,label:'Keep capture draft'}});
  check('real server capture committed before dropped browser response, fixed unknown guidance retains draft',committed&&saved.length===1&&captures===1&&reads===0&&await page.$eval('[name=label]',e=>e.value==='Keep capture draft')&&!(await page.content()).includes('PRIVATE'));
  await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-snapshots'));await c.create({preventDefault(){}});await c.restore(c.items()[0]);});check('unknown capture blocks captured submit and restore handlers before confirmation without automatic replay',captures===1&&restores===0&&dialogs===0&&reads===0&&await page.$eval('.restore',e=>e.disabled));
  await page.screenshot({path:'/downloads/snapshot-capture-unknown-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/snapshot-capture-unknown-mobile.png',fullPage:true});check('narrow unconfirmed capture guidance is readable without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.click('[name=refreshSnapshots]');await page.waitForSelector('[name=retrySnapshotList]');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-snapshots'));await c.create({preventDefault(){}});});check('failed explicit read preserves unknown and cannot replay capture',reads===1&&captures===1&&!!await page.$('[name=snapshotCaptureUnknown]')&&await page.$eval('.snapshot-create button',e=>e.disabled));
  failRead=false;await page.click('[name=retrySnapshotList]');await page.waitForFunction(()=>!document.querySelector('[name=snapshotCaptureUnknown]')&&document.querySelector('.restore')?.disabled===false);check('successful current read shows committed snapshot and unlocks without duplicate or label loss',reads===2&&captures===1&&restores===0&&await page.$$eval('.snapshot-label',es=>es.some(e=>e.textContent==='Keep capture draft'))&&await page.$eval('[name=label]',e=>e.value==='Keep capture draft')&&!await page.$eval('.snapshot-create button',e=>e.disabled));
  await page.$eval('[name=label]',e=>{e.value='Explicit next capture';e.dispatchEvent(new Event('input',{bubbles:true}));});drop=false;await page.click('.snapshot-create button');await page.waitForFunction(()=>document.querySelector('.notice')?.textContent.includes('Snapshot captured')&&!document.querySelector('[name=snapshotCreating]'));check('explicit next capture after recovery sends once and refreshes normally',captures===2&&reads===3&&await prisma.snapshot.count({where:{projectId:project.id,label:'Keep capture draft'}})===1&&await prisma.snapshot.count({where:{projectId:project.id,label:'Explicit next capture'}})===1&&!await page.$('[name=snapshotCaptureUnknown]'));
  check('no snapshot capture recovery runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
