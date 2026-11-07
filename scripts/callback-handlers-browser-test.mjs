// Local browser callback readiness with held completion socket responses.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55699, WEB_PORT = 4200, API_PORT = 3000;
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


  let requests=0,held;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path==='/api/auth/oidc/complete'||path==='/api/auth/saml/complete'){requests++;held=req;return;}req.continue();});
  for(const provider of ['oidc','saml']){
    await page.goto(`${WEB}/auth/${provider}/callback`,{waitUntil:'networkidle0'});await page.waitForSelector(`ol-${provider}-callback`);await page.waitForFunction(p=>!ng.getComponent(document.querySelector(`ol-${p}-callback`)).busy(),{},provider);
    await page.evaluate(p=>{const c=ng.getComponent(document.querySelector(`ol-${p}-callback`));c.pendingToken='local one-use pending fixture';c.code='  ';c.error.set('');},provider);await page.waitForSelector('[name=ssoCode]');const before=requests;await page.evaluate(p=>ng.getComponent(document.querySelector(`ol-${p}-callback`)).complete(),provider);check(`${provider} blank factor preserves pending token without completion request`,requests===before&&await page.evaluate(p=>ng.getComponent(document.querySelector(`ol-${p}-callback`)).pendingToken==='local one-use pending fixture',provider));
    held=undefined;await page.evaluate(p=>{const c=ng.getComponent(document.querySelector(`ol-${p}-callback`));c.code='123456';window.pendingComplete=c.complete();},provider);for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('completion request not held');await page.waitForFunction(()=>document.querySelector('[name=restartSso]').disabled);await page.evaluate(async p=>{const c=ng.getComponent(document.querySelector(`ol-${p}-callback`));c.restart();await c.complete();},provider);check(`${provider} held valid completion submits once and captured busy restart cannot leave`,requests===before+1&&await page.evaluate(p=>location.pathname===`/auth/${p}/callback`,provider));if(provider==='oidc')await page.screenshot({path:'/downloads/callback-completion-pending.png',fullPage:true});
    await page.evaluate(p=>ng.getComponent(document.querySelector(`ol-${p}-callback`)).ngOnDestroy(),provider);await held.respond({status:200,contentType:'application/json',body:JSON.stringify({accessToken:'late-local-fixture'})});await page.evaluate(()=>window.pendingComplete);const latest=requests;await page.evaluate(async p=>{const c=ng.getComponent(document.querySelector(`ol-${p}-callback`));c.busy.set(false);c.pendingToken='captured';c.code='123456';c.restart();await c.complete();},provider);check(`${provider} late completion and destroyed handlers preserve session and current route`,requests===latest&&await page.evaluate(({p,t})=>location.pathname===`/auth/${p}/callback`&&localStorage.getItem('ol_token')===t,{p:provider,t:token}));
    await page.goto(`${WEB}/auth/${provider}/callback`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('[name=restartSso]').disabled);await page.click('[name=restartSso]');await page.waitForFunction(()=>location.pathname==='/login');check(`${provider} idle Back to sign-in still navigates`,true);
  }
  check('no callback readiness runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
