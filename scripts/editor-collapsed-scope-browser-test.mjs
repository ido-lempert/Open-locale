// Real local browser -> failed save recovery -> local retained-grid download.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55893, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
const downloadDir=mkdtempSync(join(tmpdir(),'retained-download-'));
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-export-scope-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('export_scope_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/export_scope_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Saved alpha',beta:'Saved beta'}},token);const keys=await call(`${P}/keys`,null,token),a=keys.find(k=>k.name==='alpha');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  const requests=[];await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/'))requests.push({method:req.method(),path});req.continue();});
  check('clean healthy editor has no local backup control',!await page.$('[name=downloadRetainedGrid]')&&!await page.$('[name=keysError]'));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.search.set('alpha');return c.reload();});await page.waitForSelector('[aria-label="alpha in en"]');
  check('expanded tools do not repeat collapsed grid scope',!await page.$('[name=collapsedGridScope]'));
  await page.click('[name=toggleEditorTools]');await page.waitForSelector('[name=collapsedGridScope]');
  check('clean filtered grid keeps last successful branch/filter visible with hidden tools',await page.$eval('[name=collapsedGridScope]',e=>e.textContent.includes('branch main')&&e.textContent.includes('key search: alpha')&&e.textContent.includes('status locale: not applied')&&e.textContent.includes('not save confirmation'))&&await page.$eval('#editorTools',e=>getComputedStyle(e).display==='none'));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/editor-collapsed-scope-clean-desktop.png'});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/editor-collapsed-scope-clean-mobile.png'});
  check('390px clean scope stays above a visible grid without overflow',await page.$eval('.grid',e=>e.getBoundingClientRect().top<innerHeight)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));window.savedReadScope=c.loadedGridScope();c.loadedGridScope.set({...window.savedReadScope,branch:'release <img src=x onerror=alert(1)>',tag:'x'.repeat(160),status:'REVIEWED',locale:'he'});});await page.waitForFunction(()=>document.querySelector('[name=collapsedGridScope]')?.textContent.includes('status locale: he'));
  check('scope renders literal long markup with status locale and no injected image',await page.$eval('[name=collapsedGridScope]',e=>e.textContent.includes('release <img src=x onerror=alert(1)>')&&e.textContent.includes('status: REVIEWED')&&!e.querySelector('img')&&e.getBoundingClientRect().right<=innerWidth)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'/downloads/editor-collapsed-scope-long-mobile.png'});
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).loadedGridScope.set(window.savedReadScope));await page.setViewport({width:1280,height:900});
  const input=await page.$('[aria-label="alpha in en"]');await input.focus();await input.type(' LOCAL_ONLY_DRAFT');const local=await input.evaluate(e=>e.value);await page.waitForSelector('[name=localGridBackupToggle]');requests.length=0;
  await page.click('[name=localGridBackupToggle]');await page.waitForSelector('[name=retainedKeyDrafts]');await new Promise(r=>setTimeout(r,150));
  check('actual dirty editor expands backup without blur save or key failure',requests.length===0&&!await page.$('[name=keysError]')&&await input.evaluate((e,v)=>e.value===v,local));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.editForm(c.keys().find(k=>k.name==='alpha'),'en','other','Plural local <private>');});
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'open-locale-retained-values.json');
  await page.evaluate(()=>{const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);window.backupCreated=[];window.backupRevoked=[];URL.createObjectURL=b=>{const u=create(b);window.backupCreated.push(u);return u;};URL.revokeObjectURL=u=>{window.backupRevoked.push(u);revoke(u);};});
  await page.click('[name=downloadRetainedGrid]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const data=JSON.parse(readFileSync(file,'utf8'));rmSync(file);
  check('actual healthy local JSON keeps displayed draft and plural values',data.schemaVersion===2&&data.projectId===project.id&&data.values.length===1&&data.values.some(k=>k.key==='alpha'&&k.values.some(v=>v.locale==='en'&&v.value.includes('LOCAL_ONLY_DRAFT')&&v.pluralForms.other==='Plural local <private>')));
  check('backup is explicitly unverified current-grid only, not an import file',data.kind==='unverified-retained-grid-values'&&data.scope==='currently-retained-grid-only'&&data.confirmedSaved===false&&data.importFile===false&&await page.$eval('[name=retainedDownloadScope]',e=>e.textContent.includes('not all project keys')&&e.textContent.includes('not uploaded or shared')));
  check('backup makes zero requests, retains grid and revokes actual Blob URL',requests.length===0&&await input.evaluate((e,v)=>e.value===v,local)&&await page.evaluate(()=>window.backupCreated.length===1&&window.backupRevoked[0]===window.backupCreated[0]));
  check('schema2 download records last successful filtered read, not all project keys',JSON.stringify(data.loadedGridScope)===JSON.stringify({projectId:project.id,branch:'main',search:'alpha',tag:null,status:null,locale:null})&&data.scopeMeaning==='last-successful-key-read-not-current-toolbar-or-save-confirmation');
  await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.branch.set('not-loaded');c.search.set('different');c.filterTag.set('new-tag');c.filterStatus.set('REVIEWED');c.ioLocale.set('he');await c.reload();});await page.waitForSelector('[name=keysError]');await page.click('[name=localGridBackupToggle]');await page.waitForSelector('[name=retainedKeyDrafts]',{visible:true});requests.length=0;
  await page.click('[name=downloadRetainedGrid]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const retained=JSON.parse(readFileSync(file,'utf8'));rmSync(file);
  check('real failed branch read retains prior branch/filter scope and local values',retained.loadedGridScope?.branch==='main'&&retained.loadedGridScope.search==='alpha'&&JSON.stringify(retained.loadedGridScope)===JSON.stringify(data.loadedGridScope)&&retained.values[0].values.some(v=>v.value.includes('LOCAL_ONLY_DRAFT'))&&requests.length===0);
  check('collapsed scope stays at prior successful read after failed superseding request',await page.$eval('[name=collapsedGridScope]',e=>e.textContent.includes('branch main')&&e.textContent.includes('key search: alpha')&&!e.textContent.includes('branch not-loaded')));
  check('visible retained scope differs explicitly from current toolbar',await page.$eval('[name=localBackupLoadedScope]',e=>e.textContent.includes('branch main')&&e.textContent.includes('key search: alpha')&&!e.textContent.includes('branch not-loaded')&&e.textContent.includes('does not confirm')));
  await page.screenshot({path:'/downloads/editor-collapsed-scope-desktop.png'});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.$eval('[name=retainedKeyDrafts]',e=>{e.scrollTop=0;e.scrollLeft=0;});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:'/downloads/editor-collapsed-scope-mobile.png'});
  check('390px scope guidance fits viewport with no document overflow',await page.$eval('[name=localBackupLoadedScope]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth;}));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.keysLoading.set(true);c.downloadRetainedGrid();});await new Promise(r=>setTimeout(r,100));check('captured pending reread refuses backup with no effects',requests.length===0&&!existsSync(file)&&await page.evaluate(()=>window.backupCreated.length===2));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.keysLoading.set(false);c.loadedGridScope.set(null);});await page.waitForFunction(()=>document.querySelector('[name=collapsedGridScope]')?.textContent.includes('unavailable'));
  check('unknown captured scope explicitly refuses toolbar inference',await page.$eval('[name=collapsedGridScope]',e=>e.textContent.includes('choices do not identify retained values')&&!e.textContent.includes('branch not-loaded')));
  await page.click('[name=toggleEditorTools]');await page.waitForFunction(()=>!document.querySelector('[name=collapsedGridScope]'));
  check('reopening removes compact scope without changing current choices',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.branch()==='not-loaded'&&c.search()==='different';}));
  check('no collapsed scope runtime errors' ,!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??String(e)}`);process.exitCode=1;}
finally {
  await browser?.close();rmSync(downloadDir,{recursive:true,force:true});
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
