// Real local Angular browser -> built API + Postgres comment deletion.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56148, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-comment-confirm-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('comment_confirm_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/comment_confirm_browser`;
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
  const peer=await call('/auth/signup',{email:'comment-peer@example.com',password:'pass1234',displayName:'Peer'});await call(`${P}/members`,{email:'comment-peer@example.com',role:'MEMBER'},token);
  const root=await call(`${P}/keys/${key.id}/comments`,{body:'Root with peer reply'},token);const peerReply=await call(`${P}/keys/${key.id}/comments`,{body:'Peer reply',parentId:root.id},peer.accessToken);const retained=await call(`${P}/keys/${key.id}/comments`,{body:'Retained parent'},token);const ownReply=await call(`${P}/keys/${key.id}/comments`,{body:'Own selected reply',parentId:retained.id,locale:'en'},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.comments-toggle');await page.type('[name=newKey]','local.new.key');await page.click('.comments-toggle');await page.waitForSelector('.comment-form');await page.type('[name=commentDraft]','Unsent local comment');await page.select('[name=commentLocale]','en');await page.evaluate(id=>ng.getComponent(document.querySelector('ol-editor')).replyTo.set(id),root.id);
  let deletes=0,puts=0,posts=0,keyReads=0,listReads=0;const deletePaths=[];page.on('request',req=>{const p=new URL(req.url()).pathname;if(req.method()==='DELETE'&&p.includes('/comments/')){deletes++;deletePaths.push(p);}if(req.method()==='PUT'&&p.endsWith('/translations'))puts++;if(req.method()==='POST'&&p.endsWith('/comments'))posts++;if(req.method()==='GET'&&p===`/api${P}/keys`)keyReads++;if(req.method()==='GET'&&p.endsWith('/comments'))listReads++;});
  await page.click('[aria-label="alpha in en"]');await page.type('[aria-label="alpha in en"]',' local draft');
  const ask=async body=>{for(const li of await page.$$('.history-list li'))if(await li.evaluate((e,b)=>e.querySelector(':scope > span')?.textContent===b,body)){const button=await li.$(':scope > button.danger');await button.evaluate(e=>e.scrollIntoView({block:'center'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await button.click();await page.waitForSelector('[name=confirmCommentDelete]');return;}throw new Error('Comment delete button missing');};
  await ask('Root with peer reply');
  check('pointer request shows exact loaded comment key project branch body and reply count without any request',deletes===0&&puts===0&&posts===0&&keyReads===0&&listReads===0&&await page.$eval('[name=commentDeleteProjectId]',e=>e.textContent)===project.id&&await page.$eval('[name=commentDeleteBranch]',e=>e.textContent)==='main'&&await page.$eval('[name=commentDeleteKeyId]',e=>e.textContent)===key.id&&await page.$eval('[name=commentDeleteKeyName]',e=>e.textContent)==='alpha'&&await page.$eval('[name=commentDeleteId]',e=>e.textContent)===root.id&&await page.$eval('[name=commentDeleteBody]',e=>e.textContent)==='Root with peer reply'&&await page.$eval('[name=commentDeleteReplies]',e=>e.textContent)==='1');
  check('warning names parent cascade author-only permission mention links and loaded-state limits',await page.$eval('[aria-label="Confirm comment deletion"]',e=>e.textContent.includes('including replies by other authors')&&e.textContent.includes('Mention links')&&e.textContent.includes('Only the comment author can delete')&&e.textContent.includes('not a fresh permission check')));
  await page.screenshot({path:'/downloads/editor-comment-delete-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/editor-comment-delete-confirm-mobile.png'});await page.$eval('[aria-label="Confirm comment deletion"]',e=>e.scrollTop=e.scrollHeight);await page.screenshot({path:'/downloads/editor-comment-delete-confirm-mobile-bottom.png'});
  check('390px dialog scrolls to both choices without horizontal overflow',await page.evaluate(()=>{const e=document.querySelector('[aria-label="Confirm comment deletion"]'),r=e.getBoundingClientRect(),b=e.querySelector('[name=cancelCommentDelete]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth&&b.bottom<=r.bottom;}));
  await page.click('[name=cancelCommentDelete]');await page.waitForSelector('[name=confirmCommentDelete]',{hidden:true});await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-editor')).confirmCommentRemove());
  check('pointer cancel preserves focused translation local comment language reply target and new-key text',deletes===0&&puts===0&&posts===0&&listReads===0&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original local draft'&&document.activeElement===e)&&await page.$eval('[name=commentDraft]',e=>e.value==='Unsent local comment')&&await page.$eval('[name=commentLocale]',e=>e.value==='en')&&await page.$eval('[name=newKey]',e=>e.value==='local.new.key')&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-editor')).replyTo()===id,root.id));
  await page.setViewport({width:1280,height:900});await ask('Root with peer reply');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor')),p=c.pendingCommentDelete();p.comment.body='Changed after review';await c.confirmCommentRemove();p.comment.body='Root with peer reply';});check('changed selected comment rejects without deletion or save',deletes===0&&puts===0&&!await page.$('[name=confirmCommentDelete]'));
  await ask('Root with peer reply');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));const r=c.comments().find(x=>x.body==='Peer reply');r.body='Changed reply';await c.confirmCommentRemove();r.body='Peer reply';});check('changed loaded reply rejects parent confirmation',deletes===0&&!await page.$('[name=confirmCommentDelete]'));
  await ask('Root with peer reply');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));window.capturedCommentDelete=c.pendingCommentDelete();return c.refreshComments(c.keys()[0]);});await page.waitForFunction(()=>!document.querySelector('[name=commentsLoading]'));await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.pendingCommentDelete.set(window.capturedCommentDelete);await c.confirmCommentRemove();});check('real thread refresh rejects restored old capture and keeps drafts',deletes===0&&puts===0&&listReads===1&&keyReads===0&&await page.$eval('[name=commentDraft]',e=>e.value==='Unsent local comment'));
  await ask('Root with peer reply');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));window.capturedCommentDelete=c.pendingCommentDelete();await c.toggleComments(c.keys()[0]);await c.toggleComments(c.keys()[0]);c.pendingCommentDelete.set(window.capturedCommentDelete);await c.confirmCommentRemove();});await page.waitForFunction(()=>!document.querySelector('[name=commentsLoading]'));check('thread close and reopen rejects old capture',deletes===0&&puts===0&&listReads===2&&!await page.$('[name=confirmCommentDelete]'));
  // Closing a thread has its existing draft-reset behavior. Refill local text for the real delete checks.
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.commentDraft.set('Second local comment');c.commentLocale.set('en');});
  await ask('Own selected reply');check('reply confirmation names exact reply parent and locale without deleting',deletes===0&&await page.$eval('[name=commentDeleteId]',e=>e.textContent)===ownReply.id&&await page.$eval('[name=commentDeleteParent]',e=>e.textContent)===retained.id&&await page.$eval('[name=commentDeleteLocale]',e=>e.textContent)==='en'&&await page.$eval('[name=commentDeleteReplies]',e=>e.textContent)==='0');await page.click('[name=confirmCommentDelete]');await page.waitForFunction(()=>!document.querySelector('[name=commentsLoading]')&&!document.querySelector('[name=commentsPending]')&&!document.querySelector('.history-row')?.textContent.includes('Own selected reply'));let actual=await call(`${P}/keys/${key.id}/comments`,null,token);check('reply delete happens exactly once retaining its parent and other root with peer reply',deletes===1&&deletePaths[0]===`/api${P}/keys/${key.id}/comments/${ownReply.id}`&&actual.length===3&&actual.some(c=>c.id===retained.id)&&actual.some(c=>c.id===peerReply.id));
  await ask('Root with peer reply');await page.setViewport({width:390,height:844});await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor')),p=c.pendingCommentDelete();c.pendingCommentDelete.set({...p,projectId:'<img onerror=fail>-'+'P'.repeat(100),id:'<img onerror=fail>-'+'I'.repeat(100),body:'<img onerror=fail>-'+'long text '.repeat(200)});});check('long markup-like comment stays escaped wraps and scrolls vertically',await page.$eval('[aria-label="Confirm comment deletion"]',e=>!e.querySelector('img')&&e.textContent.includes('<img onerror=fail>')&&e.scrollWidth<=e.clientWidth&&e.scrollHeight>e.clientHeight));await page.screenshot({path:'/downloads/editor-comment-delete-confirm-long-mobile.png'});await page.$eval('[aria-label="Confirm comment deletion"]',e=>e.scrollTop=e.scrollHeight);await page.click('[name=cancelCommentDelete]');await page.waitForSelector('[name=confirmCommentDelete]',{hidden:true});check('long fixture cancels without mutation',deletes===1&&!await page.$('[name=confirmCommentDelete]'));
  await page.setViewport({width:1280,height:900});await page.evaluate(id=>ng.getComponent(document.querySelector('ol-editor')).replyTo.set(id),root.id);await ask('Root with peer reply');await page.click('[name=confirmCommentDelete]');await page.waitForFunction(()=>!document.querySelector('[name=commentsPending]')&&!document.querySelector('[name=commentsLoading]')&&!document.querySelector('.history-row')?.textContent.includes('Root with peer reply'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-editor')).confirmCommentRemove());actual=await call(`${P}/keys/${key.id}/comments`,null,token);
  check('parent delete happens once and cascades real peer reply while retaining unrelated root',deletes===2&&deletePaths[1]===`/api${P}/keys/${key.id}/comments/${root.id}`&&actual.length===1&&actual[0].id===retained.id);
  check('confirmed deletes read only thread and keep stored translation local text and forms without blur save',puts===0&&posts===0&&keyReads===0&&listReads===4&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original local draft')&&await page.$eval('[name=commentDraft]',e=>e.value==='Second local comment')&&await page.$eval('[name=commentLocale]',e=>e.value==='en')&&await page.$eval('[name=newKey]',e=>e.value==='local.new.key')&&(await call(`${P}/keys`,null,token)).find(k=>k.id===key.id).translations.find(t=>t.localeCode==='en').value==='Original'&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).replyTo()===null));await page.screenshot({path:'/downloads/editor-comment-delete-confirm-result.png'});
  check('no comment-confirmation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
process.exit(failures?1:0);
