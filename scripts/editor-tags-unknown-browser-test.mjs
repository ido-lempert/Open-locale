// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55766, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tags-unknown-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('tags_unknown_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/tags_unknown_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original',beta:'Other'}},token);
  const keys=await call(`${P}/keys`,null,token),key=keys.find(k=>k.name==='alpha');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  const mutations=[];let keyReads=0,failRead=false;await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&!['GET','OPTIONS'].includes(req.method()))mutations.push(path);if(req.method()==='PATCH'&&path.endsWith('/tags')){await call(`${P}/keys/${key.id}/tags`,JSON.parse(req.postData()),token,'PATCH');return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_TAG_RESULT'})});}if(req.method()==='GET'&&path===`/api${P}/keys`){keyReads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:'{}'});}req.continue();});
  await page.click('.tags-toggle');await page.waitForSelector('.tag-edit');await page.type('.tag-edit','committed');await page.keyboard.press('Enter');await page.waitForSelector('[name=tagsError]');
  const persisted=(await call(`${P}/keys`,null,token)).find(k=>k.id===key.id);check('committed then lost tag result pauses same-key editor',persisted.tags.join(',')==='committed'&&await page.$eval('.tags-toggle',e=>e.disabled)&&mutations.length===1&&keyReads===0&&!(await page.content()).includes('PRIVATE_TAG_RESULT'));
  await page.screenshot({path:'/downloads/editor-tags-paused-desktop.png',fullPage:false});await page.setViewport({width:390,height:844});await page.$eval('[name=tagsError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-tags-paused-mobile.png',fullPage:false});await page.setViewport({width:1280,height:900});
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor')),k=c.keys().find(k=>k.name==='alpha');c.openTagEdit(k);c.tagEditFor.set(k.id);c.tagDraft.set('duplicate');return c.saveTags(k);});check('captured editor and save cannot repeat unknown write',mutations.length===1);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).tagEditFor.set(null));await page.waitForSelector('.tags-toggle');
  await page.focus('[aria-label="alpha in en"]');await page.type('[aria-label="alpha in en"]',' local draft');await page.click('[name=reloadAfterTags]');await page.waitForSelector('[name=keysError]');check('focused recovery is read-free and preserves local translation without blur autosave',keyReads===0&&mutations.length===1&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original local draft'));
  await page.click('summary');await page.waitForSelector('[name=retainedKeyDrafts]');check('retained copy exposes exact local translation before explicit reload',await page.$eval('[name=retainedKeyDrafts]',e=>e.value.includes('Original local draft'))&&mutations.length===1);
  await page.$eval('[name=keysError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-tags-unknown-desktop.png',fullPage:false});await page.setViewport({width:390,height:844});await page.$eval('[name=keysError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-tags-unknown-mobile.png',fullPage:false});check('390px retained-values recovery fits viewport',await page.$eval('[name=retryKeys]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})&&await page.$eval('[name=retainedKeyDrafts]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
  failRead=true;await page.$eval('[name=retryKeys]',e=>e.click());await page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return !c.keysLoading()&&c.keysError()&&!!document.querySelector('[name=keysError]')&&!document.querySelector('[name=keysLoading]');});check('failed reload retains values and same-key captured editor stays paused',await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original local draft')&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.openTagEdit(c.keys().find(k=>k.name==='alpha'));return c.tagEditFor()===null;})&&mutations.length===1&&keyReads===1);
  failRead=false;await page.$eval('[name=retryKeys]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=keysError]')&&!document.querySelector('[name=keysLoading]'));check('successful explicit reload reads actual committed tags without retrying write',await page.$eval('.tag-chip',e=>e.textContent==='committed')&&!await page.$('[name=tagsError]')&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original')&&mutations.length===1&&keyReads===2);
  await page.click('.tags-toggle');await page.waitForSelector('.tag-edit');check('fresh tag editor starts from current confirmed metadata',await page.$eval('.tag-edit',e=>e.value==='committed')&&mutations.length===1);
  check('no tag-uncertainty runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
