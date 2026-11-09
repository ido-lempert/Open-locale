// Real local browser -> QA local search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55722, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;const downloadDir=mkdtempSync(join(tmpdir(),'ol-qa-download-'));
process.exitCode = 1;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  await call(`${P}/import/en`,{entries:{'checkout.[A]':'Base title','other':'Other base'}},token);const expected=await call(`${P}/qa`,undefined,token);const emptyProject=await call('/projects',{name:'Empty',slug:'empty',locales:['en','he']},token);
  await page.goto(`${WEB}${P}/qa`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=qaCount]');let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}req.continue();});
  await page.type('[name=qaSearch]','[a]');await page.waitForFunction(()=>document.querySelector('[name=qaTypeCount]')?.textContent.includes('1 of 2'));check('literal case-insensitive local key search narrows actual loaded findings without requests',reads===0&&writes===0&&await page.$eval('tbody',e=>e.textContent.includes('checkout.[A]')&&!e.textContent.includes('other')));
  await page.select('[name=qaType]','max_length');await page.waitForFunction(()=>document.querySelector('[name=qaTypeCount]')?.textContent.includes('0 of 2'));check('search/type intersection gives filtered-empty rather than no-issues claim',await page.$eval('tbody',e=>e.textContent.includes('No loaded findings match this search')&&!e.textContent.includes('No QA issues found')));
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'qa-findings.json');await page.click('[name=downloadQa]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const report=JSON.parse(readFileSync(file,'utf8'));check('actual download retains full loaded set despite no visible matches and has no API effects',JSON.stringify(report.issues)===JSON.stringify(expected.issues)&&reads===0&&writes===0&&await page.$eval('[name=qaDownloadScope]',e=>e.textContent.includes('regardless of local search')));
  await page.screenshot({path:'/downloads/qa-search-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/qa-search-mobile.png',fullPage:true});check('narrow search controls/scope/empty feedback fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=qaEmpty] td',e=>e.scrollWidth<=e.clientWidth+1));
  await page.click('[name=clearQaType]');await page.waitForFunction(()=>document.querySelector('[name=qaTypeCount]')?.textContent.includes('1 of 2'));await page.$eval('[name=clearQaSearch]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=qaSearch]')?.value==='');await page.type('[name=qaSearch]',' HE ');await page.waitForFunction(()=>document.querySelector('[name=qaTypeCount]')?.textContent.includes('2 of 2'));check('trimmed locale search and clear compose without requests',reads===0&&writes===0);
  // The previous query keeps the same count. Wait for Angular's button render,
  // not that unchanged count, before clicking a formerly disabled control.
  await page.waitForFunction(()=>document.querySelector('[name=clearQaSearch]')?.disabled===false);await page.$eval('[name=clearQaSearch]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=qaSearch]')?.value==='');const detail=expected.issues[0].detail;await page.type('[name=qaSearch]',detail.toUpperCase());await page.waitForFunction(()=>document.querySelector('[name=qaTypeCount]')?.textContent.includes('2 of 2'));check('detail text is searchable without rerunning checks',reads===0&&writes===0);
  await page.click('[name=refreshQa]');await page.waitForFunction(()=>!document.querySelector('[name=qaLoading]')&&!!document.querySelector('[name=qaCount]'));check('explicit rerun retains local search/type',reads===1&&writes===0&&await page.$eval('[name=qaSearch]',(e,v)=>e.value===v,detail.toUpperCase()));
  await page.evaluate(p=>{window.oldQa=ng.getComponent(document.querySelector('ol-qa'));history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${emptyProject.id}/qa`);await page.waitForFunction(()=>!document.querySelector('[name=qaLoading]')&&document.querySelector('[name=qaCount]')?.textContent.includes('0 issues'));check('reused project resets search and shows true no-issues scope',await page.$eval('[name=qaSearch]',e=>e.value==='')&&await page.$eval('tbody',e=>e.textContent.includes('No QA issues found')));
  await page.evaluate(()=>{window.lastQa=ng.getComponent(document.querySelector('ol-qa'));history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-qa'));await page.evaluate(()=>window.lastQa.setQuery('late'));check('departed local search handler cannot change query',await page.evaluate(()=>window.lastQa.query()===''));
  check('no QA search runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
