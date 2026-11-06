// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55596, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
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


  let held,failList=false,failStatus=true,statusReads=0,listReads=0,mutations=0;
  await page.setRequestInterception(true);page.on('request',req=>{
    const path=new URL(req.url()).pathname;
    if(['POST','PUT','PATCH','DELETE'].includes(req.method()))mutations++;
    if(req.method()==='GET'&&path==='/api/projects'){listReads++;if(held===true){held=req;return;}if(failList)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_LIST_DETAIL'})});}
    if(req.method()==='GET'&&path==='/api/auth/2fa/status'){statusReads++;if(failStatus)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_SECURITY_DETAIL'})});}
    req.continue();
  });
  held=true;await page.goto(`${WEB}/projects`,{waitUntil:'domcontentloaded'});await page.waitForSelector('[name=projectsLoading]');
  check('pending list never reports false empty or shows stale project cards',!await page.$('.empty')&&!await page.$('.cards li'));
  await page.screenshot({path:'/downloads/projects-loading.png',fullPage:false});
  for(let n=0;n<100&&held===true;n++)await new Promise(r=>setTimeout(r,20));if(!held?.continue)throw new Error('list request not held');const first=held;held=false;await first.continue();await page.waitForSelector(`a[href="${P}"]`);await page.waitForSelector('[name=retryTfa]');
  check('security status failure does not hide successful project list or imply disabled',!await page.$('[name=projectsError]')&&!await page.$('[aria-label="Current password"]')&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  await page.screenshot({path:'/downloads/projects-status-error.png',fullPage:false});
  failStatus=false;const priorList=listReads;await page.click('[name=retryTfa]');await page.waitForSelector('[aria-label="Current password"]');check('status-only retry recovers without reloading projects or mutating settings',listReads===priorList&&mutations===0&&!await page.$('[name=tfaError]'));
  failList=true;await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[name=retryProjects]');check('failed list fixed retry has neither false empty nor raw detail, security remains usable',!await page.$('.empty')&&!await page.$('.cards li')&&!!await page.$('[aria-label="Current password"]')&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));await page.screenshot({path:'/downloads/projects-list-error.png',fullPage:false});
  failList=false;const priorStatus=statusReads;await page.click('[name=retryProjects]');await page.waitForSelector(`a[href="${P}"]`);check('list-only retry recovers real project without refetching account status',statusReads===priorStatus&&mutations===0);await page.screenshot({path:'/downloads/projects-ready.png',fullPage:false});
  held=true;await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[name=projectsLoading]');for(let n=0;n<100&&held===true;n++)await new Promise(r=>setTimeout(r,20));if(!held?.continue)throw new Error('late list request not held');await page.click('.identities-link');await page.waitForFunction(()=>location.pathname==='/account/identities');const late=held;held=false;await late.continue();await new Promise(r=>setTimeout(r,300));check('route-away suppresses late project list',!await page.$('.cards')&&new URL(page.url()).pathname==='/account/identities');
  check('no project list runtime errors or security mutations',mutations===0&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  process.exitCode=failures?1:0;
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
