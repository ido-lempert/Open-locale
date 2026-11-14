// Real local browser -> explicit group role Save -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55962, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-group-role-explicit-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('group_role_explicit');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/group_role_explicit`;
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


  const group=await call(P+'/groups',{name:'Reviewers',role:'MEMBER',allowedLocales:['en']},token);
  const group2=await call(P+'/groups',{name:'Other group',role:'MEMBER',allowedLocales:['he']},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=grole-${group.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let patches=0,reads=0,held,failPatch=false,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='PATCH'&&path===`/api${P}/groups/${group.id}`){patches++;payloads.push(JSON.parse(req.postData()));if(failPatch)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const select=role=>page.select(`[name=grole-${group.id}]`,role);
  const save=()=>page.click(`[name=grole-save-${group.id}]`);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Role PATCH not held');};
  const done=()=>page.waitForFunction(id=>!ng.getComponent(document.querySelector('ol-settings')).groupRolePending()[id],{},group.id);
  const row=async()=>(await call(P+'/groups',null,token)).find(x=>x.id===group.id);
  check('unchanged role has disabled Save',await page.$eval(`[name=grole-save-${group.id}]`,e=>e.disabled));
  await select('ADMIN');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));check('role selection alone sends no PATCH or refresh and server role unchanged',patches===0&&reads===0&&(await row()).role==='MEMBER');if(failures)throw new Error('Explicit role Save absent');
  await save();await poll();await select('MEMBER');await page.evaluate(g=>ng.getComponent(document.querySelector('ol-settings')).setGroupRole(g),group);check('Save submits original role once and pending blocks duplicate',patches===1&&payloads[0].role==='ADMIN'&&await page.$eval(`[name=grole-save-${group.id}]`,e=>e.disabled));await held.continue();await done();check('saved admin role and newer member draft remain distinct with receipt',(await row()).role==='ADMIN'&&await page.$eval(`[name=grole-${group.id}]`,e=>e.value==='MEMBER')&&await page.$eval(`[name=grole-notice-${group.id}]`,e=>e.textContent.includes('submitted group role was saved')&&e.textContent.includes('newer role selection has not been saved'))&&!await page.$eval(`[name=grole-save-${group.id}]`,e=>e.disabled));if(failures)throw new Error('Newer role draft lost or automatically saved');
  await page.$eval(`[name=grole-${group.id}]`,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-role-explicit-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(`[name=grole-${group.id}]`,e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-group-role-explicit-mobile.png'});check('390px role Save help and receipt fit without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval(`[name=grole-notice-${group.id}]`,e=>e.getBoundingClientRect().right<=innerWidth));
  held=null;await save();await poll();await page.waitForFunction(id=>!document.querySelector(`[name=grole-notice-${id}]`),{},group.id);check('newer role waits for second explicit Save and receipt clears',patches===2&&payloads[1].role==='MEMBER');await held.continue();await done();check('unchanged second success resets draft to actual role with Save disabled',(await row()).role==='MEMBER'&&await page.$eval(`[name=grole-${group.id}]`,e=>e.value==='MEMBER')&&await page.$eval(`[name=grole-save-${group.id}]`,e=>e.disabled));
  failPatch=true;const before=reads;await select('ADMIN');await save();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');await done();check('refusal keeps role choice no saved claim or refresh and server unchanged',reads===before&&(await row()).role==='MEMBER'&&!await page.$(`[name=grole-notice-${group.id}]`)&&await page.$eval(`[name=grole-${group.id}]`,e=>e.value==='ADMIN'));
  failPatch=false;failRead=true;held=null;await save();await poll();await select('MEMBER');await held.continue();await done();check('refresh failure keeps accurate accepted role and enables explicit newer revert',(await row()).role==='ADMIN'&&await page.$eval(`[name=grole-${group.id}]`,e=>e.value==='MEMBER')&&!await page.$eval(`[name=grole-save-${group.id}]`,e=>e.disabled)&&await page.$eval(`[name=grole-notice-${group.id}]`,e=>e.textContent.includes('was saved'))&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.error()==='Refresh failed'&&c.groups().find(g=>g.id===id).role==='ADMIN';},group.id));
  const other=(await call(P+'/groups',null,token)).find(g=>g.id===group2.id);check('other group unchanged no membership edits or runtime errors',other.role==='MEMBER'&&other.members.length===0&&(await row()).members.length===0&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
