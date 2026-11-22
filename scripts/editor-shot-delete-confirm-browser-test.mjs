// Real local Angular browser -> built API + Postgres screenshot deletion.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56146, WEB_PORT = 4200, API_PORT = 3000;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);const key=(await call(`${P}/keys`,null,token))[0];
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');const upload=async name=>{const f=new FormData();f.append('file',new Blob([png],{type:'image/png'}),name);const r=await fetch(`${API}${P}/keys/${key.id}/screenshots`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:f});if(!r.ok)throw new Error(`upload ${r.status}`);return r.json();};const target=await upload('context.png');await upload('retained.png');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.shots-toggle');await page.type('[name=newKey]','local.new.key');await page.click('.shots-toggle');await page.waitForFunction(()=>!document.querySelector('[name=shotsLoading]')&&document.querySelectorAll('.shots-list img').length===2&&[...document.querySelectorAll('.shots-list img')].every(e=>e.complete&&e.naturalWidth===1));
  let deletes=0,puts=0,keyReads=0,listReads=0,deletePath='';const readPaths=[];page.on('request',req=>{const p=new URL(req.url()).pathname;if(req.method()==='DELETE'&&p.includes('/screenshots/')){deletes++;deletePath=p;}if(req.method()==='PUT'&&p.endsWith('/translations'))puts++;if(req.method()==='GET'&&p===`/api${P}/keys`)keyReads++;if(req.method()==='GET'&&p.includes('/screenshots')){readPaths.push(p);if(p.endsWith('/screenshots'))listReads++;}});
  await page.click('[aria-label="alpha in en"]');await page.type('[aria-label="alpha in en"]',' local draft');const ask=async()=>{await page.click('[aria-label="Delete screenshot context.png"]');await page.waitForSelector('[name=confirmShotDelete]');};await ask();
  check('pointer request opens exact loaded screenshot key project and branch without request or blur save',deletes===0&&puts===0&&keyReads===0&&readPaths.length===0&&await page.$eval('[name=shotDeleteProjectId]',e=>e.textContent)===project.id&&await page.$eval('[name=shotDeleteBranch]',e=>e.textContent)==='main'&&await page.$eval('[name=shotDeleteKeyId]',e=>e.textContent)===key.id&&await page.$eval('[name=shotDeleteKeyName]',e=>e.textContent)==='alpha'&&await page.$eval('[name=shotDeleteId]',e=>e.textContent)===target.id&&await page.$eval('[name=shotDeleteFilename]',e=>e.textContent)==='context.png'&&await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')==='alpha in en'));
  check('review names selected stored image scope and loaded-state limits',await page.$eval('[aria-label="Confirm screenshot deletion"]',e=>e.textContent.includes('stored screenshot and its image bytes')&&e.textContent.includes('key, translations, comments and other screenshots are not deleted')&&e.textContent.includes('not a fresh permission check or newer server state')));
  await page.screenshot({path:'/downloads/editor-shot-delete-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/editor-shot-delete-confirm-mobile.png'});
  check('390px warning identity and choices fit the modal without horizontal overflow',await page.evaluate(()=>{const e=document.querySelector('[aria-label="Confirm screenshot deletion"]'),r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth;}));
  await page.click('[name=cancelShotDelete]');await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-editor')).confirmShotRemove());check('pointer cancel keeps focus both screenshots local translation and new-key draft without request',deletes===0&&puts===0&&keyReads===0&&readPaths.length===0&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original local draft'&&document.activeElement===e)&&await page.$eval('[name=newKey]',e=>e.value==='local.new.key')&&await page.$$eval('.shots-list img',e=>e.length===2)&&(await call(`${P}/keys/${key.id}/screenshots`,null,token)).length===2);
  await ask();await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor')),p=c.pendingShotDelete();p.shot.filename='Changed after review';await c.confirmShotRemove();p.shot.filename='context.png';});check('later loaded screenshot metadata change rejects confirmation without deletion',deletes===0&&puts===0&&!await page.$('[name=confirmShotDelete]'));
  await ask();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));window.capturedShotDelete=c.pendingShotDelete();return c.refreshShots(c.keys()[0]);});await page.waitForFunction(()=>!document.querySelector('[name=shotsLoading]'));await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.pendingShotDelete.set(window.capturedShotDelete);await c.confirmShotRemove();});check('new real screenshot read rejects restored old capture without deletion or save',deletes===0&&puts===0&&listReads===1&&keyReads===0&&!await page.$('[name=confirmShotDelete]'));
  await ask();await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));window.capturedShotDelete=c.pendingShotDelete();await c.toggleShots(c.keys()[0]);await c.toggleShots(c.keys()[0]);c.pendingShotDelete.set(window.capturedShotDelete);await c.confirmShotRemove();});await page.waitForFunction(()=>!document.querySelector('[name=shotsLoading]'));check('pane close and reopen rejects captured old confirmation',deletes===0&&puts===0&&listReads===2&&!await page.$('[name=confirmShotDelete]'));
  await ask();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor')),p=c.pendingShotDelete();c.pendingShotDelete.set({...p,projectId:'<img onerror=fail>-'+'P'.repeat(100),keyId:'<img onerror=fail>-'+'K'.repeat(100),id:'<img onerror=fail>-'+'I'.repeat(100),filename:'<img onerror=fail>-'+'F'.repeat(300)});});check('long markup-like metadata stays escaped with vertical scroll and no horizontal overflow',await page.$eval('[aria-label="Confirm screenshot deletion"]',e=>!e.querySelector('img')&&e.textContent.includes('<img onerror=fail>')&&e.scrollWidth<=e.clientWidth&&e.scrollHeight>e.clientHeight));await page.screenshot({path:'/downloads/editor-shot-delete-confirm-long-mobile-top.png'});await page.$eval('[aria-label="Confirm screenshot deletion"]',e=>e.scrollTop=e.scrollHeight);await page.screenshot({path:'/downloads/editor-shot-delete-confirm-long-mobile-bottom.png'});await page.click('[name=cancelShotDelete]');await page.waitForSelector('[name=confirmShotDelete]',{hidden:true});check('long fixture choices reachable and canceled before real delete',deletes===0&&!await page.$('[name=confirmShotDelete]'));
  await page.setViewport({width:1280,height:900});await ask();await page.click('[name=confirmShotDelete]');await page.waitForFunction(()=>!document.querySelector('[name=shotsMutating]')&&!document.querySelector('[name=shotsLoading]')&&!document.querySelector('[aria-label="Delete screenshot context.png"]')&&document.querySelector('.shots-list img')?.complete);await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-editor')).confirmShotRemove());const remaining=await call(`${P}/keys/${key.id}/screenshots`,null,token);check('explicit confirmation deletes exact screenshot once and refreshes only screenshot data',deletes===1&&deletePath===`/api${P}/keys/${key.id}/screenshots/${target.id}`&&listReads===3&&keyReads===0&&readPaths.every(p=>p.includes(`/keys/${key.id}/screenshots`))&&remaining.length===1&&remaining[0].filename==='retained.png');
  check('real delete retains key persisted translation local value and new-key form without blur save',puts===0&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original local draft')&&await page.$eval('[name=newKey]',e=>e.value==='local.new.key')&&(await call(`${P}/keys`,null,token)).find(k=>k.id===key.id).translations.find(t=>t.localeCode==='en').value==='Original');await page.screenshot({path:'/downloads/editor-shot-delete-confirm-result.png'});check('no screenshot-confirmation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
