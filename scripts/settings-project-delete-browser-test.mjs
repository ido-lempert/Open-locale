// Real local browser -> add-member email-only draft discard -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_PROJECT_GUARD_TEST_PG_PORT ?? 55984), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-delete-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_delete_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_delete_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=startDeleteProject]');await page.waitForNetworkIdle({idleTime:200});
  let deletes=0,reads=0,held,refuse=true;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET')reads++;if(req.method()==='DELETE'&&path===`/api${P}`){deletes++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=()=>page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).remove());
  await direct();check('unconfirmed direct delete makes no request',deletes===0&&reads===0&&!!await page.$('[name=startDeleteProject]'));if(failures)throw new Error('Delete confirmation guard absent');
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).busy.set(true));await settle();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).askDeleteProject());check('other busy work blocks start button and direct confirmation',await page.$eval('[name=startDeleteProject]',e=>e.disabled)&&!await page.$('[name=confirmDeleteProject]'));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).busy.set(false));await settle();
  await click('startDeleteProject');await click('cancelDeleteProject');await direct();check('cancel requires a new explicit confirmation without delete',deletes===0&&!!await page.$('[name=startDeleteProject]'));
  await page.$eval('[name=name]',e=>{e.value='Unsent project draft';e.dispatchEvent(new Event('input',{bubbles:true}));});await settle();await click('startDeleteProject');await click('confirmDeleteProject');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains project confirmation and unsent draft without navigation',deletes===1&&reads===0&&new URL(page.url()).pathname===`${P}/settings`&&await page.$eval('[name=name]',e=>e.value==='Unsent project draft')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied')&&!!await page.$('[name=confirmDeleteProject]')&&(await call('/projects',null,token)).some(p=>p.id===project.id));
  refuse=false;await click('confirmDeleteProject');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('DELETE not held');await direct();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).cancelDeleteProject());await settle();check('held DELETE blocks duplicate direct call and cancel with confirmation intact',deletes===2&&await page.$eval('[name=confirmDeleteProject]',e=>e.disabled)&&await page.$eval('[name=cancelDeleteProject]',e=>e.disabled)&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirming()&&c.busy()&&c.error()==='';}));
  await page.$eval('[name=confirmDeleteProject]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-project-delete-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=confirmDeleteProject]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-150));await page.screenshot({path:'/downloads/settings-project-delete-mobile.png'});check('390px destructive confirmation fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));window.savedDeleteNavigate=c.router.navigate.bind(c.router);c.router.navigate=()=>Promise.reject(new Error('Navigation failed'));});
  await held.continue();await page.waitForSelector('[name=projectDeletedNotice]');await direct();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).askDeleteProject());check('accepted DELETE navigation failure shows fixed saved result and blocks retries',deletes===2&&!(await call('/projects',null,token)).some(p=>p.id===project.id)&&await prisma.project.count({where:{id:project.id}})===0&&!await page.$('[name=confirmDeleteProject]')&&!await page.$('[name=startDeleteProject]')&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.projectDeletionAccepted()&&!c.confirming()&&!c.busy()&&c.error()==='Navigation failed';}));
  await page.$eval('[name=projectDeletedNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-project-delete-fallback-mobile.png'});await page.evaluate(()=>{ng.getComponent(document.querySelector('ol-settings')).router.navigate=window.savedDeleteNavigate;});await page.click('[name=projectDeletedNotice] a');await page.waitForFunction(()=>location.pathname==='/projects');check('explicit return link recovers navigation without second delete',deletes===2);
  const second=await call('/projects',{name:'Second disposable',slug:'second-disposable',locales:['en']},token);await page.goto(`${WEB}/projects/${second.id}/settings`,{waitUntil:'networkidle0'});await click('startDeleteProject');await click('confirmDeleteProject');await page.waitForFunction(()=>location.pathname==='/projects');check('normal accepted delete navigates automatically and removes second project',await prisma.project.count({where:{id:second.id}})===0);

  check('no tasks translations or deliveries created',await prisma.task.count()===0&&await prisma.translation.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no project delete runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??String(e)}`);process.exitCode=1;}
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
