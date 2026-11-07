// Local browser socket-level provider-info failure and held-response fixtures.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55695, WEB_PORT = 4200, API_PORT = 3000;
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


  let reads=0,starts=0,mode='fail',release;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='POST'&&path.includes('/link/start'))starts++;if(['/api/auth/oidc/info','/api/auth/saml/sp-info'].includes(path)){reads++;const respond=()=>req.respond({status:mode==='fail'?503:200,contentType:'application/json',body:JSON.stringify(mode==='fail'?{message:'PRIVATE local provider failure'}:{configured:true,browserEnabled:true})});if(mode==='hold')release=respond;else void respond();}else req.continue();});
  for(const provider of ['oidc','saml']){
    mode='fail';await page.goto(`${WEB}/account/link-${provider}`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=retryLinkConfiguration]');check(`${provider} provider failure exposes bounded read retry without start form`,await page.$('[name=linkPassword]')===null&&!await page.evaluate(()=>document.body.innerText.includes('PRIVATE')));
    if(provider==='oidc'){await page.screenshot({path:'/downloads/identity-link-configuration-retry-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/identity-link-configuration-retry-mobile.png',fullPage:true});await page.setViewport({width:1280,height:900});}
    const before=reads;mode='hold';await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-identity-link'));c.password='preserved local draft';window.retryHandler=()=>c.loadConfiguration();});await page.click('[name=retryLinkConfiguration]');await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-identity-link')).loading());await page.evaluate(()=>window.retryHandler());await new Promise(r=>setTimeout(r,100));check(`${provider} held retry is one GET and removes retry while pending`,reads===before+1&&await page.$('[name=retryLinkConfiguration]')===null&&starts===0);mode='success';await release();await page.waitForSelector('[name=linkPassword]');check(`${provider} retry recovers configuration and preserves password without link POST`,await page.$eval('[name=linkPassword]',e=>e.value==='preserved local draft')&&starts===0);
    await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-identity-link'));c.error.set('Local password verification failed');});check(`${provider} start error does not present configuration retry`,await page.$('[name=retryLinkConfiguration]')===null);
    mode='fail';await page.goto(`${WEB}/account/link-${provider}`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=retryLinkConfiguration]');mode='hold';await page.click('[name=retryLinkConfiguration]');await new Promise(r=>setTimeout(r,100));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-identity-link')).ngOnDestroy());mode='success';await release();await new Promise(r=>setTimeout(r,100));const last=reads;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-identity-link')).loadConfiguration());check(`${provider} destroyed component ignores late GET and captured retry`,reads===last&&starts===0&&await page.evaluate(()=>!ng.getComponent(document.querySelector('ol-identity-link')).configured()));
  }
  check('no configuration retry runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
