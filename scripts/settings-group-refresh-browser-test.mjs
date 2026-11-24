// Real local browser -> settings read-only group metadata refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_GROUP_TEST_PG_PORT ?? 56057), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-group-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('group_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/group_refresh_browser`;
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


  const person=await call('/auth/signup',{email:'person@example.com',password:'pass1234',displayName:'Fixture person'});
  await call(P+'/members',{email:person.user.email,role:'MEMBER',allowedLocales:[]},token);
  const initial=await call(P+'/groups',{name:'First fixture group',role:'MEMBER',allowedLocales:[]},token);
  const group=initial.id,user=person.user.id;
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=groupName]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,holdNext=false,held,holdWrite=false,heldWrite;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}/groups`&&holdNext){holdNext=false;held=r;return;}}else{writes++;if(path.startsWith(`/api${P}/groups/`)&&holdWrite){holdWrite=false;heldWrite=r;return;}}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await settle();await page.click(`[name=${name}]`);await settle();};
  const field=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const start=async()=>{held=null;holdNext=true;await click('refreshSettingsGroups');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Group metadata read not held');};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).groupListRefreshing());await settle();};
  await field('groupName','Unsent group');await field('groupLocales',' he ');await field('name','Other draft');await field('group-name-'+group,'Unsent row name');await page.select(`[name=grole-${group}]`,'ADMIN');await field('group-locales-'+group,' he ');await page.select(`[name=gadd-${group}]`,user);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.error.set('Independent error');c.groupDraftNotice.set('Earlier accepted create');});
  const counts=[reads,writes];await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshGroupList());check('explicit group metadata read once and duplicate button/handler refuse',reads===counts[0]+1&&writes===counts[1]&&await page.$eval('[name=refreshSettingsGroups]',e=>e.disabled));
  await call(P+'/groups',{name:'External fixture group',role:'MEMBER',allowedLocales:[]},token);await answer(await call(P+'/groups',null,token));
  check('real updated groups preserve new fields row drafts choice receipt and independent state',await page.evaluate(({group,user})=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.groups().length===2&&c.groupName()==='Unsent group'&&c.groupLocales()===' he '&&c.groupNamePick()[group]==='Unsent row name'&&c.groupRolePick()[group]==='ADMIN'&&c.groupLocalesPick()[group]===' he '&&c.groupPick()[group]===user&&c.groupDraftNotice()==='Earlier accepted create'&&c.error()==='Independent error'&&c.name()==='Other draft'&&c.groupListRefreshNotice().includes('not an effective-access check');},{group,user}));
  const capture=async label=>{await page.setViewport({width:1280,height:900});await page.$eval('[name=refreshSettingsGroups]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:`/downloads/settings-group-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsGroups]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await settle();await page.screenshot({path:`/downloads/settings-group-refresh-${label}-mobile.png`});check(label+' group metadata status fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsGroupListRefreshNotice]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});};await capture('success');
  await start();await answer({message:'PRIVATE RAW ERROR'},503);check('503 keeps previous list all drafts and bounded retry',await page.evaluate(group=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.groups().length===2&&c.groupNamePick()[group]==='Unsent row name'&&c.groupRolePick()[group]==='ADMIN'&&c.groupLocalesPick()[group]===' he '&&c.groupName()==='Unsent group'&&c.error()==='Independent error'&&c.groupListRefreshNotice().includes('could not be refreshed')&&!c.groupListRefreshNotice().includes('PRIVATE');},group));await capture('failure');
  await start();await answer(await call(P+'/groups',null,token));check('explicit retry remains read-only',writes===counts[1]&&await page.$eval('[name=settingsGroupListRefreshNotice]',e=>e.textContent.includes('was refreshed')));
  // Each independently pending group write uses a real held request and native Save/Add click.
  for(const kind of ['name','locales','member','role']){
    const before=await call(P+'/groups',null,token);await start();holdWrite=true;
    const control=kind==='name'?'group-name-save-':kind==='locales'?'group-locales-save-':kind==='member'?'gadd-submit-':'grole-save-';await click(control+group);
    for(let n=0;n<150&&!heldWrite;n++)await new Promise(r=>setTimeout(r,20));if(!heldWrite)throw new Error(kind+' write not held');const pendingReads=reads;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshGroupList());check('pending real '+kind+' write refuses refresh button and captured handler',reads===pendingReads&&await page.$eval('[name=refreshSettingsGroups]',e=>e.disabled));await heldWrite.continue();heldWrite=null;
    await page.waitForFunction(({kind,group})=>{const c=ng.getComponent(document.querySelector('ol-settings'));const map=kind==='name'?c.groupNamePending():kind==='locales'?c.groupLocalesPending():kind==='member'?c.groupMemberPending():c.groupRolePending();return !map[group];},{},{kind,group});await answer(before);
    const saved=(await call(P+'/groups',null,token)).find(g=>g.id===group);check('late metadata cannot reverse actual '+kind+' save',await page.evaluate(({kind,group,user,saved})=>{const c=ng.getComponent(document.querySelector('ol-settings')),g=c.groups().find(g=>g.id===group);return c.groupListRefreshNotice()===''&&(kind==='name'?g.name===saved.name&&g.name==='Unsent row name':kind==='locales'?g.allowedLocales.join(',')==='he':kind==='member'?g.members.some(m=>m.userId===user):g.role==='ADMIN');},{kind,group,user,saved}));
  }
  const beforeRemove=await call(P+'/groups',null,token);await start();await click('startRemoveGroupMember-'+group+'-'+user);await click('confirmRemoveGroupMember-'+group+'-'+user);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeRemove);check('late metadata cannot restore actually removed group member',!(await call(P+'/groups',null,token)).find(g=>g.id===group).members.some(m=>m.userId===user)&&await page.evaluate(group=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.groups().find(g=>g.id===group).members.length===0&&c.groupListRefreshNotice()==='';},group));
  const beforeCreate=await call(P+'/groups',null,token);await start();await field('groupName','Later created group');await field('groupLocales','');await click('addSettingsGroup');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeCreate);check('late metadata cannot erase actually created group',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.groups().some(g=>g.name==='Later created group')&&c.groupListRefreshNotice()==='';}));
  await field('group-name-'+group,'Orphan local name');const beforeDelete=await call(P+'/groups',null,token);await start();await click('startRemoveGroup-'+group);await click('confirmRemoveGroup-'+group);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeDelete);check('late metadata cannot resurrect actually deleted group',!(await call(P+'/groups',null,token)).some(g=>g.id===group)&&await page.evaluate(group=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.groups().some(g=>g.id===group)&&c.groupListRefreshNotice()==='';},group));
  for(const g of await call(P+'/groups',null,token))await call(P+'/groups/'+g.id,null,token,'DELETE');await start();await answer(await call(P+'/groups',null,token));check('empty snapshot keeps orphan drafts local with explicit scope limits',await page.evaluate(group=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.groups().length===0&&c.groupNamePick()[group]==='Orphan local name';},group)&&await page.$eval('#settingsGroupListRefreshScope',e=>e.textContent.includes('no longer listed')&&e.textContent.includes('reload direct team members')));
  await start();await page.evaluate(()=>window.departedSettings=ng.getComponent(document.querySelector('ol-settings')));const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'[]'}).catch(()=>{});await settle();check('actual departure suppresses late group metadata feedback',await page.evaluate(()=>window.departedSettings.groupListRefreshNotice()===''&&!window.departedSettings.groupListRefreshing())&&!await page.$('[name=settingsGroupListRefreshNotice]'));
  check('no tokens tasks webhooks deliveries created and direct membership preserved',await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&(await call(P+'/members',null,token)).some(m=>m.id===user));check('no group metadata runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
