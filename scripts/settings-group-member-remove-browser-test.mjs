// Real local browser -> guarded group-member removal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_ACCESS_REMOVE_TEST_PG_PORT ?? 55993), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-group-member-remove-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('group_member_remove_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/group_member_remove_browser`;
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


  const member=await call('/auth/signup',{email:'member@example.com',password:'pass1234',displayName:'Direct member'},null);
  const secondMember=await call('/auth/signup',{email:'other@example.com',password:'pass1234',displayName:'Other member'},null);
  for(const email of ['member@example.com','other@example.com'])await call(P+'/members',{email,role:'MEMBER',allowedLocales:['he']},token);
  const first=await call(P+'/groups',{name:'Admin group',role:'ADMIN',allowedLocales:[]},token);
  const other=await call(P+'/groups',{name:'Other group',role:'MEMBER',allowedLocales:['he']},token);
  for(const g of [first,other])for(const u of [member,secondMember])await call(P+'/groups/'+g.id+'/members/'+u.user.id,null,token,'PUT');
  const task=await call(P+'/tasks',{title:'Keep assignment',assigneeGroupId:first.id},token);
  const secondProject=await call('/projects',{name:'Other team project',slug:'second-project',locales:['en','he']},token);
  const secondTask=await call(`/projects/${secondProject.id}/tasks`,{title:'Team-wide assignment',assigneeGroupId:first.id},token);
  await call(`/projects/${secondProject.id}`,{description:'Saved through group grant'},member.accessToken,'PATCH');
  await call(P+'/import/en',{entries:{alpha:'Original'}},token);
  const txBefore=JSON.stringify(await prisma.translation.findMany({orderBy:{rowId:'asc'}}));
  const tasksBefore=JSON.stringify(await prisma.task.findMany({orderBy:{id:'asc'}}));
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=startRemoveGroupMember-${first.id}-${member.user.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let deletes=0,reads=0,writes=0,held,refuse=true,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&!['GET','OPTIONS'].includes(req.method()))writes++;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/groups`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='DELETE'&&path===`/api${P}/groups/${first.id}/members/${member.user.id}`){deletes++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=(groupId,userId)=>page.evaluate(({groupId,userId})=>ng.getComponent(document.querySelector('ol-settings')).removeGroupMember({id:groupId},userId),{groupId,userId});
  const suffix=first.id+'-'+member.user.id;
  await direct(first.id,member.user.id);check('unconfirmed direct group-member removal makes no request',deletes===0&&reads===0);if(failures)throw new Error('Group member confirmation guard absent');
  await click('startRemoveGroupMember-'+other.id+'-'+member.user.id);await direct(first.id,member.user.id);check('wrong group confirmation does not authorize membership removal',deletes===0);await click('cancelRemoveGroupMember-'+other.id+'-'+member.user.id);
  await click('startRemoveGroupMember-'+first.id+'-'+secondMember.user.id);await direct(first.id,member.user.id);check('wrong member confirmation does not authorize removal',deletes===0);await click('cancelRemoveGroupMember-'+first.id+'-'+secondMember.user.id);
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.groupRolePending.set({[id]:true});},first.id);await page.evaluate(({g,u})=>ng.getComponent(document.querySelector('ol-settings')).askRemoveGroupMember(g,u),{g:first.id,u:member.user.id});await direct(first.id,member.user.id);check('pending group edit blocks confirmation and direct membership removal',deletes===0&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).confirmingGroupMember()===null));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).groupRolePending.set({}));await settle();
  await click('startRemoveGroupMember-'+suffix);check('confirmation names member group team-wide scope and unchanged task assignments',await page.$eval(`[name=confirmRemoveGroupMember-${suffix}]`,e=>e.parentElement.textContent.includes('Direct member')&&e.parentElement.textContent.includes('Admin group')&&e.parentElement.textContent.includes('across the team')&&e.parentElement.textContent.includes('not changed')));
  await page.screenshot({path:'/downloads/settings-group-member-remove-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(`[name=confirmRemoveGroupMember-${suffix}]`,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-member-remove-confirm-mobile.png'});await page.setViewport({width:1280,height:900});await click('cancelRemoveGroupMember-'+suffix);await direct(first.id,member.user.id);check('cancel requires new matching group-member confirmation',deletes===0&&!!await page.$(`[name=startRemoveGroupMember-${suffix}]`));
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.groupName.set('Unsent group');c.name.set('Other draft');c.groupNamePick.set({[id]:'Unsent group edit'});},first.id);await settle();await click('startRemoveGroupMember-'+suffix);await click('confirmRemoveGroupMember-'+suffix);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains confirmation saved membership and drafts without reload',deletes===1&&reads===0&&await page.evaluate(({g,u})=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingGroupMember()?.groupId===g&&c.confirmingGroupMember()?.userId===u&&c.error()==='Permission denied'&&!c.groupMemberRemoveNotice();},{g:first.id,u:member.user.id})&&await prisma.groupMember.count({where:{groupId:first.id,userId:member.user.id}})===1);
  refuse=false;failRead=true;await click('confirmRemoveGroupMember-'+suffix);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Membership DELETE not held');await direct(first.id,member.user.id);await page.evaluate(({g,u,other})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.cancelRemoveGroupMember();c.askRemoveGroupMember(other,u);c.askRemoveGroup(g);c.groupRolePick.set({[g]:'MEMBER'});c.groupPick.set({[g]:'missing-user'});c.saveGroupName({id:g,name:'Admin group'});c.setGroupRole({id:g,role:'ADMIN'});c.addGroupMember({id:g});c.discardGroupDrafts(g);},{g:first.id,u:member.user.id,other:other.id});await settle();check('held removal blocks duplicate cancel replacement group delete writes and discard',deletes===2&&writes===2&&await page.$eval(`[name=confirmRemoveGroupMember-${suffix}]`,e=>e.disabled)&&await page.$eval(`[name=cancelRemoveGroupMember-${suffix}]`,e=>e.disabled)&&await page.$eval(`[name=startRemoveGroup-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=group-name-save-${first.id}]`,e=>e.disabled)&&await page.evaluate(({g,u})=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingGroupMember()?.groupId===g&&c.confirmingGroupMember()?.userId===u&&c.groupNamePick()[g]==='Unsent group edit';},{g:first.id,u:member.user.id}));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(first.id,member.user.id);const groups=await call(P+'/groups',null,token);check('accepted membership removal503 updates local and server rows without replay',deletes===2&&reads===1&&groups.length===2&&!groups.find(g=>g.id===first.id).members.some(m=>m.userId===member.user.id)&&await page.evaluate(({g,u})=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.groups().find(row=>row.id===g).members.some(m=>m.userId===u)&&c.confirmingGroupMember()===null&&c.error()==='Refresh failed'&&c.groupName()==='Unsent group'&&c.name()==='Other draft'&&c.groupNamePick()[g]==='Unsent group edit'&&c.groupMemberRemoveNotice().includes('across the team');},{g:first.id,u:member.user.id}));
  check('only selected membership deleted and direct and other-group membership remain',await prisma.groupMember.count({where:{groupId:first.id,userId:member.user.id}})===0&&await prisma.groupMember.count()===3&&(await call(P+'/members',null,token)).some(m=>m.id===member.user.id&&m.role==='MEMBER'));
  const denied=await fetch(`${API}/projects/${secondProject.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+member.accessToken},body:JSON.stringify({description:'Must not save'})});check('removed membership loses team-wide admin grant but retains project visibility',denied.status===403&&(await call(`/projects/${secondProject.id}`,null,member.accessToken)).description==='Saved through group grant');
  check('group task assignments in both projects and all translation bytes stay unchanged',JSON.stringify(await prisma.task.findMany({orderBy:{id:'asc'}}))===tasksBefore&&JSON.stringify(await prisma.translation.findMany({orderBy:{rowId:'asc'}}))===txBefore);
  check('local effective note no longer shows removed group admin grant',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.effectiveRoleOf(c.members().find(m=>m.id===id))==='MEMBER';},member.user.id));
  await page.$eval('[name=settingsGroupMemberRemoveNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-member-remove-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsGroupMemberRemoveNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-group-member-remove-mobile.png'});check('390px membership removal receipt fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewport({width:1280,height:900});failRead=false;reads=0;await click('startRemoveGroupMember-'+other.id+'-'+member.user.id);await click('confirmRemoveGroupMember-'+other.id+'-'+member.user.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('successful groups-only refresh preserves same-group and unrelated drafts',reads===1&&await prisma.groupMember.count()===2&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.groups().length===2&&c.groupName()==='Unsent group'&&c.name()==='Other draft'&&c.groupNamePick()[id]==='Unsent group edit'&&c.groupMemberRemoveNotice().includes('removed');},first.id));
  check('both assigned tasks remain with no webhook delivery queued',await prisma.task.count()===2&&await prisma.webhookDelivery.count()===0);
  check('no group-member removal runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
