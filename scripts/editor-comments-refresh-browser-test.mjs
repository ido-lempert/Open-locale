// Real local browser -> comment refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55760, WEB_PORT = 4200, API_PORT = 3000;
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


  await call(`${P}/import/en`,{entries:{alpha:'Alpha',beta:'Beta'}},token);
  const keys=await call(`${P}/keys`,null,token),a=keys.find(k=>k.name==='alpha'),b=keys.find(k=>k.name==='beta');
  const root=await call(`${P}/keys/${a.id}/comments`,{body:'Existing root'},token);await call(`${P}/keys/${b.id}/comments`,{body:'Other key'},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.comments-toggle');
  const toggle=async name=>page.evaluate(name=>{[...document.querySelectorAll('.grid tbody tr:not(.history-row)')].find(r=>r.textContent.includes(name)).querySelector('.comments-toggle').click();},name);
  await toggle('alpha');await page.waitForSelector('.comment-form');await page.type('[name=commentDraft]','Keep local comment');await page.select('[name=commentLocale]','he');await page.click('button[aria-label="Reply to comment"]');
  await call(`${P}/keys/${a.id}/comments`,{body:'New current comment'},token);
  let mode='hold',held=[],reads=[],writes=0;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads.push(path);else writes++;}if(mode==='hold'&&path.endsWith('/comments')&&req.method()==='GET'){held.push(req);return;}if(mode==='error'&&path.endsWith('/comments')&&req.method()==='GET')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_COMMENTS'})});req.continue();});
  const waitHeld=async()=>{for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==1)throw new Error(`held count ${held.length}`);return held.shift();};
  const input=await page.evaluateHandle(()=>[...document.querySelectorAll('.grid tbody tr:not(.history-row)')].find(r=>r.textContent.includes('alpha')).querySelector('textarea'));
  await input.asElement().focus();await input.asElement().type(' local draft');const localValue=await input.asElement().evaluate(e=>e.value);await page.click('[name=refreshComments]');const pending=await waitHeld();await page.waitForSelector('[name=commentsLoading]');check('focused pointer refresh reads only selected thread without blur autosave',writes===0&&reads.length===1&&reads[0].endsWith(`/keys/${a.id}/comments`)&&await input.asElement().evaluate((e,v)=>e.value===v&&document.activeElement===e,localValue));
  check('pending refresh hides old thread and disables duplicate action',!await page.$('.comment-form')&&await page.$eval('[name=refreshComments]',e=>e.disabled));await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.refreshComments(c.keys().find(k=>k.name==='alpha'));});check('captured duplicate refuses while read pending',reads.length===1&&writes===0);
  mode='live';await pending.continue();await page.waitForSelector('.comment-form');await page.waitForFunction(()=>document.querySelector('.history-list')?.textContent.includes('New current comment'));check('current thread appears with draft locale and existing reply target retained',await page.$eval('[name=commentDraft]',e=>e.value==='Keep local comment')&&await page.$eval('[name=commentLocale]',e=>e.value==='he')&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-editor')).replyTo()===id,root.id)&&await input.asElement().evaluate((e,v)=>e.value===v,localValue)&&reads.length===1&&writes===0);
  await page.$eval('[name=refreshComments]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comments-refresh-desktop.png',fullPage:false});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshComments]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comments-refresh-mobile.png',fullPage:false});check('390px refresh and scope remain readable',await page.$eval('[name=refreshComments]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})&&await page.$eval('[name=commentsRefreshScope]',e=>e.textContent.includes('reply target missing'))&&await page.$eval('[name=commentDraft]',e=>e.getBoundingClientRect().width>250));
  await call(`${P}/keys/${a.id}/comments/${root.id}`,null,token,'DELETE');await page.$eval('[name=refreshComments]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=commentsLoading]')&&ng.getComponent(document.querySelector('ol-editor')).replyTo()===null);check('removed reply target clears without losing comment text or locale',await page.$eval('[name=commentDraft]',e=>e.value==='Keep local comment')&&await page.$eval('[name=commentLocale]',e=>e.value==='he')&&writes===0);
  mode='error';await page.$eval('[name=refreshComments]',e=>e.click());await page.waitForSelector('[name=commentsError]');check('failure uses existing fixed recovery with draft retained in page state',!await page.$('[name=refreshComments]')&&!await page.$('[name=commentsEmpty]')&&!(await page.content()).includes('PRIVATE_COMMENTS')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).commentDraft()==='Keep local comment')&&writes===0);
  mode='live';await page.$eval('[name=retryComments]',e=>e.click());await page.waitForSelector('.comment-form');check('existing retry restores thread and local form',await page.$eval('[name=commentDraft]',e=>e.value==='Keep local comment')&&writes===0);
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.commentsMutationError.set([c.commentsFor()]);});await page.waitForSelector('[name=checkCurrentComments]');check('uncertain change keeps dedicated recovery not normal refresh',!await page.$('[name=refreshComments]')&&writes===0);await page.$eval('[name=checkCurrentComments]',e=>e.click());await page.waitForSelector('.comment-form');
  mode='hold';await page.$eval('[name=refreshComments]',e=>e.click());const late=await waitHeld();await toggle('alpha');mode='live';await late.continue();await new Promise(r=>setTimeout(r,150));check('late refreshed thread cannot reopen closed pane',!await page.$('.comment-form')&&!await page.$('[name=refreshComments]')&&writes===0);
  check('no comment refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
