// Real local browser -> discard group local drafts -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55967, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-group-discard-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('group_discard');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/group_discard`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he','fr']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  const person=await call('/auth/signup',{email:'member@example.com',password:'pass1234',displayName:'Locale review member'});
  await call(P+'/members',{email:person.user.email,role:'MEMBER',allowedLocales:['fr']},token);
  const member=(await call(P+'/members',null,token)).find(m=>m.id===person.user.id);
  const inherited=await call(P+'/groups',{name:'Scope translators',role:'MEMBER',allowedLocales:['he']},token);
  await call(P+'/groups/'+inherited.id+'/members/'+member.id,null,token,'PUT');
  const target=inherited;
  const other=await call(P+'/groups',{name:'Other translators',role:'MEMBER',allowedLocales:['en']},token);
  const candidate=await call('/auth/signup',{email:'candidate@example.com',password:'pass1234',displayName:'Candidate'});await call(P+'/members',{email:candidate.user.email,role:'MEMBER',allowedLocales:['he']},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=group-discard-${target.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/groups`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(path.startsWith('/api/')&&['POST','PATCH','PUT','DELETE'].includes(req.method())){writes++;if(req.method()==='PATCH'&&path===`/api${P}/groups/${target.id}`){payloads.push(JSON.parse(req.postData()));held=req;return;}}req.continue();});
  const input=id=>`[name=group-name-${id}]`,discard=id=>`[name=group-discard-${id}]`;
  const type=async(selector,value)=>{await page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const select=async(selector,value)=>{await page.select(selector,value);await settle();};
  const click=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);await settle();};
  const row=async()=>(await call(P+'/groups',null,token)).find(x=>x.id===target.id);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Name PATCH not held');};
  const done=()=>page.waitForFunction(id=>!ng.getComponent(document.querySelector('ol-settings')).groupNamePending()[id],{},target.id);
  check('discard disabled without drafts',await page.$eval(discard(target.id),e=>e.disabled));
  await type(input(target.id),'');await type(`[name=group-locales-${target.id}]`,'unknown');await select(`[name=grole-${target.id}]`,'ADMIN');await select(`[name=gadd-${target.id}]`,candidate.user.id);await type(input(other.id),'Other unsaved');
  check('invalid name scope plus role and member drafts local no network',writes===0&&reads===0&&!await page.$eval(discard(target.id),e=>e.disabled));
  await click(discard(target.id));check('discard restores all four target fields without requests',writes===0&&reads===0&&await page.$eval(input(target.id),e=>e.value==='Scope translators')&&await page.$eval(`[name=group-locales-${target.id}]`,e=>e.value==='he')&&await page.$eval(`[name=grole-${target.id}]`,e=>e.value==='MEMBER')&&await page.$eval(`[name=gadd-${target.id}]`,e=>e.value==='')&&await page.$eval(discard(target.id),e=>e.disabled));if(failures)throw new Error('Discard did not reset target local drafts');
  check('other group raw draft unchanged',await page.$eval(input(other.id),e=>e.value==='Other unsaved')&&!await page.$eval(discard(other.id),e=>e.disabled));
  await type(input(target.id),'Saved translators');await click(`[name=group-name-save-${target.id}]`);await poll();await type(input(target.id),'Newer unsaved');await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).discardGroupDrafts(id),target.id);check('pending request blocks button and direct discard preserving newer raw draft',await page.$eval(discard(target.id),e=>e.disabled)&&await page.$eval(input(target.id),e=>e.value==='Newer unsaved')&&writes===1);await held.continue();await done();
  const beforeReads=reads,beforeWrites=writes;await click(discard(target.id));check('discard after success uses accepted name no undo refresh or saved receipt loss',(await row()).name==='Saved translators'&&await page.$eval(input(target.id),e=>e.value==='Saved translators')&&reads===beforeReads&&writes===beforeWrites&&await page.$eval(`[name=group-name-notice-${target.id}]`,e=>e.textContent.includes('submitted group name was saved'))&&await page.$eval(discard(target.id),e=>e.disabled));
  await type(input(target.id),'Screenshot unsaved');await page.$eval(discard(target.id),e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-discard-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(discard(target.id),e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-group-discard-mobile.png'});check('390px discard action and no undo help fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval(discard(target.id),e=>e.getBoundingClientRect().right<=innerWidth));
  held=null;failRead=true;await type(input(target.id),'Accepted without refresh');await click(`[name=group-name-save-${target.id}]`);await poll();await type(input(target.id),'Later unsaved');await held.continue();await done();const afterFailedRead=reads,afterWrites=writes;await click(discard(target.id));check('discard after503 uses locally accepted state without GET and preserves error receipt',(await row()).name==='Accepted without refresh'&&await page.$eval(input(target.id),e=>e.value==='Accepted without refresh')&&reads===afterFailedRead&&writes===afterWrites&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed')&&await page.$eval(`[name=group-name-notice-${target.id}]`,e=>e.textContent.includes('was saved')));
  const current=await row();check('grant role membership and other group draft remain unchanged',current.role==='MEMBER'&&JSON.stringify(current.allowedLocales)==='["he"]'&&current.members.length===1&&current.members[0].userId===member.id&&await page.$eval(input(other.id),e=>e.value==='Other unsaved'));
  check('no discard runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
