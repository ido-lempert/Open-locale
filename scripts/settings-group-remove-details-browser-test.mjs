// Real local browser -> guarded team-group removal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56128, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
let completed=false;process.on('exit',()=>{if(!completed)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-group-remove-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('group_remove_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/group_remove_browser`;
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
  await call(P+'/members',{email:'member@example.com',role:'MEMBER',allowedLocales:['he']},token);
  const first=await call(P+'/groups',{name:'First group',role:'ADMIN',allowedLocales:[]},token);
  const other=await call(P+'/groups',{name:'Other group',role:'MEMBER',allowedLocales:['he']},token);
  await call(P+'/groups/'+first.id+'/members/'+member.user.id,null,token,'PUT');
  await call(P+'/groups/'+other.id+'/members/'+member.user.id,null,token,'PUT');
  const task=await call(P+'/tasks',{title:'Keep this task',assigneeGroupId:first.id},token);
  const secondProject=await call('/projects',{name:'Other team project',slug:'second-project',locales:['en','he']},token);
  const secondTask=await call(`/projects/${secondProject.id}/tasks`,{title:'Team-wide assignment',assigneeGroupId:first.id},token);
  await call(`/projects/${secondProject.id}`,{description:'Saved through group grant'},member.accessToken,'PATCH');
  const otherTask=await call(P+'/tasks',{title:'Keep other assignment',assigneeGroupId:other.id},token);
  await call(P+'/import/en',{entries:{alpha:'Original'}},token);
  const txBefore=JSON.stringify(await prisma.translation.findMany({orderBy:{rowId:'asc'}}));
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=startRemoveGroup-${first.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let deletes=0,reads=0,writes=0,held,refuse=true,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&!['GET','OPTIONS'].includes(req.method()))writes++;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/groups`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='DELETE'&&path===`/api${P}/groups/${first.id}`){deletes++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=id=>page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).removeGroup({id}),id);
  await direct(first.id);check('unconfirmed direct group removal makes no request',deletes===0&&reads===0);if(failures)throw new Error('Group confirmation guard absent');
  await click('startRemoveGroup-'+other.id);await direct(first.id);check('wrong target confirmation does not authorize group deletion',deletes===0);await click('cancelRemoveGroup-'+other.id);
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.groupNamePending.set({[id]:true});c.askRemoveGroup(id);},first.id);await direct(first.id);check('pending group edit blocks confirmation and direct deletion',deletes===0&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).confirmingGroup()===null));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).groupNamePending.set({}));await settle();
  await click('startRemoveGroup-'+first.id);check('confirmation names team-wide grant and task unassignment accurately',await page.$eval(`[name=confirmRemoveGroup-${first.id}]`,e=>e.parentElement.textContent.includes('across the team')&&e.parentElement.textContent.includes('become unassigned')));
  const originalGroups=await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).groups());const locales=['he','<img>'+ 'X'.repeat(300),'fr','he'];
  await page.evaluate(({id,locales})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.groups.set(c.groups().map(g=>g.id===id?{...g,allowedLocales:locales,role:'MEMBER'}:g));c.groupLocalesPick.set({[id]:'fr'});c.groupRolePick.set({[id]:'ADMIN'});c.groupNamePick.set({[id]:'Unsaved name'});c.groupName.set('Unsent group');c.groupRemoveNotice.set('Earlier receipt');c.error.set('Independent');},{id:first.id,locales});await settle();
  check('exact loaded group ID and role ignore unsaved role name edits',await page.$eval('[name=settingsGroupRemoveId]',e=>e.textContent)===first.id&&await page.$eval('[name=settingsGroupRemoveRole]',e=>e.textContent)==='MEMBER');
  check('ordered full group locales preserve raw duplicates without unsaved replacement',JSON.stringify(await page.$$eval('[name=settingsGroupRemoveLocales] li',es=>es.map(e=>e.textContent)))===JSON.stringify(locales)&&await page.$eval('[name=settingsGroupRemoveDetails]',e=>!e.querySelector('img,a')));
  check('local review keeps drafts receipts errors and sends no requests',reads===0&&deletes===0&&writes===0&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.groupLocalesPick()[id]==='fr'&&c.groupRolePick()[id]==='ADMIN'&&c.groupNamePick()[id]==='Unsaved name'&&c.groupName()==='Unsent group'&&c.groupRemoveNotice()==='Earlier receipt'&&c.error()==='Independent';},first.id));
  check('explicit local not effective access permission membership or task scan promise',await page.$eval('[name=settingsGroupRemoveDetails]',e=>e.textContent.includes('not unsaved name, role or locale edits')&&e.textContent.includes('not a read of newer server values')&&e.textContent.includes('current permission or effective access')&&e.textContent.includes('complete membership or task-assignment scan')&&e.textContent.includes('not other groups')&&e.textContent.includes('not ADMIN grants')));
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.groups.set(c.groups().map(g=>g.id===id?{...g,allowedLocales:[],role:'ADMIN'}:g));},first.id);await settle();check('loaded empty group locale scope and ADMIN role do not claim effective access',!!await page.$('[name=settingsGroupRemoveAllLocales]')&&!await page.$('[name=settingsGroupRemoveLocales]')&&await page.$eval('[name=settingsGroupRemoveRole]',e=>e.textContent)==='ADMIN'&&reads===0&&writes===0);
  await page.evaluate(({id,locales})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.groups.set(c.groups().map(g=>g.id===id?{...g,allowedLocales:locales,role:'MEMBER'}:g));},{id:first.id,locales});await settle();
  await page.$eval('[name=settingsGroupRemoveDetails]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-group-remove-details-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(`[name=confirmRemoveGroup-${first.id}]`,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-remove-details-confirm-mobile.png'});check('390px loaded group grant confirmation fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.$eval('[name=settingsGroupRemoveDetails]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-group-remove-details-confirm-mobile-top.png'});await page.setViewport({width:1280,height:900});await page.evaluate(rows=>ng.getComponent(document.querySelector('ol-settings')).groups.set(rows),originalGroups);await settle();await click('cancelRemoveGroup-'+first.id);await direct(first.id);check('cancel requires new matching group confirmation',deletes===0&&!!await page.$(`[name=startRemoveGroup-${first.id}]`));
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.groupName.set('Unsent group');c.name.set('Other draft');c.groupNamePick.set({[id]:'Unsent other edit'});},other.id);await settle();await click('startRemoveGroup-'+first.id);await click('confirmRemoveGroup-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains confirmation saved group and drafts without reload',deletes===1&&reads===0&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingGroup()===id&&c.error()==='Permission denied'&&!c.groupRemoveNotice();},first.id)&&(await call(P+'/groups',null,token)).length===2);
  refuse=false;failRead=true;await click('confirmRemoveGroup-'+first.id);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Group DELETE not held');await direct(first.id);await page.evaluate(({first,other})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.cancelRemoveGroup();c.askRemoveGroup(other);c.groupNamePick.set({...c.groupNamePick(),[first]:'Blocked edit'});c.groupRolePick.set({[first]:'MEMBER'});c.groupLocalesPick.set({[first]:'he'});c.groupPick.set({[first]:'missing-user'});c.saveGroupName({id:first,name:'First group'});c.setGroupRole({id:first,role:'ADMIN'});c.saveGroupLocales({id:first,role:'MEMBER',allowedLocales:[]});c.addGroupMember({id:first});c.removeGroupMember({id:first},'missing-user');c.discardGroupDrafts(first);},{first:first.id,other:other.id});await settle();check('held deletion blocks duplicate cancel replacement same-group writes and discard',deletes===2&&writes===2&&await page.$eval(`[name=confirmRemoveGroup-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=cancelRemoveGroup-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=startRemoveGroup-${other.id}]`,e=>e.disabled)&&await page.$eval(`[name=group-name-save-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=gadd-submit-${first.id}]`,e=>e.disabled)&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingGroup()===id&&c.groupNamePick()[id]==='Blocked edit';},first.id));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(first.id);await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).askRemoveGroup(id),first.id);const groups=await call(P+'/groups',null,token);check('accepted deletion503 removes group locally and server-side without retry',deletes===2&&groups.length===1&&groups[0].id===other.id&&!await page.$(`[name=startRemoveGroup-${first.id}]`)&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.groups().length===1&&c.groups()[0].id===id&&c.confirmingGroup()===null&&c.error()==='Refresh failed'&&c.groupName()==='Unsent group'&&c.name()==='Other draft'&&c.groupNamePick()[id]==='Unsent other edit'&&c.groupRemoveNotice().includes('across the team');},other.id));
  check('deleted group membership cascades but direct and other-group membership remain',await prisma.groupMember.count({where:{groupId:first.id}})===0&&await prisma.groupMember.count({where:{groupId:other.id,userId:member.user.id}})===1&&(await call(P+'/members',null,token)).some(m=>m.id===member.user.id&&m.role==='MEMBER'));
  const savedTask=await prisma.task.findUnique({where:{id:task.id}}),savedOther=await prisma.task.findUnique({where:{id:otherTask.id}});check('group task becomes unassigned while other assignment and both tasks remain',savedTask?.assigneeGroupId===null&&savedTask?.title==='Keep this task'&&savedOther?.assigneeGroupId===other.id&&await prisma.task.count()===3);
  const crossTask=await prisma.task.findUnique({where:{id:secondTask.id}});const denied=await fetch(`${API}/projects/${secondProject.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+member.accessToken},body:JSON.stringify({description:'Must not save'})});check('deletion removes team-wide admin grant and unassigns another project task',crossTask?.assigneeGroupId===null&&denied.status===403&&(await call(`/projects/${secondProject.id}`,null,token)).description==='Saved through group grant');
  const memberProject=await call(P,null,member.accessToken);check('direct team member retains project visibility after losing group admin grant',!!memberProject.id&&(await call(P+'/groups',null,member.accessToken)).length===1);
  check('translations remain byte-for-byte unchanged',JSON.stringify(await prisma.translation.findMany({orderBy:{rowId:'asc'}}))===txBefore);
  await page.$eval('[name=settingsGroupRemoveNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-remove-details-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsGroupRemoveNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-group-remove-details-mobile.png'});check('390px group deletion receipt fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewport({width:1280,height:900});failRead=false;reads=0;await click('startRemoveGroup-'+other.id);await click('confirmRemoveGroup-'+other.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('successful groups-only refresh preserves unrelated drafts',reads===1&&(await call(P+'/groups',null,token)).length===0&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.groups().length===0&&c.groupName()==='Unsent group'&&c.name()==='Other draft'&&c.groupRemoveNotice().includes('deleted');}));
  check('existing tasks still remain and no webhook delivery is queued',await prisma.task.count()===3&&await prisma.webhookDelivery.count()===0);
  check('no group deletion runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
