// Real local browser -> local comment limits -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55927, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-comment-validation-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('comment_validation_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/comment_validation_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);const key=(await call(`${P}/keys`,null,token))[0];
  const root=await call(`${P}/keys/${key.id}/comments`,{body:'Root comment'},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.click('.comments-toggle');await page.waitForSelector('.comment-form');
  let posts=0,reads=0,keysReads=0,failPost=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/keys`)keysReads++;if(path.endsWith('/comments')){if(req.method()==='GET')reads++;if(req.method()==='POST'){posts++;payloads.push(JSON.parse(req.postData()));if(failPost)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE_COMMENT_ERROR"}'});}}req.continue();});
  const replace=async(value)=>{await page.$eval('[name=commentDraft]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  check('comment rules linked without native truncation or initial invalid flag',await page.$eval('[name=commentDraft]',e=>e.getAttribute('aria-describedby')?.startsWith('commentRules-')&&e.getAttribute('aria-invalid')==='false'&&!e.hasAttribute('maxlength'))&&await page.$eval('.comment-form button[type=submit]',e=>e.disabled));
  await page.click('[aria-label="Reply to comment"]');await page.select('[name=commentLocale]','he');
  await page.focus('[name=commentDraft]');await page.keyboard.sendCharacter('x'.repeat(2001));await page.waitForSelector('[name=commentDraftInvalid]');
  check('actual keyboard input beyond2000 kept without truncation',await page.$eval('[name=commentDraft]',e=>e.value.length===2001));
  for(const bad of ['x'.repeat(2001),'😀'.repeat(2001),'✈️'.repeat(2001),'   ']){await replace(bad);await page.waitForSelector('[name=commentDraftInvalid]');await page.focus('[name=commentDraft]');await page.keyboard.press('Enter');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.addComment(c.keys()[0]);});check('invalid comment stays local '+bad.slice(0,12),posts===0&&reads===0&&keysReads===0&&await page.$eval('[name=commentDraft]',(e,v)=>e.value===v&&e.getAttribute('aria-invalid')==='true',bad)&&await page.$eval('[name=commentLocale]',e=>e.value==='he')&&!!await page.$('[name=cancelCommentReply]')&&!await page.$('[name=commentsMutationError]'));}
  await replace('x'.repeat(2001));await page.$eval('.comment-form',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comment-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('.comment-form',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/editor-comment-validation-mobile.png'});check('390px comment guidance fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=commentRules]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.$eval('[name=commentDraftInvalid]',e=>e.getBoundingClientRect().right<=innerWidth));
  console.log('CANCEL_BEFORE',await page.$eval('[name=cancelCommentReply]',e=>({disabled:e.disabled,rect:e.getBoundingClientRect().toJSON()})));await page.click('[name=cancelCommentReply]');console.log('CANCEL_AFTER',await page.evaluate(()=>({reply:ng.getComponent(document.querySelector('ol-editor')).replyTo(),raw:document.querySelector('[name=commentDraft]').value.length,cancel:!!document.querySelector('[name=cancelCommentReply]')})));await page.waitForFunction(()=>!document.querySelector('[name=cancelCommentReply]'));check('cancel reply keeps invalid text without request',posts===0&&reads===0&&!await page.$('[name=cancelCommentReply]')&&await page.$eval('[name=commentDraft]',e=>e.value.length===2001));
  await page.click('[aria-label="Reply to comment"]');await replace('  '+ '😀'.repeat(2000)+'  ');await page.waitForFunction(()=>!document.querySelector('[name=commentDraftInvalid]'));await page.click('.comment-form button[type=submit]');await page.waitForFunction(()=>document.querySelector('[name=commentDraft]')?.value===''&&!document.querySelector('[name=cancelCommentReply]'));
  const stored=await call(`${P}/keys/${key.id}/comments`,null,token);check('Unicode2000 corrected reply really persists with trimmed body and scope',posts===1&&reads===1&&keysReads===0&&payloads[0].body==='😀'.repeat(2000)&&payloads[0].parentId===root.id&&payloads[0].locale==='he'&&stored.some(c=>c.body==='😀'.repeat(2000)&&c.parentId===root.id&&c.localeCode==='he'));
  await replace('✈️'.repeat(2000));await page.click('.comment-form button[type=submit]');await page.waitForFunction(()=>document.querySelector('[name=commentDraft]')?.value==='');check('presentation2000 persists untruncated as root',posts===2&&reads===2&&keysReads===0&&(await call(`${P}/keys/${key.id}/comments`,null,token)).some(c=>c.body==='✈️'.repeat(2000)&&!c.parentId));
  failPost=true;await replace('valid failure');await page.click('.comment-form button[type=submit]');await page.waitForSelector('[name=commentsMutationError]');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.addComment(c.keys()[0]);});check('valid server failure still pauses and preserves draft without replay/private error',posts===3&&reads===2&&keysReads===0&&await page.$eval('[name=commentDraft]',e=>e.value==='valid failure')&&await page.$eval('.comment-form button[type=submit]',e=>e.disabled)&&!(await page.$eval('.grid',e=>e.innerText)).includes('PRIVATE_'));
  check('no comment validation runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
