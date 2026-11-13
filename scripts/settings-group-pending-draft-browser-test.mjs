// Real local browser -> settings pending group draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55953, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-locale-create-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('locale_create_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/locale_create_browser`;
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


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=name]');await page.waitForNetworkIdle({idleTime:200});
  let creates=0,reads=0,held,failCreate=false,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='POST'&&path===`/api${P}/groups`){creates++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async(name,value)=>page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Group create request not held');};
  await replace('groupName',' First ');await replace('groupLocales',' he ');await page.$eval('[name=addSettingsGroup]',e=>e.form.requestSubmit());await poll();await replace('groupName',' <b>Newer group</b> ');await replace('groupLocales',' en ');await page.select('[name=groupRole]','ADMIN');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addGroup());check('pending duplicate blocked and outgoing name role locales retain submitted snapshot',creates===1&&payloads[0].name==='First'&&payloads[0].role==='MEMBER'&&JSON.stringify(payloads[0].allowedLocales)==='["he"]');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('successful POST keeps entire newer literal group draft and explicit uncreated notice',await page.$eval('[name=groupName]',e=>e.value===' <b>Newer group</b> '&&!e.parentElement.querySelector('b'))&&await page.$eval('[name=groupLocales]',e=>e.value===' en ')&&await page.$eval('[name=groupRole]',e=>e.value==='ADMIN')&&await page.$eval('[name=settingsGroupDraftNotice]',e=>e.textContent.includes('submitted group was created')&&e.textContent.includes('has not been created')));if(failures)throw new Error('Group draft preservation absent or mismatched');
  let groups=await call(P+'/groups',null,token);check('only submitted group persists with original grant and no members',groups.length===1&&groups[0].name==='First'&&groups[0].role==='MEMBER'&&JSON.stringify(groups[0].allowedLocales)==='["he"]'&&groups[0].members.length===0&&reads>0);
  await page.$eval('[name=settingsGroupDraftNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-pending-draft-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=groupName]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-group-pending-draft-mobile.png'});check('390px newer group draft and notice fit without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsGroupDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  held=null;await page.$eval('[name=addSettingsGroup]',e=>e.form.requestSubmit());await poll();check('newer grant draft sent only on second explicit Add and receipt clears',creates===2&&payloads[1].name==='<b>Newer group</b>'&&payloads[1].role==='ADMIN'&&JSON.stringify(payloads[1].allowedLocales)==='["en"]'&&!await page.$('[name=settingsGroupDraftNotice]'));await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('unchanged second success clears name/locales but keeps role',await page.$eval('[name=groupName]',e=>e.value==='')&&await page.$eval('[name=groupLocales]',e=>e.value==='')&&await page.$eval('[name=groupRole]',e=>e.value==='ADMIN')&&!await page.$('[name=settingsGroupDraftNotice]'));
  const before=reads;failCreate=true;await replace('groupName','Refused');await replace('groupLocales','he');await page.$eval('[name=addSettingsGroup]',e=>e.form.requestSubmit());await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('POST refusal retains draft without created claim or reload',await page.$eval('[name=groupName]',e=>e.value==='Refused')&&await page.$eval('[name=groupLocales]',e=>e.value==='he')&&!await page.$('[name=settingsGroupDraftNotice]')&&reads===before);
  failCreate=false;failRead=true;held=null;await replace('groupName','Created before read failure');await page.$eval('[name=addSettingsGroup]',e=>e.form.requestSubmit());await poll();await replace('groupName','Retained next group');await replace('groupLocales','en');await held.continue();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed'&&!ng.getComponent(document.querySelector('ol-settings')).busy());check('reload failure after created POST keeps entire newer draft and accurate receipt',await page.$eval('[name=groupName]',e=>e.value==='Retained next group')&&await page.$eval('[name=groupLocales]',e=>e.value==='en')&&await page.$eval('[name=settingsGroupDraftNotice]',e=>e.textContent.includes('submitted group was created')&&e.textContent.includes('has not been created')));groups=await call(P+'/groups',null,token);check('reload failure does not undo successful earlier group or add members',groups.length===3&&groups.some(g=>g.name==='Created before read failure'&&g.role==='ADMIN'&&JSON.stringify(g.allowedLocales)==='["he"]')&&groups.every(g=>g.members.length===0));
  check('no pending group draft runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
process.exit(failures?1:0);
