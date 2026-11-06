// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55632, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-comments-recovery-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('comments_recovery_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/comments_recovery_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Alpha',beta:'Beta'}},token);const keys=await call(`${P}/keys`,null,token),a=keys.find(k=>k.name==='alpha'),b=keys.find(k=>k.name==='beta');
  await call(`${P}/keys/${a.id}/comments`,{body:'Stored A'},token);await call(`${P}/keys/${b.id}/comments`,{body:'Stored B'},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.comments-toggle');
  const toggle=async name=>page.evaluate(name=>{[...document.querySelectorAll('.grid tbody tr:not(.history-row)')].find(r=>r.textContent.includes(name)).querySelector('.comments-toggle').click();},name);
  let held,posts=0,deletes=0,mode='live';await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname,isComment=path.includes('/comments');if(isComment&&req.method()==='POST')posts++;if(isComment&&req.method()==='DELETE')deletes++;if(isComment&&['POST','DELETE'].includes(req.method())){if(mode==='unknown')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_COMMENT_WRITE'})});if(mode==='hold'){held=req;return;}}if(isComment&&req.method()==='GET'&&mode==='readerror')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ'})});req.continue();});
  const waitHeld=async()=>{for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('comment write not held');};
  await toggle('alpha');await page.waitForSelector('.comment-form');await page.type('[name=commentDraft]','Unknown post draft');mode='unknown';await page.click('.comment-form button[type=submit]');await page.waitForSelector('[name=commentsMutationError]');await page.$eval('.comment-form',e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check('unknown post retains draft and blocks replay with fixed guidance',posts===1&&await page.$eval('[name=commentDraft]',e=>e.value==='Unknown post draft')&&await page.$eval('.comment-form button[type=submit]',e=>e.disabled)&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));await page.screenshot({path:'/downloads/editor-comment-write-unknown.png',fullPage:false});mode='readerror';await page.click('[name=checkCurrentComments]');await page.waitForSelector('[name=commentsError]');check('failed current read cannot unlock unknown write',!!await page.$('[name=commentsMutationError]'));mode='live';await page.click('[name=retryComments]');await page.waitForSelector('.comment-form');await page.waitForFunction(()=>!document.querySelector('[name=commentsMutationError]'));check('successful explicit current read keeps draft and unlocks changes',await page.$eval('[name=commentDraft]',e=>e.value==='Unknown post draft')&&!await page.$eval('.comment-form button[type=submit]',e=>e.disabled));
  mode='hold';await page.click('.comment-form button[type=submit]');await waitHeld();await page.waitForSelector('[name=commentsPending]');await page.$eval('[name=commentDraft]',e=>{e.value='Newer local comment';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.$eval('.comment-form',e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check('held post guards duplicate and permits newer draft',posts===2&&await page.$eval('.comment-form button[type=submit]',e=>e.disabled));await page.screenshot({path:'/downloads/editor-comment-write-pending.png',fullPage:false});mode='live';await held.continue();held=null;await page.waitForFunction(()=>document.querySelector('.history-row')?.textContent.includes('Unknown post draft')&&!document.querySelector('[name=commentsPending]')&&!document.querySelector('[name=commentsLoading]'));check('confirmed post persists once and keeps newer draft',await page.$eval('[name=commentDraft]',e=>e.value==='Newer local comment')&&(await call(`${P}/keys/${a.id}/comments`,null,token)).filter(c=>c.body==='Unknown post draft').length===1);
  mode='unknown';await page.evaluate(()=>{[...document.querySelectorAll('.history-list li')].find(e=>e.textContent.includes('Stored A')).querySelector('button.danger').click();});await page.waitForSelector('[name=commentsMutationError]');await page.$eval('.history-list button.danger',e=>e.click());check('unknown delete blocks blind replay and keeps current draft',deletes===1&&await page.$eval('[name=commentDraft]',e=>e.value==='Newer local comment'));mode='live';await page.click('[name=checkCurrentComments]');await page.waitForFunction(()=>!document.querySelector('[name=commentsLoading]')&&!document.querySelector('[name=commentsMutationError]'));
  mode='hold';await page.evaluate(()=>{[...document.querySelectorAll('.history-list li')].find(e=>e.textContent.includes('Stored A')).querySelector('button.danger').click();});await waitHeld();await toggle('beta');await page.waitForSelector('.comment-form');await page.type('[name=commentDraft]','Beta draft');mode='live';await held.continue();held=null;for(let n=0;n<100&&(await call(`${P}/keys/${a.id}/comments`,null,token)).some(c=>c.body==='Stored A');n++)await new Promise(r=>setTimeout(r,20));check('confirmed delete remains on original key without replacing new thread',deletes===2&&await page.$eval('[name=commentDraft]',e=>e.value==='Beta draft')&&await page.$eval('.history-row',e=>e.textContent.includes('Stored B')&&!e.textContent.includes('Unknown post draft'))&&!(await call(`${P}/keys/${a.id}/comments`,null,token)).some(c=>c.body==='Stored A'));
  check('no comment recovery runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
