// Real local browser -> explicit group member Add -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55961, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-group-member-explicit-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('group_member_explicit');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/group_member_explicit`;
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


  const people=[];
  for(const [i,name] of ['First member','Next member','Refused member','Saved member','Unsent member'].entries()){
    const u=await call('/auth/signup',{email:`member${i}@example.com`,password:'pass1234',displayName:name});people.push(u.user);
    await call(P+'/members',{email:u.user.email,allowedLocales:['he']},token);
  }
  const group=await call(P+'/groups',{name:'Reviewers',role:'MEMBER',allowedLocales:['en']},token);
  const group2=await call(P+'/groups',{name:'Other group',role:'MEMBER',allowedLocales:['he']},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=gadd-${group.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let puts=0,reads=0,held,failPut=false,failRead=false;const paths=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='PUT'&&path.startsWith(`/api${P}/groups/`)){puts++;paths.push(path);if(failPut)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const select=(g,u)=>page.select(`[name=gadd-${g.id}]`,u);
  const add=g=>page.click(`[name=gadd-submit-${g.id}]`);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Member PUT not held');};
  const done=g=>page.waitForFunction(id=>!ng.getComponent(document.querySelector('ol-settings')).groupMemberPending()[id],{},g.id);
  const ids=async g=>(await call(P+'/groups',null,token)).find(x=>x.id===g.id).members.map(x=>x.userId);
  check('empty selection keeps Add disabled and direct call sends no request',await page.$eval(`[name=gadd-submit-${group.id}]`,e=>e.disabled));await page.evaluate(g=>ng.getComponent(document.querySelector('ol-settings')).addGroupMember(g),group);check('empty direct call stays local',puts===0&&reads===0);
  await select(group,people[0].id);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));check('selecting member does not grant access or refresh',puts===0&&reads===0&&(await ids(group)).length===0&&await page.$eval(`[name=gadd-${group.id}]`,e=>e.value===ng.getComponent(document.querySelector('ol-settings')).groupPick()[e.name.slice(5)]));if(failures)throw new Error('Explicit membership control absent');
  await add(group);await poll();await select(group,people[1].id);await page.evaluate(g=>ng.getComponent(document.querySelector('ol-settings')).addGroupMember(g),group);check('explicit Add sends original member once and pending blocks duplicate',puts===1&&paths[0].endsWith('/members/'+people[0].id)&&await page.$eval(`[name=gadd-submit-${group.id}]`,e=>e.disabled));await held.continue();await done(group);check('only submitted demo member added and newer selection stays unsubmitted with receipt',JSON.stringify(await ids(group))===JSON.stringify([people[0].id])&&await page.$eval(`[name=gadd-${group.id}]`,(e,id)=>e.value===id,people[1].id)&&await page.$eval(`[name=gadd-notice-${group.id}]`,e=>e.textContent.includes('submitted member was added')&&e.textContent.includes('has not been added by this request')));if(failures)throw new Error('Newer selection lost or auto-submitted');
  await page.$eval(`[name=gadd-${group.id}]`,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-member-explicit-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(`[name=gadd-${group.id}]`,e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-group-member-explicit-mobile.png'});check('390px explicit Add help and receipt fit without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval(`[name=gadd-notice-${group.id}]`,e=>e.getBoundingClientRect().right<=innerWidth));
  held=null;await add(group);await poll();await page.waitForFunction(id=>!document.querySelector(`[name=gadd-notice-${id}]`),{},group.id);check('newer member waits for second explicit Add and receipt clears',puts===2&&paths[1].endsWith('/members/'+people[1].id)&&!await page.$(`[name=gadd-notice-${group.id}]`));await held.continue();await done(group);check('unchanged success clears selection with both actual memberships',(await ids(group)).length===2&&await page.$eval(`[name=gadd-${group.id}]`,e=>e.value==='')&&await page.$eval(`[name=gadd-submit-${group.id}]`,e=>e.disabled));
  const before=reads;failPut=true;await select(group,people[2].id);await add(group);await done(group);await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('refused PUT retains choice no success claim or refresh or membership',reads===before&&!await page.$(`[name=gadd-notice-${group.id}]`)&&await page.$eval(`[name=gadd-${group.id}]`,(e,id)=>e.value===id,people[2].id)&&!(await ids(group)).includes(people[2].id));
  failPut=false;failRead=true;held=null;await select(group,people[3].id);await add(group);await poll();await select(group,people[4].id);await held.continue();await done(group);check('refresh failure keeps actual saved membership accurate receipt and newer unsent choice',(await ids(group)).includes(people[3].id)&&!(await ids(group)).includes(people[4].id)&&await page.$eval(`[name=gadd-${group.id}]`,(e,id)=>e.value===id,people[4].id)&&await page.$eval(`[name=gadd-notice-${group.id}]`,e=>e.textContent.includes('submitted member was added'))&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed'));
  check('other group untouched and no runtime errors',(await ids(group2)).length===0&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
