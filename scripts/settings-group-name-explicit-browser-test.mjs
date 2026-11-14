// Real local browser -> explicit group name Save -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55966, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-group-name-explicit-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('group_name_explicit');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/group_name_explicit`;
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
  const task=await call(P+'/tasks',{title:'Review group assignment',assigneeGroupId:target.id},token);
  await call(P+'/groups',{name:'Existing name',role:'MEMBER',allowedLocales:['en']},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=group-name-${target.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let patches=0,reads=0,held,failPatch=false,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='PATCH'&&path===`/api${P}/groups/${target.id}`){patches++;payloads.push(JSON.parse(req.postData()));if(failPatch)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const input=`[name=group-name-${target.id}]`,button=`[name=group-name-save-${target.id}]`,notice=`[name=group-name-notice-${target.id}]`;
  const type=async value=>{await page.$eval(input,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
  const save=async()=>{await page.$eval(button,e=>e.scrollIntoView({block:'center'}));await page.click(button);};
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Name PATCH not held');};
  const done=()=>page.waitForFunction(id=>!ng.getComponent(document.querySelector('ol-settings')).groupNamePending()[id],{},target.id);
  const row=async()=>(await call(P+'/groups',null,token)).find(x=>x.id===target.id);
  check('initial unchanged name Save disabled',await page.$eval(button,e=>e.disabled));
  await type('  ');check('blank name invalid and unsent',await page.$eval(input,e=>e.getAttribute('aria-invalid')==='true')&&await page.$eval(button,e=>e.disabled)&&patches===0);
  await type('😀'.repeat(101));check('over100 code point name invalid full text retained',await page.$eval(input,e=>Array.from(e.value).length===101&&e.getAttribute('aria-invalid')==='true')&&await page.$eval(button,e=>e.disabled)&&patches===0);
  await type(' Renamed translators ');check('typing name sends no PATCH or GET and actual name unchanged',patches===0&&reads===0&&(await row()).name==='Scope translators');if(failures)throw new Error('Local-only group rename absent');
  await save();await poll();await type('Newer translators');await page.select(`[name=grole-${target.id}]`,'ADMIN');await page.$eval(`[name=group-locales-${target.id}]`,e=>{e.value='en';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.evaluate(g=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.saveGroupName(g);c.setGroupRole(g);c.saveGroupLocales(g);},target);
  check('Save submits trimmed name-only snapshot once and blocks role and scope',patches===1&&JSON.stringify(payloads[0])==='{"name":"Renamed translators"}'&&await page.$eval(button,e=>e.disabled)&&await page.$eval(`[name=grole-save-${target.id}]`,e=>e.disabled)&&await page.$eval(`[name=group-locales-save-${target.id}]`,e=>e.disabled));await page.select(`[name=grole-${target.id}]`,'MEMBER');await held.continue();await done();
  check('saved name and newer text distinct with accurate receipt',(await row()).name==='Renamed translators'&&await page.$eval(input,e=>e.value==='Newer translators')&&!await page.$eval(button,e=>e.disabled)&&await page.$eval(notice,e=>e.textContent.includes('submitted group name was saved')&&e.textContent.includes('newer name text has not been saved')));
  const preserved=await row();const tasks=await call(P+'/tasks',null,token);check('rename preserves group grant membership and task assignment',preserved.role==='MEMBER'&&JSON.stringify(preserved.allowedLocales)==='["he"]'&&preserved.members.length===1&&preserved.members[0].userId===member.id&&tasks.some(t=>t.id===task.id&&t.assigneeGroupId===target.id));
  await page.$eval(input,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-name-explicit-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(input,e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-group-name-explicit-mobile.png'});check('390px name Save help and receipt fit without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval(notice,e=>e.getBoundingClientRect().right<=innerWidth));
  held=null;await save();await poll();await held.continue();await done();check('newer name requires second explicit Save and unchanged draft clears',patches===2&&payloads[1].name==='Newer translators'&&(await row()).name==='Newer translators'&&await page.$eval(button,e=>e.disabled));
  await type('Existing name');held=null;await save();await poll();const before=reads;await held.continue();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='A group with this name already exists');await done();check('real409 duplicate name keeps draft no receipt or refresh',reads===before&&(await row()).name==='Newer translators'&&!await page.$(notice)&&await page.$eval(input,e=>e.value==='Existing name'));
  failPatch=true;await type('Denied rename');const before403=reads;await save();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');await done();check('403 keeps text no saved claim or refresh',reads===before403&&(await row()).name==='Newer translators'&&!await page.$(notice)&&await page.$eval(input,e=>e.value==='Denied rename'));
  failPatch=false;failRead=true;await type('Accepted rename');held=null;await save();await poll();await type('Newer translators');await held.continue();await done();check('503 refresh keeps accepted name and enables explicit newer revert',(await row()).name==='Accepted rename'&&await page.$eval(input,e=>e.value==='Newer translators')&&!await page.$eval(button,e=>e.disabled)&&await page.$eval(notice,e=>e.textContent.includes('was saved'))&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.error()==='Refresh failed'&&c.groups().find(g=>g.id===id).name==='Accepted rename';},target.id));
  check('no group rename runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
