// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55668, WEB_PORT = 4200, API_PORT = 3000;
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

  await call(`${P}/snapshots`,{label:'Before restore'},token);await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForSelector('.restore');await page.type('[name=label]','Keep capture draft');
  let restores=0,captures=0,reads=0,failRead=true;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='POST'&&path.endsWith('/restore')){restores++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}if(req.method()==='POST'&&path===`/api${P}/snapshots`)captures++;if(req.method()==='GET'&&path===`/api${P}/snapshots`){reads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:'{}'});}req.continue();});let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.accept();});await page.click('.restore');await page.waitForSelector('[name=snapshotRestoreUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=snapshotRestoring]'));
  await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-snapshots'));await c.restore(c.items()[0]);await c.create({preventDefault(){}});});check('unknown restore blocks capture and destructive replay without list GET',restores===1&&captures===0&&dialogs===1&&reads===0&&await page.$eval('.restore',e=>e.disabled)&&await page.$eval('.snapshot-create button',e=>e.disabled)&&await page.$eval('[name=label]',e=>e.value==='Keep capture draft')&&!(await page.content()).includes('PRIVATE'));await page.screenshot({path:'/downloads/snapshot-restore-unknown.png',fullPage:false});
  await page.click('[name=refreshSnapshots]');await page.waitForSelector('[name=retrySnapshotList]');check('failed explicit read keeps unknown recovery state and capture blocked',reads===1&&!!await page.$('[name=snapshotRestoreUnknown]')&&await page.$eval('.snapshot-create button',e=>e.disabled));failRead=false;await page.click('[name=retrySnapshotList]');await page.waitForFunction(()=>!document.querySelector('[name=snapshotRestoreUnknown]')&&document.querySelector('.restore')?.disabled===false);check('successful explicit current read unlocks without restore replay or draft loss',restores===1&&captures===0&&reads===2&&await page.$eval('[name=label]',e=>e.value==='Keep capture draft')&&!await page.$eval('.snapshot-create button',e=>e.disabled));
  check('no snapshot restore runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
