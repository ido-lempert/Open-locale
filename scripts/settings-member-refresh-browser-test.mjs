// Real local browser -> settings read-only member metadata refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_MEMBER_TEST_PG_PORT ?? 56055), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-member-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('member_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/member_refresh_browser`;
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


  const people=[];for(const n of ['first','external','later'])people.push(await call('/auth/signup',{email:n+'@example.com',password:'pass1234',displayName:n+' fixture member'},null));
  const add=async p=>call(P+'/members',{email:p.user.email,role:'MEMBER',allowedLocales:[]},token);await add(people[0]);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=memberEmail]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,holdNext=false,held,holdPatch=false,heldPatch;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}/members`&&holdNext){holdNext=false;held=r;return;}}else{writes++;if(r.method()==='PATCH'&&path.startsWith(`/api${P}/members/`)&&holdPatch){holdPatch=false;heldPatch=r;return;}}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await settle();await page.click(`[name=${name}]`);await settle();};
  const field=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsMembers');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Member metadata read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).memberListRefreshing());await settle();};
  const first=people[0].user.id;
  await field('memberEmail','unsent@example.com');await field('memberLocales',' he ');await field('name','Other draft');await page.select(`[name=role-${first}]`,'ADMIN');await field('member-locales-'+first,' he ');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.error.set('Independent error');c.memberDraftNotice.set('Earlier accepted add');});
  const counts=[reads,writes];await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshMemberList());
  check('explicit metadata refresh reads once and refuses duplicate button and captured handler',reads===counts[0]+1&&writes===counts[1]&&await page.$eval('[name=refreshSettingsMembers]',e=>e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).members().length===2));
  await add(people[1]);await answer(await call(P+'/members',null,token));
  check('real updated list preserves add fields per-row drafts receipt and independent error',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.members().length===3&&c.memberEmail()==='unsent@example.com'&&c.memberLocales()===' he '&&c.memberRolePick()[id]==='ADMIN'&&c.memberLocalesPick()[id]===' he '&&c.memberDraftNotice()==='Earlier accepted add'&&c.name()==='Other draft'&&c.error()==='Independent error'&&c.memberListRefreshNotice().includes('not an effective-access check');},first));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval('[name=refreshSettingsMembers]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-member-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsMembers]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await settle();await page.screenshot({path:`/downloads/settings-member-refresh-${label}-mobile.png`});check(label+' metadata status fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsMemberListRefreshNotice]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 retains previous members all drafts and bounded retry guidance',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.members().length===3&&c.memberRolePick()[id]==='ADMIN'&&c.memberLocalesPick()[id]===' he '&&c.memberEmail()==='unsent@example.com'&&c.error()==='Independent error'&&c.memberListRefreshNotice().includes('could not be refreshed')&&!c.memberListRefreshNotice().includes('PRIVATE');},first));await capture('failure');
  await start();await answer(await call(P+'/members',null,token));check('explicit retry stays read only',writes===counts[1]&&await page.$eval('[name=settingsMemberListRefreshNotice]',e=>e.textContent.includes('was refreshed')));
  // Row role save has its own pending state, not global busy. Verify at real PATCH boundary.
  const beforeRole=await call(P+'/members',null,token);await start();holdPatch=true;await click('role-save-'+first);for(let n=0;n<150&&!heldPatch;n++)await new Promise(r=>setTimeout(r,20));if(!heldPatch)throw new Error('Role PATCH not held');const roleReads=reads;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshMemberList());check('pending real role Save refuses refresh button and direct handler',reads===roleReads&&await page.$eval('[name=refreshSettingsMembers]',e=>e.disabled));await heldPatch.continue();heldPatch=null;await page.waitForFunction(id=>!ng.getComponent(document.querySelector('ol-settings')).memberRolePending()[id],{},first);await answer(beforeRole);
  check('late metadata cannot reverse accepted direct role Save',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.members().find(m=>m.id===id).role==='ADMIN'&&c.memberListRefreshNotice()==='';},first)&&(await call(P+'/members',null,token)).find(m=>m.id===first).role==='ADMIN');
  const external=people[1].user.id;await field('member-locales-'+external,'he');const beforeLocales=await call(P+'/members',null,token);await start();holdPatch=true;await click('member-locales-save-'+external);for(let n=0;n<150&&!heldPatch;n++)await new Promise(r=>setTimeout(r,20));if(!heldPatch)throw new Error('Locales PATCH not held');const localeReads=reads;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshMemberList());check('pending real locale Save refuses refresh button and direct handler',reads===localeReads&&await page.$eval('[name=refreshSettingsMembers]',e=>e.disabled));await heldPatch.continue();heldPatch=null;await page.waitForFunction(id=>!ng.getComponent(document.querySelector('ol-settings')).memberLocalesPending()[id],{},external);await answer(beforeLocales);
  check('late metadata cannot reverse accepted direct locale Save',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.members().find(m=>m.id===id).allowedLocales.join(',')==='he'&&c.memberListRefreshNotice()==='';},external));
  const beforeRemove=await call(P+'/members',null,token);await start();await click('startRemoveMember-'+first);await click('confirmRemoveMember-'+first);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeRemove);check('late metadata cannot resurrect actually removed membership',!(await call(P+'/members',null,token)).some(m=>m.id===first)&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.members().some(m=>m.id===id)&&c.memberListRefreshNotice()==='';},first));
  const beforeAdd=await call(P+'/members',null,token);await start();await field('memberEmail',people[2].user.email);await field('memberLocales','');await page.$eval('[name=addSettingsMember]',e=>e.form.requestSubmit());await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeAdd);check('late metadata cannot erase later explicit Add result',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.members().some(m=>m.id===id)&&c.memberListRefreshNotice()==='';},people[2].user.id));
  for(const p of people)if((await call(P+'/members',null,token)).some(m=>m.id===p.user.id))await call(P+'/members/'+p.user.id,null,token,'DELETE');await start();await answer(await call(P+'/members',null,token));check('owner-only snapshot keeps orphan row drafts local with explicit limits',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.members().length===1&&c.memberLocalesPick()[id]===' he ';},first)&&await page.$eval('#settingsMemberListRefreshScope',e=>e.textContent.includes('no longer listed')));
  await start();await page.evaluate(()=>{window.departedSettings=ng.getComponent(document.querySelector('ol-settings'));});const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'[]'}).catch(()=>{});await settle();check('actual route departure suppresses late refresh feedback',await page.evaluate(()=>window.departedSettings.memberListRefreshNotice()===''&&!window.departedSettings.memberListRefreshing())&&!await page.$('[name=settingsMemberListRefreshNotice]'));
  check('no tokens tasks webhooks or deliveries created',await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0);check('no member metadata runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
