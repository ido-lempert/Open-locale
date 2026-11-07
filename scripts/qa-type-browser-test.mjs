// Real local browser -> QA findings download -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55688, WEB_PORT = 4200, API_PORT = 3000;
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


  await call(`${P}/branches`,{name:'release'},token);
  const keyName='release.download';const key=await call(`${P}/keys`,{name:keyName,branch:'release'},token);await call(`${P}/keys/${key.id}/translations`,{locale:'en',value:'Base title'},token,'PUT');
  const expected=await call(`${P}/qa?branch=release&locale=he`,undefined,token);
  await page.goto(`${WEB}${P}/qa`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=qaCount]');await page.select('[name=qaBranch]','release');await page.waitForFunction(()=>document.querySelector('[name=qaCount]')?.textContent.includes('1 issue'));await page.select('[name=qaLocale]','he');await page.waitForFunction(()=>!document.querySelector('[name=qaLoading]')&&document.querySelector('[name=qaCount]')?.textContent.includes('1 issue'));
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}req.continue();});
  await page.select('[name=qaType]','untranslated');await page.waitForFunction(()=>document.querySelector('[name=qaTypeCount]')?.textContent.includes('1 of 1'));
  check('known type focuses loaded findings and keeps release/he scope',await page.$$eval('table tbody tr',es=>es.length===1)&&await page.$eval('[name=qaBranch]',e=>e.value==='release')&&await page.$eval('[name=qaLocale]',e=>e.value==='he'));
  await page.select('[name=qaType]','max_length');await page.waitForFunction(()=>document.querySelector('[name=qaTypeCount]')?.textContent.includes('0 of 1'));
  check('no match is local filter guidance rather than no issues claim',await page.$eval('tbody',e=>e.textContent.includes('No loaded findings of type Too long')&&e.textContent.includes('Clear type filter')));
  const file=join(downloadDir,'qa-findings.json');await page.click('[name=downloadQa]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const report=JSON.parse(readFileSync(file,'utf8'));
  check('actual download preserves all loaded findings despite zero visible rows',JSON.stringify(report.issues)===JSON.stringify(expected.issues)&&report.branch==='release'&&report.locale==='he'&&await page.$eval('[name=qaDownloadScope]',e=>e.textContent.includes('regardless of the type filter')));
  check('filter and download issue no additional reads or writes',reads===0&&writes===0);
  await page.screenshot({path:'/downloads/qa-type-filter.png',fullPage:true});
  await page.click('[name=clearQaType]');await page.waitForFunction(()=>document.querySelector('[name=qaTypeCount]')?.textContent.includes('1 of 1'));check('Clear restores loaded findings without API requests',await page.$eval('[name=qaType]',e=>e.value==='')&&await page.$$eval('table tbody tr',es=>es.length===1)&&reads===0&&writes===0);
  await page.select('[name=qaType]','untranslated');await page.click('[name=refreshQa]');await page.waitForFunction(()=>!document.querySelector('[name=qaLoading]')&&document.querySelector('[name=qaTypeCount]')?.textContent.includes('1 of 1'));check('explicit reread preserves type selection and performs only current read',reads===1&&writes===0&&await page.$eval('[name=qaType]',e=>e.value==='untranslated'));
  await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/qa-type-filter-narrow.png',fullPage:true});check('no type filter runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
