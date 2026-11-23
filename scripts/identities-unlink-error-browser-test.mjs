// Real local browser -> Linked identity bounded unlink feedback -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.IDENTITY_ERROR_TEST_PG_PORT ?? 56268), WEB_PORT = 4200, API_PORT = 3000;
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


  const identity=await prisma.externalIdentity.create({data:{userId:owner.user.id,issuer:'fixture:unlink-errors',subject:'local-subject',email:'metadata@example.test'}});
  let reads=0,deletes=0,mode='actual';const privateText='PRIVATE <img src=x onerror=fail> '+ 'X'.repeat(600);
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path==='/api/auth/identities'&&req.method()==='GET')reads++;if(path===`/api/auth/identities/${identity.id}`&&req.method()==='DELETE'){deletes++;if(mode==='private')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:privateText})});if(mode==='malformed')return req.respond({status:200,contentType:'application/json',body:JSON.stringify({unlinked:false,signInRequired:false})});if(mode==='transport')return req.abort('failed');}req.continue();});
  await page.goto(`${WEB}/account/identities`,{waitUntil:'networkidle0'});await page.waitForSelector('.provider-email');
  const confirm=async password=>{if(!await page.$('[name=unlinkPassword]')){await page.$eval('[name=chooseUnlink]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=chooseUnlink]');await page.waitForSelector('[name=unlinkPassword]');}await page.$eval('[name=unlinkPassword]',e=>e.value='');await page.type('[name=unlinkPassword]',password);await page.$eval('[name=confirmUnlink]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=confirmUnlink]');};
  const settle=async count=>{for(let i=0;i<100&&deletes<count;i++)await new Promise(r=>setTimeout(r,20));if(deletes!==count)throw new Error('Expected unlink request count '+count+' got '+deletes);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-identities')).busy());};
  const message='Unlink result could not be confirmed. Sign in again before trying another unlink. Your password was cleared.';
  await confirm('wrong-local-password');await page.waitForSelector('.unlink-confirm [role=alert]');
  check('actual wrong password leaves binding/session intact and shows cautious fixed recovery',await page.$eval('.unlink-confirm [role=alert]',(e,m)=>e.textContent.trim()===m,message)&&!!await prisma.externalIdentity.findUnique({where:{id:identity.id}})&&(await fetch(`${API}/auth/identities`,{headers:{Authorization:`Bearer ${token}`}})).status===200&&deletes===1);
  check('wrong-password response clears typed password without signing out or removing current row',await page.$eval('[name=unlinkPassword]',e=>e.value==='')&&await page.evaluate(t=>localStorage.getItem('ol_token')===t,token)&&await page.$$eval('.provider-email',es=>es.length===1));
  mode='private';await confirm('pass1234');await settle(2);
  check('private API error cannot leak as text or markup and is not reported as confirmed failure',await page.$eval('.unlink-confirm [role=alert]',(e,m)=>e.textContent.trim()===m,message)&&!(await page.content()).includes('PRIVATE')&&!await page.$('main img')&&deletes===2);
  await page.setViewport({width:1280,height:900});await page.screenshot({path:'/downloads/identity-unlink-error-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.$eval('.unlink-confirm [role=alert]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/identity-unlink-error-mobile.png'});check('390px bounded recovery fits without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  mode='malformed';await confirm('pass1234');await settle(3);
  check('malformed success acknowledgement remains uncertain and retains local session',await page.$eval('.unlink-confirm [role=alert]',(e,m)=>e.textContent.trim()===m,message)&&await page.evaluate(t=>localStorage.getItem('ol_token')===t,token)&&deletes===3);
  mode='transport';await confirm('pass1234');await settle(4);
  check('transport failure gets same fixed recovery with cleared password and no automatic retry',await page.$eval('.unlink-confirm [role=alert]',(e,m)=>e.textContent.trim()===m,message)&&await page.$eval('[name=unlinkPassword]',e=>e.value==='')&&deletes===4);
  await new Promise(r=>setTimeout(r,200));check('fault cases never replay unlink or delete actual binding',deletes===4&&!!await prisma.externalIdentity.findUnique({where:{id:identity.id}}));
  mode='actual';await page.$eval('[name=refreshIdentities]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=refreshIdentities]');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-identities')).loading()&&!document.querySelector('[name=unlinkPassword]')&&document.querySelectorAll('.provider-email').length===1);
  check('explicit read clears error and choice without extra delete',reads===2&&deletes===4&&!await page.$('[name=unlinkPassword]')&&!await page.$('.unlink-confirm [role=alert]'));
  await confirm('pass1234');await page.waitForFunction(()=>location.pathname==='/login');
  check('actual valid unlink still removes exact binding and signs out',deletes===5&&!await prisma.externalIdentity.findUnique({where:{id:identity.id}})&&await page.evaluate(()=>localStorage.getItem('ol_token')===null));
  check('no identity runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|InvalidPipeArgument|NG02100/.test(d)));completed=true;process.exitCode=failures?1:0;
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
