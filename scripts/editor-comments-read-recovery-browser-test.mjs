// Real local browser -> comment refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55776, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-shots-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('shots_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/shots_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Alpha'}},token);const a=(await call(`${P}/keys`,null,token))[0];
  await call(`${P}/keys/${a.id}/comments`,{body:'Stored comment'},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.comments-toggle');await page.click('.comments-toggle');await page.waitForSelector('.comment-form');await page.type('[name=commentDraft]','Retained comment draft');await page.select('[name=commentLocale]','he');
  let mode='live',held,posts=0;const reads=[],writes=[];await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads.push(path);else writes.push(path);}if(req.method()==='POST'&&path.endsWith('/comments')){posts++;await call(`${P}/keys/${a.id}/comments`,JSON.parse(req.postData()),token);return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_COMMENT_WRITE'})});}if(req.method()==='GET'&&path.endsWith('/comments')){if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_COMMENT_READ'})});if(mode==='hold'){held=req;return;}}req.continue();});
  await page.click('.comment-form button[type=submit]');await page.waitForSelector('[name=commentsMutationError]');check('real committed then lost comment pauses changes and keeps draft',posts===1&&reads.length===0&&await page.$eval('[name=commentDraft]',e=>e.value==='Retained comment draft')&&(await call(`${P}/keys/${a.id}/comments`,null,token)).filter(c=>c.body==='Retained comment draft').length===1);
  const input=await page.$('[aria-label="alpha in en"]');await input.focus();await input.type(' local draft');mode='error';await page.click('[name=checkCurrentComments]');await page.waitForSelector('[name=commentsError]');check('focused unknown-result check reads only comments without blur autosave',writes.length===1&&reads.length===1&&reads[0].endsWith(`/keys/${a.id}/comments`)&&await input.evaluate(e=>e.value==='Alpha local draft'&&document.activeElement===e));check('failed read keeps mutation pause and fixed private-error-free guidance',!!await page.$('[name=commentsMutationError]')&&!(await page.content()).includes('PRIVATE_COMMENT'));
  await page.$eval('[name=commentsMutationError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comments-read-recovery-error-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=commentsMutationError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comments-read-recovery-error-mobile.png'});await page.setViewport({width:1280,height:900});
  mode='hold';await page.click('[name=retryComments]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('recovery read not held');await page.waitForSelector('[name=commentsLoading]');check('focused retry retains translation without blur autosave',writes.length===1&&reads.length===2&&await input.evaluate(e=>document.activeElement===e&&e.value==='Alpha local draft'));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.recoverComments(c.keys()[0]);});check('captured duplicate recovery refuses pending read',reads.length===2&&writes.length===1);
  mode='live';await held.continue();await page.waitForFunction(()=>!document.querySelector('[name=commentsLoading]')&&!document.querySelector('[name=commentsMutationError]')&&!!document.querySelector('.comment-form'));check('current thread restores committed comment and retained draft locale without replay',posts===1&&writes.length===1&&reads.length===2&&await page.$eval('.history-list',e=>e.textContent.includes('Retained comment draft'))&&await page.$eval('[name=commentDraft]',e=>e.value==='Retained comment draft')&&await page.$eval('[name=commentLocale]',e=>e.value==='he')&&await input.evaluate(e=>e.value==='Alpha local draft'));
  await page.$eval('[name=commentsRefreshScope]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comments-read-recovery-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=commentsRefreshScope]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comments-read-recovery-mobile.png'});check('390px restored thread and retained comment form readable',await page.$eval('[name=commentDraft]',e=>e.getBoundingClientRect().width>250));check('no comment recovery runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
