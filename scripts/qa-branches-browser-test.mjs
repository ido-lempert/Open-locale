// Real local browser -> QA screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55679, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-task-receipt-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('task_receipt_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/task_receipt_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  await call(`${P}/import/en`,{entries:{title:'Local title',conflict:'Local edit',remote:'Old text',empty:''}},token);
  await call(`${P}/tasks`,{title:'Actual task recovery'},token);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  await call(`${P}/branches`,{name:'release'},token);const releaseKey=await call(`${P}/keys`,{name:'release.only',branch:'release'},token);await call(`${P}/keys/${releaseKey.id}/translations`,{locale:'en',value:'Release base'},token,'PUT');let qaReads=0,branchReads=0,failBranches=true,held=[];await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(req.method()==='GET'&&u.pathname===`/api${P}/branches`){branchReads++;if(failBranches)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}if(u.pathname===`/api${P}/qa`){qaReads++;if(u.searchParams.get('branch')==='release'){held.push(req);return;}}req.continue();});await page.goto(`${WEB}${P}/qa`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=qaCount]');await page.waitForSelector('[name=retryQaBranches]');check('branch discovery failure keeps real main QA findings with independent fixed guidance',qaReads===1&&branchReads===1&&await page.$eval('.qa-table',e=>e.textContent.includes('title')&&!e.textContent.includes('release.only'))&&!(await page.content()).includes('PRIVATE'));failBranches=false;await page.click('[name=retryQaBranches]');await page.waitForFunction(()=>document.querySelector('[name=qaBranch]').options.length===2);check('branch discovery retry restores choices without rerunning findings',qaReads===1&&branchReads===2&&!await page.$('[name=qaBranchesError]'));
  await page.select('[name=qaBranch]','release');await page.waitForSelector('[name=qaLoading]');for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));check('branch switch clears stale main findings while real release read pending',qaReads===2&&!await page.$('.qa-table')&&await page.$eval('[name=qaBranchScope]',e=>e.textContent.includes('release')));await page.select('[name=qaBranch]','main');await page.waitForSelector('[name=qaCount]');await held.shift().continue();await new Promise(r=>setTimeout(r,100));check('late actual release findings cannot overwrite current main selection',qaReads===3&&await page.$eval('.qa-table',e=>e.textContent.includes('title')&&!e.textContent.includes('release.only'))&&await page.$eval('[name=qaBranch]',e=>e.value==='main'));
  await page.select('[name=qaBranch]','release');await page.waitForSelector('[name=qaLoading]');for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));await held.shift().continue();await page.waitForSelector('[name=qaCount]');check('real release findings are scoped separately from main',qaReads===4&&await page.$eval('.qa-table',e=>e.textContent.includes('release.only')&&!e.textContent.includes('title')));await page.select('[name=qaLocale]','he');await page.waitForSelector('[name=qaLoading]');for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));const scoped=held.shift();check('selected locale request retains selected branch',new URL(scoped.url()).searchParams.get('locale')==='he'&&new URL(scoped.url()).searchParams.get('branch')==='release');await scoped.continue();await page.waitForSelector('[name=qaCount]');await page.screenshot({path:'/downloads/qa-branch-scope.png',fullPage:true});
  check('no QA branch runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
