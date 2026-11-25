// Real local browser -> QA local search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.QA_TABLE_SCROLL_TEST_PG_PORT ?? 56361), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;const downloadDir=mkdtempSync(join(tmpdir(),'ol-qa-download-'));
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-list-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_list_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_list_browser`;
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


  const rows=[{keyId:'a',key:'release.title',locale:'he',detail:'Detail at right <img src=x> literal',type:'whitespace'},{keyId:'b',key:'other',locale:'fr',detail:'Keep current source',type:'untranslated'}];let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname===`/api${P}/qa`&&req.method()==='GET'){reads++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({issues:rows})});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});await page.goto(`${WEB}${P}/qa`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Loaded QA findings"]');const selector='[aria-label="Loaded QA findings"]',ready=()=>page.$eval(selector,e=>e.tabIndex===0&&e.getAttribute('role')==='region'&&!!document.getElementById(e.getAttribute('aria-describedby')));check('loaded findings have named described keyboard region',await ready());await page.$eval(selector,e=>e.removeAttribute('tabindex'));check('negative missing keyboard-stop probe detected',!await ready());await page.$eval(selector,e=>e.tabIndex=0);check('keyboard stop restored after isolated negative probe',await ready());await page.screenshot({path:'/downloads/qa-scroll-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.focus(selector);await page.keyboard.press('ArrowRight');await new Promise(r=>setTimeout(r,180));check('ArrowRight scrolls table without moving document horizontally',await page.$eval(selector,e=>e.scrollLeft>0&&document.activeElement===e)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.keyboard.press('Tab');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');check('Tab reverse traversal returns to named region with visible focus',await page.$eval(selector,e=>document.activeElement===e&&parseFloat(getComputedStyle(e).outlineWidth)>=2));await page.$eval(selector,e=>{e.scrollLeft=e.scrollWidth;e.scrollIntoView({block:'center'});});await page.screenshot({path:'/downloads/qa-scroll-mobile.png'});check('offscreen details remain literal and accessible through internal scroll',await page.$eval(selector,e=>e.textContent.includes('Detail at right <img src=x> literal')&&!e.querySelector('img')&&e.scrollLeft>0));await page.$eval('[name=qaSearch]',e=>{e.value='no-match';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForSelector('[name=qaEmpty]');check('filtered empty table keeps named region and viewport fit',await ready()&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__report=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.$eval('[name=downloadQa]',e=>e.click());await page.waitForFunction(()=>!!window.__report);check('empty projection download keeps exact loaded findings',await page.evaluate(expected=>JSON.stringify(window.__report.issues)===JSON.stringify(expected),rows));check('scroll filter download do not rerun or mutate checks',reads===1&&writes===0);check('no QA scroll runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(!completed||failures?1:0);
