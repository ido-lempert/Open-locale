// Real local browser -> Branch reports download -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55687, WEB_PORT = 4200, API_PORT = 3000;
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


  await call(`${P}/branches`,{name:'release'},token);const key=await call(`${P}/keys`,{name:'release.report',branch:'release'},token);await call(`${P}/keys/${key.id}/translations`,{locale:'en',value:'Base title'},token,'PUT');
  const progress=await call(`${P}/reports/progress?branch=release`,undefined,token),quality=await call(`${P}/reports/quality?branch=release`,undefined,token);
  await page.goto(`${WEB}${P}/reports`,{waitUntil:'networkidle0'});await page.select('[name=reportBranch]','release');await page.waitForFunction(()=>document.querySelector('.progress-table')?.textContent.includes('1 / 1'));
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});let reads=0,writes=0,fail=false,held=[];await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname===`/api${P}/reports/progress`||u.pathname===`/api${P}/reports/quality`){if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});held.push(req);return;}}req.continue();});
  const file=join(downloadDir,'branch-reports.json');await page.click('[name=downloadBranchReports]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const report=JSON.parse(readFileSync(file,'utf8'));
  check('actual downloaded bytes preserve loaded real release progress and quality only',report.schemaVersion===1&&report.projectId===project.id&&report.branch==='release'&&JSON.stringify(report.progress)===JSON.stringify(progress)&&JSON.stringify(report.quality)===JSON.stringify(quality)&&!('usage' in report)&&!('taskReport' in report));
  check('download uses no account requests and names separate-read private scope',reads===0&&writes===0&&await page.$eval('[name=branchDownloadScope]',e=>e.textContent.includes('separate reads')&&e.textContent.includes('private project data'))&&await page.$eval('[name=branchDownloadNotice]',e=>e.textContent.includes('does not confirm')));await page.screenshot({path:'/downloads/branch-reports-download.png',fullPage:true});rmSync(file);
  await page.click('[name=refreshBranchReports]');await page.waitForSelector('[name=branchReportLoading]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-reports')).downloadBranch());check('held branch refresh blocks captured download and retains sibling figures',await page.$eval('[name=downloadBranchReports]',e=>e.disabled)&&!await page.$('[name=branchDownloadNotice]')&&!!await page.$('.usage-table')&&readdirSync(downloadDir).length===0);
  for(let n=0;n<100&&held.length!==2;n++)await new Promise(r=>setTimeout(r,20));for(const req of held.splice(0))await req.continue();await page.waitForSelector('.progress-table');fail=true;await page.click('[name=refreshBranchReports]');await page.waitForSelector('[name=branchReportError]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-reports')).downloadBranch());check('failed branch read blocks stale report download with fixed guidance',await page.$eval('[name=downloadBranchReports]',e=>e.disabled)&&readdirSync(downloadDir).length===0&&!(await page.content()).includes('PRIVATE'));
  fail=false;await page.select('[name=reportBranch]','main');await page.waitForSelector('[name=branchReportLoading]');for(let n=0;n<100&&held.length!==2;n++)await new Promise(r=>setTimeout(r,20));for(const req of held.splice(0))await req.continue();await page.waitForSelector('.progress-table');await page.click('[name=downloadBranchReports]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const empty=JSON.parse(readFileSync(file,'utf8'));check('successful empty main reports export current branch not previous release',empty.branch==='main'&&empty.progress.branch==='main'&&empty.progress.totalKeys===0&&empty.quality.branch==='main'&&writes===0);
  check('no branch report download runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
