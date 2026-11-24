// Real local Angular browser -> built API + Postgres loaded comment-thread download.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.EDITOR_CONTEXT_META_TEST_PG_PORT ?? 56150), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-comment-download-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('comment_download_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/comment_download_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);




  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);const key=(await call(`${P}/keys`,null,token))[0];
  const root=await call(`${P}/keys/${key.id}/comments`,{body:'Private root <markup> @sync-owner@example.com'},token);await call(`${P}/keys/${key.id}/comments`,{body:'Private stored reply',parentId:root.id,locale:'en'},token);const expected=await call(`${P}/keys/${key.id}/comments`,null,token);
  const downloadDir=mkdtempSync(join(tmpdir(),'ol-comment-download-'));const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'comment-thread.json');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.comments-toggle');await page.type('[name=newKey]','UNSENT-NEWKEY');await page.click('.comments-toggle');await page.waitForSelector('.comment-form');await page.type('[name=commentDraft]','UNSENT-COMMENT');await page.select('[name=commentLocale]','en');await page.evaluate(id=>ng.getComponent(document.querySelector('ol-editor')).replyTo.set(id),root.id);await page.click('[aria-label="alpha in en"]');await page.type('[aria-label="alpha in en"]',' UNSENT-TRANSLATION');
  let writes=0,keyReads=0,threadReads=0;page.on('request',req=>{const p=new URL(req.url()).pathname;if(['POST','PUT','DELETE'].includes(req.method())&&p.startsWith('/api/'))writes++;if(req.method()==='GET'&&p===`/api${P}/keys`)keyReads++;if(req.method()==='GET'&&p.endsWith('/comments'))threadReads++;});
  const readDownload=async()=>{for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,30));for(let n=0;n<100;n++){try{return JSON.parse(readFileSync(file,'utf8'));}catch{}await new Promise(r=>setTimeout(r,30));}throw new Error('Downloaded JSON missing or incomplete');};
  await page.click('[name=downloadCommentThread]');const data=await readDownload();
  check('actual downloaded JSON contains exact loaded identity selected branch stored root and reply',data.schemaVersion===1&&data.scope==='loaded-comment-thread'&&data.restorable===false&&data.projectId===project.id&&data.branch==='main'&&data.key.id===key.id&&data.key.name==='alpha'&&data.comments.length===2&&data.comments.every(c=>expected.some(e=>e.id===c.id&&e.body===c.body&&e.parentId===c.parentId&&e.localeCode===c.localeCode)));
  check('actual file retains private author and mention details and excludes unsent forms translations and screenshots',data.comments.every(c=>c.author.email==='sync-owner@example.com')&&data.comments.some(c=>c.mentions.some(m=>m.user.email==='sync-owner@example.com'))&&!JSON.stringify(data).includes('UNSENT')&&!('translations'in data)&&!('screenshots'in data));
  check('real pointer download keeps translation focus drafts locale reply target and new-key form with no API request',writes===0&&keyReads===0&&threadReads===0&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original UNSENT-TRANSLATION'&&document.activeElement===e)&&await page.$eval('[name=commentDraft]',e=>e.value==='UNSENT-COMMENT')&&await page.$eval('[name=commentLocale]',e=>e.value==='en')&&await page.$eval('[name=newKey]',e=>e.value==='UNSENT-NEWKEY')&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-editor')).replyTo()===id,root.id));
  check('scope warns about private contents local-only non-backup and no write confirmation',await page.$eval('[name=commentThreadDownloadScope]',e=>e.textContent.includes('private bodies, IDs, author emails and mention details')&&e.textContent.includes('Not a restorable backup')&&e.textContent.includes('does not share or change'))&&await page.$eval('[name=commentThreadDownloadNotice]',e=>e.textContent.includes('does not confirm the file was saved')));await page.$eval('[name=downloadCommentThread]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comment-thread-download-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=downloadCommentThread]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comment-thread-download-mobile.png'});check('390px download control and scope text fit their own width',await page.$eval('[name=downloadCommentThread]',e=>{const r=e.getBoundingClientRect();return r.width<=390&&r.left>=0&&r.right<=innerWidth;}));
  await page.setViewport({width:1280,height:900});await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.commentsMutationError.set([c.keys()[0].id]);});rmSync(file);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.downloadCommentThread(c.keys()[0]);});check('unknown mutation disables download and direct invocation creates no file',await page.$eval('[name=downloadCommentThread]',e=>e.disabled)&&!existsSync(file)&&writes===0);
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.commentsMutationError.set([]);});let held,mode='hold';await page.setRequestInterception(true);page.on('request',req=>{if(req.method()==='GET'&&new URL(req.url()).pathname.endsWith('/comments')){if(mode==='hold'){held=req;return;}if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ_FAILURE'})});}return req.continue();});await page.$eval('[name=refreshComments]',e=>e.click());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Thread read not held');await page.waitForSelector('[name=commentsLoading]');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.downloadCommentThread(c.keys()[0]);});check('pending real thread read clears notice and blocks any download',await page.$eval('[name=downloadCommentThread]',e=>e.disabled)&&!await page.$('[name=commentThreadDownloadNotice]')&&!existsSync(file)&&writes===0);
  await held.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ_FAILURE'})});held=null;await page.waitForSelector('[name=commentsError]');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.downloadCommentThread(c.keys()[0]);});check('failed real thread read blocks file without exposing raw error',await page.$eval('[name=downloadCommentThread]',e=>e.disabled)&&!existsSync(file)&&!(await page.content()).includes('PRIVATE_READ_FAILURE'));
  await call(`${P}/keys/${key.id}/comments`,{body:'New stored after refresh'},token);mode='live';await page.$eval('[name=retryComments]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=commentsLoading]')&&document.querySelector('.history-row')?.textContent.includes('New stored after refresh'));await page.click('[name=downloadCommentThread]');const fresh=await readDownload();check('successful explicit refresh downloads current loaded thread not stale earlier data',fresh.comments.length===3&&fresh.comments.some(c=>c.body==='New stored after refresh')&&threadReads===2&&writes===0&&keyReads===0);check('refresh and download retain local text without save or post',await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original UNSENT-TRANSLATION')&&await page.$eval('[name=commentDraft]',e=>e.value==='UNSENT-COMMENT')&&(await call(`${P}/keys`,null,token))[0].translations.find(t=>t.localeCode==='en').value==='Original');await page.$eval('[name=downloadCommentThread]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-comment-thread-download-result.png'});rmSync(downloadDir,{recursive:true,force:true});check('no comment-thread-download runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
