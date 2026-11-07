// Real local browser -> QA findings download -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55694, WEB_PORT = 4200, API_PORT = 3000;
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


  let requests=0,starts=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){requests++;if(req.method()==='POST')starts++;}req.continue();});
  for(const provider of ['oidc','saml']){
    await page.goto(`${WEB}/account/link-${provider}`,{waitUntil:'networkidle0'});await page.waitForSelector('ol-identity-link');const before=requests;const result=await page.evaluate(async provider=>{const c=ng.getComponent(document.querySelector('ol-identity-link'));c.ngOnDestroy();c.loading.set(false);c.configured.set(true);c.password='captured local test';const key=provider==='saml'?'ol.saml.verifier':'ol.oidc.state';sessionStorage.setItem(key,'untouched');await c.start();return {state:sessionStorage.getItem(key),busy:c.busy()};},provider);check(`${provider} destroyed captured start leaves storage and socket requests untouched`,requests===before&&starts===0&&result.state==='untouched'&&!result.busy);
  }
  await page.goto(`${WEB}/account/link-saml`,{waitUntil:'networkidle0'});await page.waitForSelector('ol-identity-link');const before=requests;await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-identity-link'));c.loading.set(false);c.configured.set(true);c.password='local-test';window.originalDigest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=()=>new Promise(resolve=>window.releaseDigest=resolve);window.pendingStart=c.start();});
  await page.waitForFunction(()=>!!window.releaseDigest);await page.screenshot({path:'/downloads/identity-link-pending-local.png',fullPage:true});
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-identity-link'));c.ngOnDestroy();window.releaseDigest(new Uint8Array(32).buffer);});await page.evaluate(()=>window.pendingStart);await new Promise(r=>setTimeout(r,100));check('destroy during held browser crypto prevents real SAML POST and verifier storage',requests===before&&starts===0&&await page.evaluate(()=>!sessionStorage.getItem('ol.saml.verifier')));await page.evaluate(()=>{crypto.subtle.digest=window.originalDigest;});
  await page.goto(`${WEB}/account/link-oidc`,{waitUntil:'networkidle0'});await page.waitForSelector('ol-identity-link');const current=requests;await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-identity-link'));c.loading.set(true);c.configured.set(true);c.password='local test';await c.start();});check('captured configured flag cannot bypass pending configuration into POST',requests===current&&starts===0);check('no linking lifecycle runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
