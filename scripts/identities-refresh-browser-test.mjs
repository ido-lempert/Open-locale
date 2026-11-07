// Local browser -> linked identity refresh -> real API/Postgres fixtures.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55696, WEB_PORT = 4200, API_PORT = 3000;
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


  const identity=await prisma.externalIdentity.create({data:{userId:owner.user.id,issuer:'fixture:identities-refresh',subject:'local-only',email:'metadata@example.test'}});
  let reads=0,deletes=0,held,mode='continue';await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname==='/api/auth/identities'&&req.method()==='GET'){reads++;if(mode==='hold'){held=req;return;}if(mode==='fail'){req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE fixture detail'})});return;}}if(u.pathname.startsWith('/api/auth/identities/')&&req.method()==='DELETE')deletes++;req.continue();});
  await page.goto(`${WEB}/account/identities`,{waitUntil:'networkidle0'});await page.waitForSelector('.provider-email');await page.click('[name=chooseUnlink]');await page.waitForSelector('[name=unlinkPassword]');await page.type('[name=unlinkPassword]','local draft');
  const added=await prisma.externalIdentity.create({data:{userId:owner.user.id,issuer:'fixture:identities-refresh/second-issuer-with-a-long-literal-to-check-wrapping',subject:'local-second',email:'second-metadata@example.test'}});
  const before=reads;mode='hold';await page.click('[name=refreshIdentities]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('refresh GET not held');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-identities')).load());check('explicit refresh clears confirmation/password/stale rows while held and blocks duplicate GET',reads===before+1&&await page.$eval('[name=refreshIdentities]',e=>e.disabled)&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-identities'));return c.password===''&&c.selected()===''&&c.identities().length===0;}));await held.continue();await page.waitForFunction(()=>document.querySelectorAll('.provider-email').length===2);check('refresh shows newly linked fixture without unlink request',deletes===0&&await page.$eval('main',e=>e.textContent.includes('second-metadata@example.test')&&e.textContent.includes('clears any unlink confirmation and password')));
  await page.screenshot({path:'/downloads/identities-refresh-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/identities-refresh-mobile.png',fullPage:true});await page.setViewport({width:1280,height:900});
  mode='fail';await page.click('[name=refreshIdentities]');await page.waitForSelector('[role=alert]');check('failed refresh clears stale identities and shows bounded recovery',await page.$('.provider-email')===null&&!await page.evaluate(()=>document.body.innerText.includes('PRIVATE'))&&await page.$eval('[name=refreshIdentities]',e=>!e.disabled));
  await prisma.externalIdentity.deleteMany({where:{id:{in:[identity.id,added.id]}}});mode='continue';await page.click('[name=refreshIdentities]');await page.waitForFunction(()=>document.querySelector('main').textContent.includes('No single sign-on identities'));check('same explicit refresh recovers successful empty result',await page.$('[role=alert]')===null&&await page.$eval('[name=refreshIdentities]',e=>!e.disabled)&&deletes===0);
  await prisma.externalIdentity.create({data:{userId:owner.user.id,issuer:'fixture:refresh-from-empty',subject:'last',email:'last@example.test'}});await page.click('[name=refreshIdentities]');await page.waitForSelector('.provider-email');check('empty-state refresh reads new identity and remains read-only',deletes===0&&await page.$eval('.provider-email',e=>e.textContent==='last@example.test'));
  const latest=reads;await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-identities'));c.busy.set(true);await c.load();});check('busy unlink state disables refresh and captured refresh cannot read',reads===latest&&await page.$eval('[name=refreshIdentities]',e=>e.disabled));check('no refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
