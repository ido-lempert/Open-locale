// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55587, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-comments-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('comments_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/comments_browser`;
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
  await page.setRequestInterception(true);let mode='hold',held=[],translationSaves=[];
  page.on('request',req=>{if(req.method()==='PUT'&&new URL(req.url()).pathname.endsWith('/translations')){translationSaves.push(req);return;}if(new URL(req.url()).pathname.endsWith('/comments')){if(req.method()==='GET'&&mode==='hold'){held.push(req);return;}if(req.method()==='GET'&&mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-comments-error'})});if(req.method()==='POST'&&mode==='hold-post'){held.push(req);return;}}return req.continue();});
  const waitHeld=async()=>{for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==1)throw new Error(`held count ${held.length}`);return held.shift();};
  const respond=async(req,value)=>{await req.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:value,body:value,createdAt:'2026-11-05T10:00:00Z',author:{displayName:'Owner'}}])});await new Promise(r=>setTimeout(r,150));};
  await toggle('alpha');const old=await waitHeld();await toggle('beta');const fresh=await waitHeld();await respond(old,'OLD-ALPHA');check('old A response cannot fill B or settle pending read',!!await page.$('[name=commentsLoading]')&&!(await page.$('.comment-form')));await respond(fresh,'FRESH-BETA');await page.waitForSelector('.comment-form');check('selected B thread contains only current read',await page.$eval('.history-row',e=>e.textContent.includes('FRESH-BETA')&&!e.textContent.includes('OLD-ALPHA')));
  await toggle('beta');await toggle('alpha');const closed=await waitHeld();await toggle('alpha');await respond(closed,'CLOSED-PRIVATE');check('closed read does not reopen thread',!(await page.$('.history-row')));
  mode='error';await toggle('alpha');await page.waitForSelector('[name=commentsError]');check('failure is not empty success or raw service error',!(await page.$('[name=commentsEmpty]'))&&!(await page.$('.comment-form'))&&!(await page.content()).includes('private-comments-error'));await page.$eval('[name=commentsError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comments-error.png',fullPage:false});
  mode='live';await page.click('[name=retryComments]');await page.waitForSelector('.comment-form');check('retry reads actual stored thread',await page.$eval('.history-row',e=>e.textContent.includes('Stored A')));
  await page.type('.grid tbody tr:not(.history-row) textarea',' unsaved draft');mode='hold-post';await page.type('[name=commentDraft]','Posted A');await page.click('.comment-form button[type=submit]');const post=await waitHeld();await page.waitForFunction(()=>document.querySelector('.comment-form button[type=submit]')?.disabled);check('pending post disables duplicate submission',await page.$eval('.comment-form button[type=submit]',e=>e.disabled));
  await toggle('beta');await page.waitForSelector('.comment-form');await page.type('[name=commentDraft]','New B draft');await post.continue();await new Promise(r=>setTimeout(r,250));check('post A finishing preserves B thread and draft',await page.$eval('[name=commentDraft]',e=>e.value==='New B draft')&&await page.$eval('.history-row',e=>e.textContent.includes('Stored B')&&!e.textContent.includes('Posted A')));check('post completion does not reload unsaved translations',await page.$eval('.grid tbody tr:not(.history-row) textarea',e=>e.value.includes('unsaved draft')));
  check('translation save held uncommitted at real request boundary',translationSaves.length===1&&(await call(`${P}/keys`,null,token)).find(k=>k.id===a.id).translations.find(t=>t.localeCode==='en').value==='Alpha');
  mode='live';await toggle('alpha');await page.waitForSelector('.comment-form');await page.waitForFunction(()=>document.querySelector('.history-row')?.textContent.includes('Posted A'));check('original post actually persisted once to original key',await page.$eval('.history-row',e=>e.textContent.includes('Posted A'))&&(await call(`${P}/keys/${a.id}/comments`,null,token)).filter(c=>c.body==='Posted A').length===1);
  await page.type('[name=commentDraft]','Normal post');await page.click('.comment-form button[type=submit]');await page.waitForFunction(()=>document.querySelector('.history-row')?.textContent.includes('Normal post')&&document.querySelector('[name=commentDraft]')?.value===''&&document.querySelector('.comment-form button[type=submit]')?.textContent.trim()==='Post');check('normal post clears submitted draft after confirmed result',await page.$eval('[name=commentDraft]',e=>e.value===''));await page.screenshot({path:'/downloads/editor-comments-retry.png',fullPage:false});
  await page.evaluate(()=>{const li=[...document.querySelectorAll('.history-list li')].find(e=>e.textContent.includes('Normal post'));li.querySelector('button.danger').click();});await page.waitForFunction(()=>!document.querySelector('.history-row')?.textContent.includes('Normal post'));check('normal delete refreshes current thread without draft reload',await page.$eval('.grid tbody tr:not(.history-row) textarea',e=>e.value.includes('unsaved draft')));
  await Promise.all(translationSaves.map(r=>r.continue()));
  check('no comments runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
