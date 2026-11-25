// Real local browser -> guarded embed-origin removal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_PROJECT_GUARD_TEST_PG_PORT ?? 55989), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-origin-remove-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('origin_remove_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/origin_remove_browser`;
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


  const first='https://first.example',other='https://other.example';
  await call(P,{embedOrigins:[first,other]},token,'PATCH');
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=startRemoveOrigin-0]');await page.waitForNetworkIdle({idleTime:200});
  let patches=0,reads=0,held,refuse=true,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='PATCH'&&path===`/api${P}`){patches++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=origin=>page.evaluate(origin=>ng.getComponent(document.querySelector('ol-settings')).removeOrigin(origin),origin);
  await direct(first);check('unconfirmed direct removal sends nothing',patches===0&&reads===0);if(failures)throw new Error('Origin confirmation guard absent');
  await click('startRemoveOrigin-1');await direct(first);check('mismatched confirmation cannot remove another origin',patches===0);await click('cancelRemoveOrigin-1');
  await click('startRemoveOrigin-0');await page.screenshot({path:'/downloads/settings-origin-remove-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=confirmRemoveOrigin-0]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-origin-remove-confirm-mobile.png'});check('390px confirmation fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});await click('cancelRemoveOrigin-0');await direct(first);check('cancel requires new explicit confirmation',patches===0&&!!await page.$('[name=startRemoveOrigin-0]'));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newOrigin.set('https://draft.example');c.name.set('Other project draft');c.newRuleTitle.set('Next rule');});await settle();await click('startRemoveOrigin-0');await click('confirmRemoveOrigin-0');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains origins confirmation and drafts without reload',patches===1&&reads===0&&await page.evaluate(first=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().embedOrigins.length===2&&c.confirmingOrigin()===first&&c.error()==='Permission denied'&&c.newOrigin()==='https://draft.example'&&!c.originRemoveNotice();},first)&&(await call(P,null,token)).embedOrigins.length===2);
  refuse=false;failRead=true;await click('confirmRemoveOrigin-0');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Origin PATCH not held');await direct(first);await page.evaluate(other=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.cancelRemoveOrigin();c.askRemoveOrigin(other);c.addOrigin();},other);await settle();check('held update blocks duplicate cancel other confirmation and add origin',patches===2&&await page.$eval('[name=confirmRemoveOrigin-0]',e=>e.disabled)&&await page.$eval('[name=cancelRemoveOrigin-0]',e=>e.disabled)&&await page.$eval('[name=startRemoveOrigin-1]',e=>e.disabled)&&await page.$eval('[name=addSettingsOrigin]',e=>e.disabled)&&await page.evaluate(first=>ng.getComponent(document.querySelector('ol-settings')).confirmingOrigin()===first,first));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(first);await page.evaluate(first=>ng.getComponent(document.querySelector('ol-settings')).askRemoveOrigin(first),first);const saved=await call(P,null,token);check('accepted503 saves remaining allowlist locally and on server without stale retry',patches===2&&JSON.stringify(saved.embedOrigins)===JSON.stringify([other])&&await page.evaluate(other=>{const c=ng.getComponent(document.querySelector('ol-settings'));return JSON.stringify(c.project().embedOrigins)===JSON.stringify([other])&&c.confirmingOrigin()===null&&c.error()==='Refresh failed'&&c.originRemoveNotice().includes('allowlist was saved')&&c.newOrigin()==='https://draft.example'&&c.name()==='Other project draft'&&c.newRuleTitle()==='Next rule';},other));
  const csp=(await fetch(`http://127.0.0.1:${API_PORT}/embed/projects/${project.id}`)).headers.get('content-security-policy')??'';check('fresh embed CSP excludes removed origin and retains other',!csp.includes(first)&&csp.includes(other));
  check('actual database contains accepted remaining allowlist',JSON.stringify((await prisma.project.findUnique({where:{id:project.id}})).embedOrigins)===JSON.stringify([other]));
  await page.$eval('[name=settingsOriginRemoveNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-origin-remove-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsOriginRemoveNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-origin-remove-mobile.png'});check('390px accepted receipt fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  held=null;await click('startRemoveOrigin-0');await click('confirmRemoveOrigin-0');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Final origin PATCH not held');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('final origin removal saves empty allowlist and accurate local state',(await call(P,null,token)).embedOrigins.length===0&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().embedOrigins.length===0&&c.confirmingOrigin()===null&&c.originRemoveNotice().includes('allowlist was saved')&&c.error()==='Refresh failed';}));
  await call(P,{embedOrigins:[first]},token,'PATCH');await page.evaluate(first=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.project.update(p=>({...p,embedOrigins:[first]}));c.name.set('Still unsent');c.newOrigin.set('https://newer.example');},first);await settle();failRead=false;held=null;const previousReads=reads;await click('startRemoveOrigin-0');await click('confirmRemoveOrigin-0');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Success-refresh PATCH not held');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('successful project-only refresh preserves independent drafts and receipt',reads===previousReads+1&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.project().embedOrigins.length===0&&c.newOrigin()==='https://newer.example'&&c.name()==='Still unsent'&&c.newRuleTitle()==='Next rule'&&c.originRemoveNotice().includes('allowlist was saved')&&c.error()==='';}));
  check('no tasks translations or webhook deliveries',await prisma.task.count()===0&&await prisma.translation.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no origin removal runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
