// Real local browser -> discard member local drafts -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_MEMBER_TEST_PG_PORT ?? 55969), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-member-discard-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('member_discard');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/member_discard`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he','fr']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  const person=await call('/auth/signup',{email:'member@example.com',password:'pass1234',displayName:'Locale review member'});
  await call(P+'/members',{email:person.user.email,role:'MEMBER',allowedLocales:['he']},token);
  const member=(await call(P+'/members',null,token)).find(m=>m.id===person.user.id);
  const inherited=await call(P+'/groups',{name:'French translators',role:'MEMBER',allowedLocales:['fr']},token);
  await call(P+'/groups/'+inherited.id+'/members/'+member.id,null,token,'PUT');
  const otherPerson=await call('/auth/signup',{email:'other@example.com',password:'pass1234',displayName:'Other member'});await call(P+'/members',{email:otherPerson.user.email,role:'MEMBER',allowedLocales:['en']},token);const other=otherPerson.user;
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=member-discard-${member.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/members`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(path.startsWith('/api/')&&['POST','PATCH','PUT','DELETE'].includes(req.method())){writes++;if(req.method()==='PATCH'&&path===`/api${P}/members/${member.id}`){payloads.push(JSON.parse(req.postData()));held=req;return;}}req.continue();});
  const input=id=>`[name=member-locales-${id}]`,role=id=>`[name=role-${id}]`,discard=id=>`[name=member-discard-${id}]`;
  const type=async(selector,value)=>{await page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const select=async(selector,value)=>{await page.select(selector,value);await settle();};
  const click=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);await settle();};
  const row=async()=>(await call(P+'/members',null,token)).find(x=>x.id===member.id);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Member PATCH not held');};
  const done=()=>page.waitForFunction(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.memberRolePending()[id]&&!c.memberLocalesPending()[id];},{},member.id);
  check('discard disabled without drafts',await page.$eval(discard(member.id),e=>e.disabled));
  await type(input(member.id),'unknown');await select(role(member.id),'ADMIN');await type(input(other.id),'fr');
  check('invalid scope and role draft local with no requests',writes===0&&reads===0&&!await page.$eval(discard(member.id),e=>e.disabled));
  await click(discard(member.id));check('discard restores both member fields without requests',writes===0&&reads===0&&await page.$eval(input(member.id),e=>e.value==='he')&&await page.$eval(role(member.id),e=>e.value==='MEMBER')&&await page.$eval(discard(member.id),e=>e.disabled));if(failures)throw new Error('Member reset absent');
  check('other member raw draft unchanged',await page.$eval(input(other.id),e=>e.value==='fr')&&!await page.$eval(discard(other.id),e=>e.disabled));
  await type(input(member.id),'en');await click(`[name=member-locales-save-${member.id}]`);await poll();await type(input(member.id),'');await select(role(member.id),'ADMIN');await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).discardMemberDrafts(id),member.id);check('pending locale request blocks button direct discard and preserves both drafts',await page.$eval(discard(member.id),e=>e.disabled)&&await page.$eval(input(member.id),e=>e.value==='')&&await page.$eval(role(member.id),e=>e.value==='ADMIN')&&writes===1);await held.continue();await done();
  const beforeReads=reads,beforeWrites=writes;await click(discard(member.id));check('discard uses accepted scope no undo refresh or receipt loss',JSON.stringify((await row()).allowedLocales)==='["en"]'&&await page.$eval(input(member.id),e=>e.value==='en')&&await page.$eval(role(member.id),e=>e.value==='MEMBER')&&reads===beforeReads&&writes===beforeWrites&&await page.$eval(`[name=member-locales-notice-${member.id}]`,e=>e.textContent.includes('was saved')));
  held=null;await select(role(member.id),'ADMIN');await click(`[name=role-save-${member.id}]`);await poll();await select(role(member.id),'MEMBER');await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).discardMemberDrafts(id),member.id);check('pending role request blocks button direct reset preserving newer role',await page.$eval(discard(member.id),e=>e.disabled)&&await page.$eval(role(member.id),e=>e.value==='MEMBER')&&writes===2);await held.continue();await done();const roleReads=reads;await click(discard(member.id));check('accepted ADMIN not undone and hidden locale reset never sent',(await row()).role==='ADMIN'&&await page.$eval(role(member.id),e=>e.value==='ADMIN')&&!await page.$(input(member.id))&&writes===2&&reads===roleReads&&await page.$eval(`[name=role-notice-${member.id}]`,e=>e.textContent.includes('was saved')));
  held=null;failRead=true;await select(role(member.id),'MEMBER');await click(`[name=role-save-${member.id}]`);await poll();await select(role(member.id),'ADMIN');await held.continue();await done();const afterReads=reads,afterWrites=writes;await click(discard(member.id));check('discard after503 uses accepted MEMBER preserving error and both saved receipts',(await row()).role==='MEMBER'&&await page.$eval(role(member.id),e=>e.value==='MEMBER')&&await page.$eval(input(member.id),e=>e.value==='en')&&reads===afterReads&&writes===afterWrites&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed')&&await page.$eval(`[name=role-notice-${member.id}]`,e=>e.textContent.includes('was saved'))&&await page.$eval(`[name=member-locales-notice-${member.id}]`,e=>e.textContent.includes('was saved')));
  await type(input(member.id),'Screenshot unsaved');await page.$eval(discard(member.id),e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-member-discard-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(discard(member.id),e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-member-discard-mobile.png'});check('390px member discard and no undo help fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval(discard(member.id),e=>e.getBoundingClientRect().right<=innerWidth));
  const groups=await call(P+'/groups',null,token);check('inherited group direct grant and other member draft unchanged',groups.length===1&&groups[0].role==='MEMBER'&&JSON.stringify(groups[0].allowedLocales)==='["fr"]'&&groups[0].members[0].userId===member.id&&JSON.stringify((await row()).allowedLocales)==='["en"]'&&await page.$eval(input(other.id),e=>e.value==='fr'));
  check('no member discard runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
