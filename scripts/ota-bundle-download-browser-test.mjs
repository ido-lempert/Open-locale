// Real local browser -> retained OTA locale bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55712, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
const downloadDir=mkdtempSync(join(tmpdir(),'ol-ota-download-'));
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ota-download-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('ota_download_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/ota_download_browser`;
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


  const entries=Object.fromEntries(Array.from({length:51},(_,i)=>[`key${i}`,i===0?'':i===1?'=Literal\n"עברית"<b>text</b>':`Retained ${i}`]));await call(`${P}/import/en`,{entries},token);const pub=await call(`${P}/ota/publish`,{},token);await call(`${P}/import/en`,{entries:{key2:'NEWER_LIVE'}},token);const expected=await call(`${P}/ota/1/en?branch=main&publicationId=${pub.id}`,undefined,token),bundlePath=`${P}/ota/1/en?branch=main&publicationId=${pub.id}`;
  await page.goto(`${WEB}${bundlePath}`,{waitUntil:'networkidle0'});await page.waitForSelector('.bundle-row');const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'ota-locale-bundle.json'),readDownload=async()=>{for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));if(!existsSync(file))throw new Error('download not finished');return JSON.parse(readFileSync(file,'utf8'));};
  let reads=0,writes=0,held,hold=false,fail=false;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.includes('/ota/')){if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_API'})});if(hold){held=req;return;}}}req.continue();});
  await page.click('[name=nextBundlePage]');await page.waitForFunction(()=>document.querySelectorAll('.bundle-row').length===1);await page.click('[name=downloadBundle]');const paged=await readDownload();check('actual file includes all51 retained translations despite current last page with exact pinned scope',isDeepStrictEqual(paged,{schemaVersion:1,projectId:project.id,publicationId:pub.id,scope:'all-loaded-retained-locale-values',bundle:expected})&&Object.keys(paged.bundle.translations).length===51&&paged.bundle.translations.key2==='Retained 2');rmSync(file);
  await page.type('[name=bundleSearch]','key0');await page.waitForFunction(()=>document.querySelector('[name=bundleMatches]')?.textContent.includes('1 of 51'));await page.click('[name=downloadBundle]');const searched=await readDownload();check('local search does not trim downloaded values or issue reads/writes, literal and empty values preserved',isDeepStrictEqual(searched,paged)&&searched.bundle.translations.key0===''&&searched.bundle.translations.key1===entries.key1&&reads===0&&writes===0&&await page.$eval('[name=bundleDownloadNotice]',e=>e.textContent.includes('does not confirm')));await page.screenshot({path:'/downloads/ota-bundle-download-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/ota-bundle-download-mobile.png',fullPage:true});check('narrow private-content scope/notice/button fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=bundleDownloadScope]',e=>e.textContent.includes('private translation content')));rmSync(file);
  hold=true;await page.$eval('[name=refreshBundle]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=downloadBundle]')?.disabled&&!document.querySelector('[name=bundleDownloadNotice]'));for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-ota-bundle')).download());check('pending read rejects captured export without stale file or notice',reads===1&&readdirSync(downloadDir).length===0);hold=false;await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=bundleLoading]'));
  fail=true;await page.$eval('[name=refreshBundle]',e=>e.click());await page.waitForSelector('[role=alert]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-ota-bundle')).download());check('failed read refuses export without raw details or previous content',reads===2&&readdirSync(downloadDir).length===0&&await page.$eval('[name=downloadBundle]',e=>e.disabled)&&!(await page.content()).includes('PRIVATE_API'));
  fail=false;await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`${P}/ota/1/en?branch=main`);await page.waitForFunction(()=>!document.querySelector('[name=bundleLoading]')&&!document.querySelector('[name=downloadBundle]')?.disabled);await page.$eval('[name=downloadBundle]',e=>e.click());const legacy=await readDownload();check('query-only legacy scope exports explicit unpinned identity without old pin',legacy.publicationId===null&&legacy.projectId===project.id&&isDeepStrictEqual(legacy.bundle,expected)&&await page.$eval('[name=bundleIdentity]',e=>e.textContent.includes('Unpinned legacy link')));rmSync(file);
  await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('PRIVATE_DOWNLOAD');};ng.getComponent(document.querySelector('ol-ota-bundle')).download();});await page.waitForFunction(()=>document.querySelector('[name=bundleDownloadNotice]')?.textContent.includes('could not be started'));check('local download failure gives fixed guidance',!(await page.content()).includes('PRIVATE_DOWNLOAD'));
  await page.evaluate(()=>{window.oldBundle=ng.getComponent(document.querySelector('ol-ota-bundle'));window.afterDestroy=0;URL.createObjectURL=()=>{window.afterDestroy++;return 'blob:local';};history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-ota-bundle'));await page.evaluate(()=>window.oldBundle.download());check('departed captured handler cannot export and no mutation occurred',await page.evaluate(()=>window.afterDestroy===0)&&readdirSync(downloadDir).length===0&&writes===0);
  check('no OTA download runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(process.exitCode??1);
