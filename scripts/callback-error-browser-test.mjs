// Real local browser -> Bounded callback redemption feedback -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.CALLBACK_ERROR_TEST_PG_PORT ?? 56274), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-snapshot-ready-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('snapshot_ready_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/snapshot_ready_browser`;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);




  let redemptions=0,mode='private';const privateText='PRIVATE <img src=x onerror=fail> '+ 'X'.repeat(600);
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path==='/api/auth/oidc/callback'||path==='/api/auth/saml/browser/redeem'){redemptions++;if(mode==='transport')return req.abort('failed');return req.respond({status:mode==='private'?503:200,contentType:'application/json',body:JSON.stringify(mode==='private'?{message:privateText}:mode==='factor'?{requiresTwoFactor:true,pendingToken:'one-use-local'}:{})});}req.continue();});
  const message='Could not finish single sign-on. Return to sign-in to start again. If you were linking an identity, check linked identities after signing in; this error does not undo a validated link.';
  for(const provider of ['oidc','saml']){
    const key=provider==='saml'?'ol.saml.verifier':'ol.oidc.state';
    const visit=async fault=>{mode=fault;await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(k=>sessionStorage.setItem(k,'local-state'),key);await page.goto(`${WEB}/auth/${provider}/callback${provider==='oidc'?'?code=local-code&state=local-state':'#code=local-code'}`,{waitUntil:'networkidle0'});await page.waitForSelector(`ol-${provider}-callback`);await page.waitForFunction(p=>!ng.getComponent(document.querySelector(`ol-${p}-callback`)).busy(),{},provider);};
    for(const fault of ['private','malformed','transport']){
      const before=redemptions;await visit(fault);
      check(`${provider} ${fault} redemption fault shows bounded restart/link guidance`,redemptions===before+1&&await page.$eval('[role=alert]',(e,m)=>e.textContent.trim()===m,message)&&!(await page.content()).includes('PRIVATE')&&!await page.$('main img'));
      check(`${provider} ${fault} clears callback URL and same-tab state without installing session`,await page.evaluate(({k,t})=>!location.search&&!location.hash&&sessionStorage.getItem(k)===null&&localStorage.getItem('ol_token')===t,{k:key,t:token})&&!await page.$('[name=ssoCode]')&&await page.$eval('[name=restartSso]',e=>!e.disabled));
      await new Promise(r=>setTimeout(r,100));check(`${provider} ${fault} no automatic redemption replay`,redemptions===before+1);
    }
    if(provider==='oidc'){await page.screenshot({path:'/downloads/callback-error-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/callback-error-mobile.png',fullPage:true});check('390px callback guidance fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});}
    const before=redemptions;await page.click('[name=restartSso]');await page.waitForFunction(()=>location.pathname==='/login');check(`${provider} explicit restart returns to login without replay`,redemptions===before);
    await visit('factor');check(`${provider} successful factor handoff still offers one-use completion form`,!!await page.$('[name=ssoCode]')&&!await page.$('[role=alert]')&&await page.evaluate(t=>localStorage.getItem('ol_token')===t,token));
  }
  check('no callback runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(!completed||failures?1:0);
