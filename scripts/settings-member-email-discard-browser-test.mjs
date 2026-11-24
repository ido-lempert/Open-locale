// Real local browser -> add-member email-only draft discard -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_MEMBER_TEST_PG_PORT ?? 55983), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-member-email-discard-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('member_email_discard_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/member_email_discard_browser`;
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


  // Disposable local users and memberships only, no external mail or invitations.
  for(const id of ['first','saved'])await call('/auth/signup',{email:id+'@example.com',password:'pass1234',displayName:id});
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=memberEmail]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/members`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(path.startsWith('/api/')&&['POST','PATCH','PUT','DELETE'].includes(req.method())){writes++;if(req.method()==='POST'&&path===`/api${P}/members`){held=req;return;}}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const replace=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const select=async(name,value)=>{await page.select(`[name=${name}]`,value);await settle();};
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Membership POST not held');};
  const done=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  check('empty member email discard disabled',await page.$eval('[name=discardSettingsMemberEmail]',e=>e.disabled));
  await select('memberRole','ADMIN');await replace('memberLocales',' en ');await replace('memberEmail','not an email');await replace('name','Other project draft');await click('discardSettingsMemberEmail');check('invalid email cleared locally while role locales and other form stay',writes===0&&reads===0&&await page.$eval('[name=memberEmail]',e=>e.value==='')&&await page.$eval('[name=name]',e=>e.value==='Other project draft')&&await page.$eval('[name=memberRole]',e=>e.value==='ADMIN')&&await page.$eval('[name=memberLocales]',e=>e.value===' en '));if(failures)throw new Error('Member email discard absent');
  await select('memberRole','MEMBER');await replace('memberLocales',' he ');await replace('memberEmail','first@example.com');await click('addSettingsMember');await poll();await replace('memberEmail','next@example.com');await replace('memberLocales',' en ');await select('memberRole','ADMIN');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).discardMemberEmailDraft());check('pending add blocks button and direct discard preserving newer email',writes===1&&await page.$eval('[name=discardSettingsMemberEmail]',e=>e.disabled)&&await page.$eval('[name=memberEmail]',e=>e.value==='next@example.com'));await held.continue();await done();
  const beforeReads=reads,beforeWrites=writes;await click('discardSettingsMemberEmail');let members=await call(P+'/members',null,token);check('discard keeps actual membership grant without requests or stale retained claim',members.length===2&&members.some(m=>m.email==='first@example.com'&&m.role==='MEMBER'&&JSON.stringify(m.allowedLocales)==='["he"]')&&!members.some(m=>m.email==='next@example.com')&&reads===beforeReads&&writes===beforeWrites&&await page.$eval('[name=memberEmail]',e=>e.value==='')&&await page.$eval('[name=settingsMemberDraftNotice]',e=>e.textContent.includes('email draft was discarded')&&!e.textContent.includes('kept here'))&&await page.$eval('[name=memberRole]',e=>e.value==='ADMIN')&&await page.$eval('[name=memberLocales]',e=>e.value===' en '));
  held=null;failRead=true;await select('memberRole','MEMBER');await replace('memberLocales','he');await replace('memberEmail','saved@example.com');await click('addSettingsMember');await poll();await replace('memberEmail','unsent@example.com');await select('memberRole','ADMIN');await replace('memberLocales',' en ');await held.continue();await done();const failedReads=reads,failedWrites=writes;await click('discardSettingsMemberEmail');members=await call(P+'/members',null,token);check('503 discard preserves accepted membership error role locales without requests',members.length===3&&members.some(m=>m.email==='saved@example.com'&&m.role==='MEMBER'&&JSON.stringify(m.allowedLocales)==='["he"]')&&!members.some(m=>m.email==='unsent@example.com')&&reads===failedReads&&writes===failedWrites&&await page.$eval('[name=memberEmail]',e=>e.value==='')&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.error()==='Refresh failed'&&c.memberRole()==='ADMIN'&&c.memberLocales()===' en ';})&&await page.$eval('[name=settingsMemberDraftNotice]',e=>e.textContent.includes('email draft was discarded')));
  failRead=false;held=null;await replace('memberEmail','first@example.com');await replace('memberLocales','en');await select('memberRole','MEMBER');await click('addSettingsMember');await poll();await replace('memberEmail','upsert-unsent@example.com');await held.continue();await done();const upReads=reads,upWrites=writes;await click('discardSettingsMemberEmail');members=await call(P+'/members',null,token);check('upsert receipt remains saved not created after email discard',members.length===3&&members.some(m=>m.email==='first@example.com'&&JSON.stringify(m.allowedLocales)==='["en"]')&&reads===upReads&&writes===upWrites&&await page.$eval('[name=settingsMemberDraftNotice]',e=>e.textContent.includes('membership was saved')&&!e.textContent.includes('was created')));
  await replace('memberEmail','new-unsent@example.com');await page.$eval('[name=discardSettingsMemberEmail]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-member-email-discard-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=discardSettingsMemberEmail]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-member-email-discard-mobile.png'});check('390px email discard and receipt fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsMemberDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  check('no tasks translations or deliveries created',await prisma.task.count()===0&&await prisma.translation.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no email discard runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
