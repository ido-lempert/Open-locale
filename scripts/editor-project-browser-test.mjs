// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55595, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-load-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_load_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_load_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);
  let rejectProject=true,rejectBranches=false,held;
  await page.setRequestInterception(true);page.on('request',req=>{
    const path=new URL(req.url()).pathname;
    if(req.method()==='GET'&&path===`/api${P}`&&rejectProject)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_PROVIDER_DETAIL'})});
    if(req.method()==='GET'&&path===`/api${P}/branches`&&rejectBranches)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_BRANCH_DETAIL'})});
    if(req.method()==='GET'&&path===`/api${P}`&&held===true){held=req;return;}
    req.continue();
  });
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=retryProject]');
  check('project failure uses fixed inline retry with no partial editor or raw error',!await page.$('.toolbar')&&!await page.$('.grid')&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  await page.screenshot({path:'/downloads/editor-project-error.png',fullPage:false});
  rejectProject=false;held=true;await page.click('[name=retryProject]');await page.waitForSelector('[name=projectLoading]');
  check('manual retry has loading feedback and hides retry/grid',!await page.$('[name=retryProject]')&&!await page.$('.grid'));
  await page.screenshot({path:'/downloads/editor-project-loading.png',fullPage:false});
  for(let n=0;n<100&&held===true;n++)await new Promise(r=>setTimeout(r,20));if(!held?.continue)throw new Error('retry request not held');const request=held;held=false;await request.continue();await page.waitForSelector('[aria-label="alpha in en"]');
  check('retry loads real project branches and editable keys',await page.$eval('h1',e=>e.textContent)==='Sync browser'&&!!await page.$('[aria-label="Branch"]')&&!(await page.$('[name=projectError]')));await page.screenshot({path:'/downloads/editor-project-ready.png',fullPage:false});
  rejectBranches=true;await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[name=retryProject]');check('branch failure never publishes partial project',!await page.$('.toolbar')&&!await page.$('.grid')&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  rejectBranches=false;await page.click('[name=retryProject]');await page.waitForSelector('[aria-label="alpha in en"]');check('branch retry recovers real grid',!!await page.$('.grid'));
  await page.click('.back');await page.waitForFunction(()=>location.pathname==='/projects');held=true;await page.waitForSelector(`a[href="${P}"]`);await page.click(`a[href="${P}"]`);await page.waitForSelector('[name=projectLoading]');for(let n=0;n<100&&held===true;n++)await new Promise(r=>setTimeout(r,20));if(!held?.continue)throw new Error('navigation request not held');await page.click('.back');await page.waitForFunction(()=>location.pathname==='/projects');const late=held;held=false;await late.continue();await new Promise(r=>setTimeout(r,300));check('late bootstrap after route-away cannot resurrect editor',!await page.$('.grid')&&!await page.$('[name=projectError]')&&new URL(page.url()).pathname==='/projects');
  check('no project-loading runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
