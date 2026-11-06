// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55656, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-create-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_create_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_create_browser`;
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
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);await page.goto(`${WEB}/projects`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('[name=projectsLoading]'));
  let held,posts=0,reads=0,failRead=true;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path==='/api/projects'&&req.method()==='POST'){posts++;held=req;return;}if(path==='/api/projects'&&req.method()==='GET'){reads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}req.continue();});
  await page.type('[name=name]','New project');await page.type('[name=slug]','new-project');await page.type('[name=locales]','en, he');await page.click('form.create button');await page.waitForSelector('[name=projectCreating]');await page.$eval('[name=name]',e=>{e.value='Newer project draft';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.$eval('form.create',e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check('held project create suppresses duplicate submit and preserves editable newer draft',posts===1&&await page.$eval('form.create',e=>e.getAttribute('aria-busy')==='true')&&await page.$eval('form.create button',e=>e.disabled));await held.continue();await page.waitForSelector('[name=projectCreateNotice]');await page.waitForSelector('[name=retryProjects]');await page.waitForFunction(()=>!document.querySelector('[name=projectCreating]'));const persisted=await call('/projects',null,token);
  check('confirmed receipt survives failed list read and whole newer form remains',posts===1&&reads===1&&persisted.filter(p=>p.slug==='new-project').length===1&&await page.$eval('[name=projectCreateNotice]',e=>e.textContent==='Project "New project" was created. If the list is unavailable, retry the project list without creating again.')&&await page.$eval('[name=name]',e=>e.value==='Newer project draft')&&await page.$eval('[name=slug]',e=>e.value==='new-project')&&await page.$eval('[name=locales]',e=>e.value==='en, he')&&!(await page.content()).includes('PRIVATE'));
  await page.screenshot({path:'/downloads/projects-create-receipt.png',fullPage:false});failRead=false;await page.click('[name=retryProjects]');await page.waitForFunction(()=>!document.querySelector('[name=projectsLoading]')&&[...document.querySelectorAll('.cards strong')].some(e=>e.textContent==='New project'));
  check('read-only retry reveals original project without duplicate and keeps receipt/form',posts===1&&reads===2&&!!await page.$('[name=projectCreateNotice]')&&await page.$eval('[name=name]',e=>e.value==='Newer project draft'));
  check('no project-create runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
