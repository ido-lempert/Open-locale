// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55628, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-shots-write-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('shots_write_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/shots_write_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Alpha',beta:'Beta'}},token);
  const keys=await call(`${P}/keys`,null,token),a=keys.find(k=>k.name==='alpha'),b=keys.find(k=>k.name==='beta');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
  const upload=async(id,name)=>{const f=new FormData();f.append('file',new Blob([png],{type:'image/png'}),name);const r=await fetch(`${API}${P}/keys/${id}/screenshots`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:f});if(!r.ok)throw new Error(`upload ${r.status}`);return r.json();};
  const sa=await upload(a.id,'alpha.png'),sb=await upload(b.id,'beta.png');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.shots-toggle');
  let held,posts=0,deletes=0,fail=false,reads=0;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path.endsWith('/screenshots'))reads++;if((req.method()==='POST'&&path.endsWith('/screenshots'))||(req.method()==='DELETE'&&path.includes('/screenshots/'))){req.method()==='POST'?posts++:deletes++;if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_SHOT_WRITE'})});held=req;return;}req.continue();});
  const toggle=async name=>page.evaluate(name=>{[...document.querySelectorAll('.grid tbody tr:not(.history-row)')].find(r=>r.textContent.includes(name)).querySelector('.shots-toggle').click();},name);
  const pick=async()=>page.evaluate(bytes=>{const input=document.querySelector('[aria-label="Upload screenshot"]'),d=new DataTransfer();d.items.add(new File([new Uint8Array(bytes)],'new.png',{type:'image/png'}));input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));},[...png]);const waitHeld=async()=>{for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('write not held');};
  await toggle('alpha');await page.waitForSelector('.shots-list img');await pick();await waitHeld();await page.waitForSelector('[name=shotsMutating]');await pick();await page.$eval('[aria-label="Delete screenshot alpha.png"]',e=>e.click());check('held upload disables both mutation controls and duplicate event sends nothing',posts===1&&deletes===0&&await page.$eval('[aria-label="Upload screenshot"]',e=>e.disabled)&&await page.$eval('[aria-label="Delete screenshot alpha.png"]',e=>e.disabled));await page.screenshot({path:'/downloads/editor-shot-write-pending.png',fullPage:false});await toggle('beta');await page.waitForFunction(()=>document.querySelector('.shots-list')?.textContent.includes('beta.png'));const before=reads;await held.continue();held=null;await page.waitForFunction(()=>[...document.querySelectorAll('.grid tbody tr:not(.history-row)')].find(r=>r.textContent.includes('alpha'))?.querySelector('.shots-toggle')?.textContent.includes('2'));const current=await call(`${P}/keys/${a.id}/screenshots`,null,token);check('confirmed upload persists once without reopening other pane',current.length===2&&reads===before&&await page.$eval('.shots-list',e=>e.textContent.includes('beta.png')&&!e.textContent.includes('new.png')));
  await toggle('alpha');await page.waitForFunction(()=>document.querySelector('.shots-list')?.textContent.includes('new.png'));await page.click('[aria-label="Delete screenshot new.png"]');await waitHeld();await page.waitForSelector('[name=shotsMutating]');await page.$eval('[aria-label="Delete screenshot new.png"]',e=>e.click());await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=shotsLoading]')&&!document.querySelector('[name=shotsMutating]')&&!document.querySelector('[aria-label="Delete screenshot new.png"]'));check('confirmed delete once refreshes current screenshots only',deletes===1&&(await call(`${P}/keys/${a.id}/screenshots`,null,token)).length===1&&!!await page.$('[aria-label="Delete screenshot alpha.png"]'));
  fail=true;await pick();await page.waitForSelector('[name=shotsMutationError]');await pick();check('unknown upload fixed guidance blocks blind replay',posts===2&&await page.$eval('[aria-label="Upload screenshot"]',e=>e.disabled)&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));await page.screenshot({path:'/downloads/editor-shot-write-unknown.png',fullPage:false});fail=false;await page.click('[name=checkCurrentShots]');await page.waitForFunction(()=>!document.querySelector('[name=shotsLoading]')&&!document.querySelector('[name=shotsMutationError]'));check('explicit full current read unlocks screenshot controls',!await page.$eval('[aria-label="Upload screenshot"]',e=>e.disabled)&&posts===2&&await page.$eval('.shots-list',e=>e.textContent.includes('alpha.png')));
  check('no screenshot mutation runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
