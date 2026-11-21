// Real local browser -> guarded team-member removal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56126, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
let completed=false;process.on('exit',()=>{if(!completed)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-member-remove-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('member_remove_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/member_remove_browser`;
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


  const member=await call('/auth/signup',{email:'member@example.com',password:'pass1234',displayName:'Direct member'},null);
  const other=await call('/auth/signup',{email:'other@example.com',password:'pass1234',displayName:'Other member'},null);
  for(const email of ['member@example.com','other@example.com'])await call(P+'/members',{email,role:'MEMBER',allowedLocales:['he']},token);
  const group=await call(P+'/groups',{name:'Saved admin grant',role:'ADMIN',allowedLocales:[]},token);
  await call(P+'/groups/'+group.id+'/members/'+member.user.id,null,token,'PUT');
  await call(P+'/tasks',{title:'Direct assignment remains',assigneeId:member.user.id},token);
  const secondProject=await call('/projects',{name:'Other team project',slug:'second-project',locales:['en','he']},token);
  await call(`/projects/${secondProject.id}/tasks`,{title:'Group assignment remains',assigneeGroupId:group.id},token);
  await call(`/projects/${secondProject.id}`,{description:'Saved through group grant'},member.accessToken,'PATCH');
  await call(P+'/import/en',{entries:{alpha:'Original'}},token);
  const txBefore=JSON.stringify(await prisma.translation.findMany({orderBy:{rowId:'asc'}})),tasksBefore=JSON.stringify(await prisma.task.findMany({orderBy:{id:'asc'}})),groupsBefore=JSON.stringify(await prisma.groupMember.findMany({orderBy:{userId:'asc'}}));
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=startRemoveMember-${member.user.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let deletes=0,reads=0,writes=0,held,refuse=true,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&!['GET','OPTIONS'].includes(req.method()))writes++;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/members`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='DELETE'&&path===`/api${P}/members/${member.user.id}`){deletes++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=id=>page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).removeMember({id}),id);
  await direct(member.user.id);check('unconfirmed direct team-member removal makes no request',deletes===0&&reads===0);if(failures)throw new Error('Member confirmation guard absent');
  await click('startRemoveMember-'+other.user.id);await direct(member.user.id);check('wrong member confirmation does not authorize removal',deletes===0);await click('cancelRemoveMember-'+other.user.id);
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.confirmingMember.set(id);},owner.user.id);await direct(owner.user.id);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).cancelRemoveMember());check('owner and self target cannot be removed',deletes===0&&!await page.$(`[name=startRemoveMember-${owner.user.id}]`));
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.memberRolePending.set({[id]:true});c.askRemoveMember(id);},member.user.id);await direct(member.user.id);check('pending member role blocks start and submission',deletes===0&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).confirmingMember()===null));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).memberRolePending.set({}));await settle();
  await click('startRemoveMember-'+member.user.id);check('confirmation names member email team-wide scope and saved-grant reactivation',await page.$eval(`[name=confirmRemoveMember-${member.user.id}]`,e=>e.parentElement.textContent.includes('member@example.com')&&e.parentElement.textContent.includes('every project')&&e.parentElement.textContent.includes('reactivate')));
  const originalMembers=await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).members());const locales=['he','<img>'+ 'X'.repeat(300),'fr','he'];
  await page.evaluate(({id,locales})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.members.set(c.members().map(m=>m.id===id?{...m,allowedLocales:locales}:m));c.memberLocalesPick.set({[id]:'fr'});c.memberRolePick.set({[id]:'ADMIN'});c.memberEmail.set('Unsent@example.com');c.memberRemoveNotice.set('Earlier receipt');c.error.set('Independent');},{id:member.user.id,locales});await settle();
  check('exact loaded user ID and direct role ignore unsaved role edits',await page.$eval('[name=settingsMemberRemoveId]',e=>e.textContent)===member.user.id&&await page.$eval('[name=settingsMemberRemoveRole]',e=>e.textContent)==='MEMBER');
  check('ordered full direct locales preserve raw duplicates without unsaved replacement',JSON.stringify(await page.$$eval('[name=settingsMemberRemoveLocales] li',es=>es.map(e=>e.textContent)))===JSON.stringify(locales)&&await page.$eval('[name=settingsMemberRemoveDetails]',e=>!e.querySelector('img,a')));
  check('local review keeps drafts receipts errors and sends no requests',reads===0&&deletes===0&&writes===0&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.memberLocalesPick()[id]==='fr'&&c.memberRolePick()[id]==='ADMIN'&&c.memberEmail()==='Unsent@example.com'&&c.memberRemoveNotice()==='Earlier receipt'&&c.error()==='Independent';},member.user.id));
  check('explicit local not effective access permission group or assignment completeness promise',await page.$eval('[name=settingsMemberRemoveDetails]',e=>e.textContent.includes('not unsaved role or locale edits')&&e.textContent.includes('not a read of newer server values')&&e.textContent.includes('current permission or effective access')&&e.textContent.includes('complete group-membership or task-assignment scan')&&e.textContent.includes('Saved group memberships remain')&&e.textContent.includes('not ADMIN or OWNER grants')));
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.members.set(c.members().map(m=>m.id===id?{...m,allowedLocales:[],role:'ADMIN'}:m));},member.user.id);await settle();check('loaded empty locale restriction and ADMIN role displayed without all-effective-access claim',!!await page.$('[name=settingsMemberRemoveAllLocales]')&&!await page.$('[name=settingsMemberRemoveLocales]')&&await page.$eval('[name=settingsMemberRemoveRole]',e=>e.textContent)==='ADMIN'&&reads===0&&writes===0);
  await page.evaluate(({id,locales})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.members.set(c.members().map(m=>m.id===id?{...m,allowedLocales:locales,role:'MEMBER'}:m));},{id:member.user.id,locales});await settle();
  await page.$eval('[name=settingsMemberRemoveDetails]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-member-remove-details-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(`[name=confirmRemoveMember-${member.user.id}]`,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-member-remove-details-confirm-mobile.png'});check('390px loaded direct grant confirmation fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.$eval('[name=settingsMemberRemoveDetails]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-member-remove-details-confirm-mobile-top.png'});await page.setViewport({width:1280,height:900});await page.evaluate(rows=>ng.getComponent(document.querySelector('ol-settings')).members.set(rows),originalMembers);await settle();await click('cancelRemoveMember-'+member.user.id);await direct(member.user.id);check('cancel requires new matching team-member confirmation',deletes===0);
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.memberEmail.set('Unsent@example.com');c.name.set('Other draft');c.memberRolePick.set({[id]:'ADMIN'});},other.user.id);await settle();await click('startRemoveMember-'+member.user.id);await click('confirmRemoveMember-'+member.user.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains saved member confirmation and drafts without reload',deletes===1&&reads===0&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingMember()===id&&c.error()==='Permission denied'&&!c.memberRemoveNotice();},member.user.id)&&(await call(P+'/members',null,token)).some(m=>m.id===member.user.id));
  refuse=false;failRead=true;await click('confirmRemoveMember-'+member.user.id);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Team-member DELETE not held');await direct(member.user.id);await page.evaluate(({id,other})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.cancelRemoveMember();c.askRemoveMember(other);c.memberRolePick.set({...c.memberRolePick(),[id]:'ADMIN'});c.memberLocalesPick.set({[id]:'he'});c.setMemberRole({id,role:'MEMBER'});c.saveMemberLocales({id,role:'MEMBER',allowedLocales:[]});c.discardMemberDrafts(id);},{id:member.user.id,other:other.user.id});await settle();check('held removal blocks duplicate cancel replacement same-member writes and discard',deletes===2&&writes===2&&await page.$eval(`[name=confirmRemoveMember-${member.user.id}]`,e=>e.disabled)&&await page.$eval(`[name=cancelRemoveMember-${member.user.id}]`,e=>e.disabled)&&await page.$eval(`[name=startRemoveMember-${other.user.id}]`,e=>e.disabled)&&await page.$eval(`[name=role-save-${member.user.id}]`,e=>e.disabled)&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).memberRolePick()[id]==='ADMIN',member.user.id));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(member.user.id);check('accepted member removal503 updates local and server list without replay',deletes===2&&reads===1&&!(await call(P+'/members',null,token)).some(m=>m.id===member.user.id)&&await page.evaluate(({id,other})=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.members().some(m=>m.id===id)&&c.confirmingMember()===null&&c.error()==='Refresh failed'&&c.memberEmail()==='Unsent@example.com'&&c.name()==='Other draft'&&c.memberRolePick()[other]==='ADMIN'&&c.memberRemoveNotice().includes('saved group');},{id:member.user.id,other:other.user.id}));
  const authGet=async projectId=>(await fetch(`${API}/projects/${projectId}`,{headers:{Authorization:'Bearer '+member.accessToken}})).status;
  check('removed direct membership cuts access in both projects despite saved admin group',await authGet(project.id)===404&&await authGet(secondProject.id)===404);
  check('saved group membership assignments translations and account are unchanged',JSON.stringify(await prisma.groupMember.findMany({orderBy:{userId:'asc'}}))===groupsBefore&&JSON.stringify(await prisma.task.findMany({orderBy:{id:'asc'}}))===tasksBefore&&JSON.stringify(await prisma.translation.findMany({orderBy:{rowId:'asc'}}))===txBefore&&await prisma.user.count({where:{id:member.user.id}})===1);
  await call(P+'/members',{email:'member@example.com',role:'MEMBER',allowedLocales:['he']},token);await call(`/projects/${secondProject.id}`,{description:'Reactivated by saved group'},member.accessToken,'PATCH');check('explicit disposable re-add reactivates saved group admin grant',await authGet(secondProject.id)===200&&(await call(`/projects/${secondProject.id}`,null,token)).description==='Reactivated by saved group');await call(P+'/members/'+member.user.id,null,token,'DELETE');
  await page.$eval('[name=settingsMemberRemoveNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-member-remove-details-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsMemberRemoveNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-member-remove-details-mobile.png'});check('390px accepted team-member removal receipt fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewport({width:1280,height:900});failRead=false;reads=0;await click('startRemoveMember-'+other.user.id);await click('confirmRemoveMember-'+other.user.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('successful members-only refresh preserves other drafts',reads===1&&(await call(P+'/members',null,token)).length===1&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.members().length===1&&c.memberEmail()==='Unsent@example.com'&&c.name()==='Other draft'&&c.memberRemoveNotice().includes('removed');}));
  check('no extra tasks or webhook deliveries',await prisma.task.count()===2&&await prisma.webhookDelivery.count()===0);check('no team-member removal runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
completed=failures===0;process.exit(failures?1:0);
