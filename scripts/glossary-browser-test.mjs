// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55539, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-glossary-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('glossary_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/glossary_browser`;
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

  await call(`${P}/glossary`,{term:'Actual glossary term',notes:'Current note'},token);
  await page.setViewport({width:480,height:900});await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('.glossary-table tbody code');
  check('actual glossary read renders persisted term',await page.$eval('.glossary-table tbody',e=>e.textContent.includes('Actual glossary term')));
  await page.type('[name=gTerm]','Unsaved glossary draft');let reads=0;await page.setRequestInterception(true);const failRead=req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/glossary`){reads++;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-glossary-detail'})});}return req.continue();};page.on('request',failRead);
  // Existing create action triggers the real list refetch after successful POST.
  await page.click('.task-form button[type=submit]');await page.waitForSelector('[name=retryGlossaryList]');
  check('failed real glossary list refetch clears stale rows without empty-success/raw details',reads===1&&!(await page.$('.glossary-table tbody code'))&&!(await page.$('[name=glossaryListEmpty]'))&&!(await page.content()).includes('private-glossary-detail'));
  page.off('request',failRead);let held=false,release;const gate=new Promise(r=>release=r);const holdRead=async req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api${P}/glossary`){reads++;held=true;await gate;}return req.continue();};page.on('request',holdRead);await page.type('[name=gTerm]','Keep retry draft');await page.click('[name=retryGlossaryList]');await page.waitForSelector('[name=glossaryListLoading]');if(!held)throw new Error('retry not held');
  check('held glossary retry announces loading rather than empty-success',!(await page.$('[name=glossaryListEmpty]'))&&!(await page.$('[name=retryGlossaryList]'))&&await page.$eval('main',e=>e.getAttribute('aria-busy')==='true'));
  release();await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false'&&document.querySelectorAll('.glossary-table tbody code').length===2);
  check('actual glossary retry restores persisted terms and retains new draft',reads===2&&await page.$eval('.glossary-table tbody',e=>e.textContent.includes('Actual glossary term')&&e.textContent.includes('Unsaved glossary draft'))&&await page.$eval('[name=gTerm]',e=>e.value==='Keep retry draft')&&!(await page.$('[name=glossaryListError]')));
  check('glossary recovery has no runtime errors and fits narrow viewport',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d))&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  page.off('request',holdRead);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/glossary-list-recovered-full.png',fullPage:true});console.log(failures?'GLOSSARY BROWSER CHECKS FAILED':'ALL GLOSSARY BROWSER CHECKS PASSED');process.exitCode=failures?1:0;
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
