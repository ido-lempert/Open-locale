// Local browser provider-info fixtures with real password-login fallback.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55698, WEB_PORT = 4200, API_PORT = 3000;
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


  let posts=0,starts=0;const reads={oidc:0,saml:0},modes={oidc:'fail',saml:'fail'},held={};await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='POST')posts++;if(path==='/api/auth/oidc/start'||path==='/api/auth/saml/browser/start')starts++;const provider=path==='/api/auth/oidc/info'?'oidc':path==='/api/auth/saml/sp-info'?'saml':null;if(provider){reads[provider]++;if(modes[provider]==='hold'){held[provider]=req;return;}req.respond({status:modes[provider]==='fail'?503:200,contentType:'application/json',body:JSON.stringify(modes[provider]==='fail'?{message:'PRIVATE fixture'}:{configured:true,browserEnabled:true})});}else req.continue();});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=oidcConfigurationRetry]');await page.waitForSelector('[name=samlConfigurationRetry]');check('both failed provider reads expose bounded independent retries while password form stays available',await page.$('[name=password]')!==null&&!await page.evaluate(()=>document.body.innerText.includes('PRIVATE'))&&await page.$eval('button.primary',e=>!e.disabled));await page.screenshot({path:'/downloads/login-configuration-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/login-configuration-mobile.png',fullPage:true});await page.setViewport({width:1280,height:900});
  await page.type('[name=email]','sync-owner@example.com');await page.type('[name=password]','pass1234');
  for(const provider of ['oidc','saml']){
    const other=provider==='oidc'?'saml':'oidc',before=reads[provider],otherBefore=reads[other];modes[provider]='hold';held[provider]=undefined;await page.click(`[name=${provider}ConfigurationRetry]`);for(let n=0;n<100&&!held[provider];n++)await new Promise(r=>setTimeout(r,20));if(!held[provider])throw new Error('provider read not held');await page.evaluate(p=>ng.getComponent(document.querySelector('ol-login')).loadProvider(p),provider);await page.waitForSelector(`[name=${provider}ConfigurationLoading]`);await page.waitForSelector(`[name=${provider}ConfigurationRetry]`,{hidden:true});check(`${provider} pending retry makes one GET without sibling read or sign-in`,reads[provider]===before+1&&reads[other]===otherBefore&&posts===0&&starts===0&&await page.$(`[name=${provider}ConfigurationRetry]`)===null);await held[provider].respond({status:200,contentType:'application/json',body:JSON.stringify({configured:true,browserEnabled:true})});await page.waitForSelector(`[name=${provider==='oidc'?'oidcLogin':'samlLogin'}]`);check(`${provider} successful retry reveals provider and preserves password draft without start`,await page.$eval('[name=password]',e=>e.value==='pass1234')&&await page.$eval('[name=email]',e=>e.value==='sync-owner@example.com')&&posts===0&&starts===0);
  }
  modes.oidc='success';modes.saml='hold';held.saml=undefined;await page.goto(`${WEB}/login`,{waitUntil:'domcontentloaded'});await page.waitForSelector('[name=oidcLogin]');check('held SAML configuration does not delay independent OIDC choice or password login',!!held.saml&&await page.$eval('button.primary',e=>!e.disabled));await page.type('[name=email]','sync-owner@example.com');await page.type('[name=password]','pass1234');await page.click('button.primary');await page.waitForFunction(()=>location.pathname==='/projects');await held.saml.respond({status:200,contentType:'application/json',body:JSON.stringify({browserEnabled:true})}).catch(()=>{});check('password login succeeds while provider-info read remains pending',posts===1&&starts===0&&await page.evaluate(()=>!!localStorage.getItem('ol_token')));check('no provider configuration runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
