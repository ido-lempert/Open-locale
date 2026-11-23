// Real local browser -> Identity link bounded start feedback -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.IDENTITY_LINK_ERROR_TEST_PG_PORT ?? 56272), WEB_PORT = 4200, API_PORT = 3000;
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



  let starts=0,reads=0,mode='private';const privateText='PRIVATE <img src=x onerror=fail> '+ 'X'.repeat(600);
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(['/api/auth/oidc/info','/api/auth/saml/sp-info'].includes(path)){reads++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({configured:true,browserEnabled:true})});}if(path.endsWith('/start-link')&&req.method()==='POST'){starts++;if(mode==='transport')return req.abort('failed');return req.respond({status:mode==='private'?503:200,contentType:'application/json',body:JSON.stringify(mode==='private'?{message:privateText}:mode==='protocol'?{url:'javascript:alert(1)'}:{})});}req.continue();});
  const message='Could not complete the identity-provider handoff. Your password was cleared. Check linked identities before starting again.';
  for(const provider of ['oidc','saml']){
    const key=provider==='saml'?'ol.saml.verifier':'ol.oidc.state';
    await page.goto(`${WEB}/account/link-${provider}`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=linkPassword]');
    for(const fault of ['private','malformed','protocol','transport']){
      mode=fault;const before=starts;await page.evaluate(k=>sessionStorage.setItem(k,'old-fixture'),key);await page.type('[name=linkPassword]','local fixture');await page.click('[type=submit]');
      for(let i=0;i<100&&starts===before;i++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-identity-link')).busy());
      check(`${provider} ${fault} fault shows fixed handoff feedback without raw content`,starts===before+1&&await page.$eval('[role=alert]',(e,m)=>e.textContent.trim()===m,message)&&!(await page.content()).includes('PRIVATE')&&!await page.$('main img'));
      check(`${provider} ${fault} fault clears password and same-tab state without configuration retry`,await page.$eval('[name=linkPassword]',e=>e.value==='')&&await page.evaluate(k=>sessionStorage.getItem(k)===null,key)&&!await page.$('[name=retryLinkConfiguration]')&&await page.evaluate(()=>location.pathname.startsWith('/account/link-')));
    }
    await new Promise(r=>setTimeout(r,150));check(`${provider} no automatic replay or fixture linking occurred`,starts===(provider==='oidc'?4:8)&&(await prisma.externalIdentity.count({where:{userId:owner.user.id}}))===0);
    if(provider==='oidc'){await page.screenshot({path:'/downloads/identity-link-error-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/identity-link-error-mobile.png',fullPage:true});check('390px handoff feedback and controls fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});}
  }
  check('both provider configuration reads remain independent and local session intact',reads===2&&await page.evaluate(t=>localStorage.getItem('ol_token')===t,token));
  check('no linking runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;
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
