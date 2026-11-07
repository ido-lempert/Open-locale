// Real local browser -> QA findings download -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55686, WEB_PORT = 4200, API_PORT = 3000;
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
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});let reads=0,writes=0,held,fail=false;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname===`/api${P}/qa`){if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});held=req;return;}}req.continue();});
  const file=join(downloadDir,'qa-findings.json');await page.click('[name=downloadQa]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));if(!existsSync(file))throw new Error('download did not finish');const report=JSON.parse(readFileSync(file,'utf8'));
  check('actual downloaded JSON exactly matches loaded real branch and locale findings',report.schemaVersion===1&&report.projectId===project.id&&report.branch==='release'&&report.locale==='he'&&JSON.stringify(report.issues)===JSON.stringify(expected.issues)&&report.issues[0].key===keyName);
  check('download is local only with bounded feedback and no account requests',reads===0&&writes===0&&await page.$eval('[name=qaDownloadNotice]',e=>e.textContent.includes('does not confirm'))&&await page.$eval('[name=qaDownloadScope]',e=>e.textContent.includes('private project text')));await page.screenshot({path:'/downloads/qa-findings-loaded.png',fullPage:true});rmSync(file);
  await page.click('[name=refreshQa]');await page.waitForSelector('[name=qaLoading]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-qa')).download());check('held current read disables download and captured handler cannot export stale findings',reads===1&&await page.$eval('[name=downloadQa]',e=>e.disabled)&&!await page.$('[name=qaDownloadNotice]')&&readdirSync(downloadDir).length===0);
  await held.continue();await page.waitForSelector('[name=qaCount]');fail=true;await page.click('[name=refreshQa]');await page.waitForSelector('[name=retryQa]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-qa')).download());check('failed read blocks download without leaking raw server error',reads===2&&await page.$eval('[name=downloadQa]',e=>e.disabled)&&readdirSync(downloadDir).length===0&&!(await page.content()).includes('PRIVATE'));
  fail=false;await page.select('[name=qaBranch]','main');await page.waitForSelector('[name=qaLoading]');for(let n=0;n<100&&reads!==3;n++)await new Promise(r=>setTimeout(r,20));await held.continue();await page.waitForSelector('[name=qaCount]');await page.select('[name=qaLocale]','');await page.waitForSelector('[name=qaLoading]');for(let n=0;n<100&&reads!==4;n++)await new Promise(r=>setTimeout(r,20));await held.continue();await page.waitForSelector('[name=qaCount]');await page.click('[name=downloadQa]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const empty=JSON.parse(readFileSync(file,'utf8'));check('successful empty findings download records current main and all-locales scope',empty.branch==='main'&&empty.locale===null&&empty.issues.length===0&&reads===4&&writes===0);
  await page.screenshot({path:'/downloads/qa-findings-download.png',fullPage:true});check('no QA download runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
