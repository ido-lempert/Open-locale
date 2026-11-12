// Real local browser -> manual snapshot label limits limits -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55942, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-snapshot-validation-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('snapshot_validation_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/snapshot_validation_browser`;
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


  await page.goto(`${WEB}${P}/snapshots`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('[name=snapshotListLoading]'));
  let posts=0,reads=0,restores=0,failCreate=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/snapshots`)reads++;if(req.method()==='POST'&&path.endsWith('/restore'))restores++;if(req.method()==='POST'&&path===`/api${P}/snapshots`){posts++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE_SNAPSHOT_LABEL"}'});}req.continue();});
  const replace=async value=>{await page.$eval('[name=label]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  check('snapshot label linked without native truncation or initial invalid flag',await page.$eval('[name=label]',e=>!e.hasAttribute('maxlength')&&e.getAttribute('aria-describedby')==='snapshotLabelRules'&&e.getAttribute('aria-invalid')==='false')&&await page.$eval('.snapshot-create button',e=>e.disabled));
  await page.focus('[name=label]');await page.keyboard.sendCharacter('x'.repeat(201));await page.waitForSelector('[name=snapshotLabelInvalid]');check('actual label201 retained',await page.$eval('[name=label]',e=>e.value.length===201));
  for(const label of ['x'.repeat(201),'😀'.repeat(201),'✈️'.repeat(201),'  ']){await replace(label);await page.waitForFunction(()=>document.querySelector('.snapshot-create button').disabled);await page.focus('[name=label]');await page.keyboard.press('Enter');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-snapshots')).create(new Event('submit')));check('invalid label stays local '+label.slice(0,10),posts===0&&reads===0&&restores===0&&await page.$eval('[name=label]',(e,v)=>e.value===v,label)&&!await page.$('[name=snapshotCaptureUnknown]')&&!await page.$('[name=snapshotCreating]'));}
  await replace('x'.repeat(201));await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/snapshot-label-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/snapshot-label-validation-mobile.png'});check('390px label guidance and correction fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=snapshotLabelRules]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.$eval('[name=snapshotLabelInvalid]',e=>e.getBoundingClientRect().right<=innerWidth));
  await replace(' '+ '😀'.repeat(200)+' ');await page.waitForFunction(()=>!document.querySelector('.snapshot-create button').disabled);await page.$eval('.snapshot-create button',e=>e.scrollIntoView({block:'center'}));await page.click('.snapshot-create button');await page.waitForFunction(()=>document.querySelector('[name=label]').value==='');await page.waitForFunction(()=>!document.querySelector('[name=snapshotListLoading]'));const list=await call(`${P}/snapshots`,null,token);check('corrected trimmed Unicode200 label persists once without restore',posts===1&&reads===1&&restores===0&&payloads[0].label==='😀'.repeat(200)&&list.some(s=>s.label==='😀'.repeat(200)&&s.automatic===false));
  await replace('  literal <img>  ');await page.$eval('.snapshot-create button',e=>e.scrollIntoView({block:'center'}));await page.click('.snapshot-create button');await page.waitForFunction(()=>document.querySelector('[name=label]').value==='');await page.waitForFunction(()=>!document.querySelector('[name=snapshotListLoading]'));check('literal label rendered as text after existing trim',posts===2&&reads===2&&restores===0&&payloads[1].label==='literal <img>'&&await page.$$eval('.snapshot-label',es=>es.some(e=>e.textContent==='literal <img>'&&!e.querySelector('img'))));
  failCreate=true;await replace('keep valid label');await page.$eval('.snapshot-create button',e=>e.scrollIntoView({block:'center'}));await page.click('.snapshot-create button');await page.waitForSelector('[name=snapshotCaptureUnknown]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-snapshots')).create(new Event('submit')));check('valid failure keeps label and pauses replay without private error',posts===3&&reads===2&&restores===0&&await page.$eval('[name=label]',e=>e.value==='keep valid label')&&await page.$eval('.snapshot-create button',e=>e.disabled)&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  check('no snapshot label validation runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??String(e)}`);process.exitCode=1;}
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
process.exit(failures?1:0);
