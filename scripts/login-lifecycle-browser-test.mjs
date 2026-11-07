// Local browser socket-level login lifecycle tests with real password login.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55697, WEB_PORT = 4200, API_PORT = 3000;
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


  let posts=0,providerStarts=0,holdLogin=false,held;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname==='/api/auth/oidc/start')providerStarts++;if(req.method()==='POST'&&new URL(req.url()).pathname.startsWith('/api/auth/')){posts++;if(holdLogin&&new URL(req.url()).pathname==='/api/auth/login'){held=req;return;}}req.continue();});
  for(const mode of ['login','signup']){
    await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});const before=posts;const result=await page.evaluate(async mode=>{const c=ng.getComponent(document.querySelector('ol-login'));c.mode.set(mode);c.oidcConfigured.set(true);c.samlConfigured.set(true);c.ngOnDestroy();c.password='captured';await c.submit();await c.startSso();await c.startSaml();return {token:localStorage.getItem('ol_token')};},mode);check(`${mode} destroyed captured handlers create no sign-in socket requests`,posts===before&&providerStarts===0&&result.token===token);
  }
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});const before=posts;await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-login'));c.oidcConfigured.set(false);c.samlConfigured.set(false);await c.startSso();await c.startSaml();});check('unconfigured captured provider handlers send no start requests',posts===before&&providerStarts===0);
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-login'));c.samlConfigured.set(true);window.originalDigest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=()=>new Promise(resolve=>window.releaseDigest=resolve);window.pendingSaml=c.startSaml();});await page.waitForFunction(()=>!!window.releaseDigest);await page.screenshot({path:'/downloads/login-lifecycle-pending.png',fullPage:true});await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-login'));c.ngOnDestroy();window.releaseDigest(new Uint8Array(32).buffer);});await page.evaluate(()=>window.pendingSaml);check('destroy during held crypto prevents real SAML start POST',posts===before);await page.evaluate(()=>crypto.subtle.digest=window.originalDigest);
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});holdLogin=true;await page.type('[name=email]','sync-owner@example.com');await page.type('[name=password]','pass1234');const loginBefore=posts,providerBefore=providerStarts;held=undefined;await page.click('button.primary');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('login not held');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-login'));c.oidcConfigured.set(true);c.samlConfigured.set(true);await c.submit();await c.startSso();await c.startSaml();});await page.waitForFunction(()=>document.querySelector('button.primary').disabled);check('pending real login suppresses duplicate and competing provider requests',posts===loginBefore+1&&providerStarts===providerBefore&&await page.$eval('button.primary',e=>e.disabled));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-login')).ngOnDestroy());await held.continue();await new Promise(r=>setTimeout(r,250));check('late real password-login response cannot replace token or navigate after destroy',await page.evaluate(t=>location.pathname==='/login'&&localStorage.getItem('ol_token')===t,token));
  holdLogin=false;await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.type('[name=email]','sync-owner@example.com');await page.type('[name=password]','pass1234');await page.click('button.primary');await page.waitForFunction(()=>location.pathname==='/projects');check('current valid local password sign-in still navigates with usable session',(await page.evaluate(()=>!!localStorage.getItem('ol_token')))&&posts===loginBefore+2);check('no login lifecycle runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
