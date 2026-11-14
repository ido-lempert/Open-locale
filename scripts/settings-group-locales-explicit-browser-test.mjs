// Real local browser -> explicit group locale Save -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55965, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-group-locales-explicit-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('group_locales_explicit');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/group_locales_explicit`;
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
  const key=await call(P+'/keys',{name:'locale.scope'},token);
  const write=async locale=>{const r=await fetch(API+P+'/keys/'+key.id+'/translations',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+person.accessToken},body:JSON.stringify({locale,value:'scope test'})});return r.status;};
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=group-locales-${target.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let patches=0,reads=0,held,failPatch=false,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='PATCH'&&path===`/api${P}/groups/${target.id}`){patches++;payloads.push(JSON.parse(req.postData()));if(failPatch)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const input=`[name=group-locales-${target.id}]`,button=`[name=group-locales-save-${target.id}]`,notice=`[name=group-locales-notice-${target.id}]`;
  const type=async value=>{await page.$eval(input,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
  const save=()=>page.click(button);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Locale PATCH not held');};
  const done=()=>page.waitForFunction(id=>!ng.getComponent(document.querySelector('ol-settings')).groupLocalesPending()[id],{},target.id);
  const row=async()=>(await call(P+'/groups',null,token)).find(x=>x.id===target.id);
  check('initial unchanged locale scope Save disabled',await page.$eval(button,e=>e.disabled));
  await type('unknown');check('unknown project locale invalid and unsent',await page.$eval(input,e=>e.getAttribute('aria-invalid')==='true')&&await page.$eval(button,e=>e.disabled)&&patches===0);
  await type(', ,');check('comma-only input cannot silently grant all locales',await page.$eval(input,e=>e.getAttribute('aria-invalid')==='true')&&await page.$eval(button,e=>e.disabled)&&patches===0);
  await type('en');check('typing locale scope sends no PATCH or GET and keeps server grant',patches===0&&reads===0&&JSON.stringify((await row()).allowedLocales)==='["he"]');if(failures)throw new Error('Local-only locale editing absent');
  await save();await poll();await type('he');await page.select(`[name=grole-${target.id}]`,'ADMIN');await page.evaluate(g=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.saveGroupLocales(g);c.setGroupRole(g);},target);
  check('Save sends only original locale snapshot blocks duplicate and role Save',patches===1&&JSON.stringify(payloads[0])==='{"allowedLocales":["en"]}'&&await page.$eval(button,e=>e.disabled)&&await page.$eval(`[name=grole-save-${target.id}]`,e=>e.disabled));await page.select(`[name=grole-${target.id}]`,'MEMBER');await held.continue();await done();
  check('accepted en scope newer he text retained with saved unsaved receipt',JSON.stringify((await row()).allowedLocales)==='["en"]'&&await page.$eval(input,e=>e.value==='he')&&!await page.$eval(button,e=>e.disabled)&&await page.$eval(notice,e=>e.textContent.includes('submitted group locale scope was saved')&&e.textContent.includes('newer locale text has not been saved')));
  check('real API denies removed group locale and allows saved and direct locales',(await write('he'))===403&&[200,201].includes(await write('en'))&&[200,201].includes(await write('fr')));
  check('effective union shown with unchanged direct member grant',await page.evaluate(()=>document.body.textContent.includes('effective locales: en, fr')));
  await page.$eval(input,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-group-locales-explicit-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(input,e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-group-locales-explicit-mobile.png'});
  check('390px scope help receipt and Save fit without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval(notice,e=>e.getBoundingClientRect().right<=innerWidth));
  held=null;await save();await poll();await held.continue();await done();check('newer text requires second explicit Save then unchanged draft resets',patches===2&&JSON.stringify(payloads[1])==='{"allowedLocales":["he"]}'&&JSON.stringify((await row()).allowedLocales)==='["he"]'&&await page.$eval(button,e=>e.disabled));
  await type('');held=null;await save();await poll();await held.continue();await done();check('explicit blank scope saves all locales and broadens actual translation writes',patches===3&&JSON.stringify(payloads[2])==='{"allowedLocales":[]}'&&(await row()).allowedLocales.length===0&&[200,201].includes(await write('en'))&&await page.$eval(button,e=>e.disabled));
  failPatch=true;const before=reads;await type('en');await save();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');await done();check('403 preserves raw scope no saved claim or refresh',reads===before&&(await row()).allowedLocales.length===0&&!await page.$(notice)&&await page.$eval(input,e=>e.value==='en'));
  failPatch=false;failRead=true;held=null;await save();await poll();await type('');await held.continue();await done();check('503 refresh preserves accepted scope and enables explicit newer revert',JSON.stringify((await row()).allowedLocales)==='["en"]'&&await page.$eval(input,e=>e.value==='')&&!await page.$eval(button,e=>e.disabled)&&await page.$eval(notice,e=>e.textContent.includes('was saved'))&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.error()==='Refresh failed'&&JSON.stringify(c.groups().find(g=>g.id===id).allowedLocales)==='["en"]';},target.id));
  const actualMember=(await call(P+'/members',null,token)).find(m=>m.id===member.id);const actualGroup=await row();check('direct member grant and group membership unchanged',actualMember.role==='MEMBER'&&JSON.stringify(actualMember.allowedLocales)==='["fr"]'&&actualGroup.members.length===1&&actualGroup.members[0].userId===member.id&&actualGroup.role==='MEMBER');
  check('no locale scope runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
