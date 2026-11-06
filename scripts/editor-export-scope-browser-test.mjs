// Real local browser -> bundle import continuation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55624, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Saved server'}},token);await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  await page.evaluate(()=>{window.__downloads=[];window.__blobs=new Map();const create=URL.createObjectURL;URL.createObjectURL=function(blob){const url=create.call(URL,blob);window.__blobs.set(url,blob);return url;};const original=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.__downloads.push({filename:this.download,url:this.href,blob:window.__blobs.get(this.href)});return;}return original.call(this);};});
  let held,requests=0,fail=false;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path.includes(`/api${P}/export/`)){requests++;if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_EXPORT_ERROR'})});held=req;return;}req.continue();});
  const waitHeld=async()=>{for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('export GET not held');};
  await page.click('[name=exportFile]');await waitHeld();await page.waitForSelector('[name=exportPending]');check('all export controls disabled during one held request',await page.$eval('[name=exportFile]',e=>e.disabled)&&await page.$eval('[name=exportBundle]',e=>e.disabled)&&await page.$eval('[name=exportTmx]',e=>e.disabled));await page.screenshot({path:'/downloads/editor-export-pending.png',fullPage:false});await page.select('[name=ioLocale]','he');await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=exportPending]'));check('late EN export after HE selection creates no download or stale feedback',requests===1&&await page.evaluate(()=>window.__downloads.length===0)&&!await page.$('[name=exportNotice]'));
  await page.select('[name=ioLocale]','en');await page.$eval('[aria-label="alpha in en"]',e=>{e.value='Unsaved draft';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('[name=exportFile]');await waitHeld();const scope=new URL(held.url());await held.continue();held=null;await page.waitForSelector('[name=exportNotice]');check('explicit current export downloads captured EN filename despite local draft',scope.pathname.endsWith('/export/en')&&scope.searchParams.get('branch')==='main'&&await page.evaluate(()=>window.__downloads.length===1&&window.__downloads[0].filename==='sync-browser.en.json')&&await page.evaluate(async()=>JSON.parse(await window.__downloads[0].blob.text()).alpha==='Saved server')&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Unsaved draft')&&await page.$eval('main',e=>e.innerText.includes('saved server values only')));await page.screenshot({path:'/downloads/editor-export-confirmed.png',fullPage:false});
  fail=true;await page.click('[name=exportFile]');await page.waitForSelector('[name=exportError]');check('export failure is fixed and does not start a download',await page.evaluate(()=>window.__downloads.length===1)&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));fail=false;await page.click('[name=exportFile]');await waitHeld();await page.waitForSelector('[name=exportPending]');await page.select('[name=ioFormat]','po');await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=exportPending]'));await page.waitForFunction(()=>!document.querySelector('[name=exportError]')&&!document.querySelector('[name=exportNotice]'));check('format change discards pending old-format download',await page.evaluate(()=>window.__downloads.length===1)&&!await page.$('[name=exportError]')&&!await page.$('[name=exportNotice]'));
  check('no export continuation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
