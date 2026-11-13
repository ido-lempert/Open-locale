// Real local browser -> settings pending member draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55958, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-general-draft-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('general_draft_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/general_draft_browser`;
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


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=name]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,heldRead,heldLate,holdLate=false,holdRead=false,failWrite=false,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(holdLate&&path==='/api/auth/tokens'){heldLate=req;return;}if(path===`/api${P}`){if(failRead)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});if(holdRead){heldRead=req;return;}}}if(req.method()==='PATCH'&&path===`/api${P}`){writes++;payloads.push(JSON.parse(req.postData()));if(failWrite)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async(name,value)=>page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async(kind='write')=>{for(let n=0;n<150;n++){if(kind==='write'?held:heldRead)return;await new Promise(r=>setTimeout(r,20));}throw new Error('General request not held: '+kind);};
  const submit=()=>page.$eval('[name=saveSettingsGeneral]',e=>e.form.requestSubmit());
  const done=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  const values=()=>page.evaluate(()=>[document.querySelector('[name=name]').value,document.querySelector('[name=description]').value]);
  await replace('name',' First name ');await replace('description',' Original details ');await submit();await poll();await replace('name',' Newer name ');await replace('description',' Newer details ');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).rename());check('pending duplicate blocked with exact original raw project details',writes===1&&JSON.stringify(payloads[0])===JSON.stringify({name:' First name ',description:' Original details '}));await held.continue();await done();check('successful earlier PATCH keeps whole newer general draft and unsaved receipt',JSON.stringify(await values())===JSON.stringify([' Newer name ',' Newer details '])&&await page.$eval('[name=settingsGeneralDraftNotice]',e=>e.textContent.includes('were saved')&&e.textContent.includes('has not been saved')));if(failures)throw new Error('General draft preservation absent or mismatched');
  let saved=await call(P,null,token);check('only original submitted general details saved to database',saved.name===' First name '&&saved.description===' Original details '&&reads>0);
  await page.screenshot({path:'/downloads/settings-general-pending-draft-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/settings-general-pending-draft-mobile.png'});check('390px newer general draft and complete receipt fit without page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsGeneralDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  held=null;await submit();await poll();check('newer project details sent only on explicit second Save and receipt clears',writes===2&&payloads[1].name===' Newer name '&&payloads[1].description===' Newer details '&&!await page.$('[name=settingsGeneralDraftNotice]'));await held.continue();await done();saved=await call(P,null,token);check('unchanged Save refreshes saved form details normally',saved.name===' Newer name '&&saved.description===' Newer details '&&JSON.stringify(await values())===JSON.stringify([saved.name,saved.description])&&!await page.$('[name=settingsGeneralDraftNotice]'));
  held=null;heldRead=null;holdRead=true;await replace('name',' Refresh saved ');await replace('description',' Refresh original ');await submit();await poll();await held.continue();await poll('read');await replace('name',' During refresh ');await replace('description',' Full newer refresh draft ');holdRead=false;await heldRead.continue();await done();saved=await call(P,null,token);check('held refresh cannot replace whole newer draft while original PATCH is saved',saved.name===' Refresh saved '&&saved.description===' Refresh original '&&JSON.stringify(await values())===JSON.stringify([' During refresh ',' Full newer refresh draft '])&&await page.$eval('[name=settingsGeneralDraftNotice]',e=>e.textContent.includes('has not been saved')));
  held=null;heldLate=null;holdLate=true;await replace('name',' Late refresh saved ');await replace('description',' Late refresh original ');await submit();await poll();await held.continue();for(let n=0;n<150&&!heldLate;n++)await new Promise(r=>setTimeout(r,20));if(!heldLate)throw new Error('Late refresh not held');await replace('name',' Late newer draft ');await replace('description',' Late newer details ');holdLate=false;await heldLate.continue();await done();saved=await call(P,null,token);check('edits after project refresh during later list refresh keep receipt and remain unsent',saved.name===' Late refresh saved '&&saved.description===' Late refresh original '&&JSON.stringify(await values())===JSON.stringify([' Late newer draft ',' Late newer details '])&&await page.$eval('[name=settingsGeneralDraftNotice]',e=>e.textContent.includes('has not been saved')));
  const before=reads;failWrite=true;await submit();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('PATCH refusal retains whole draft with no saved claim or refresh',reads===before&&JSON.stringify(await values())===JSON.stringify([' Late newer draft ',' Late newer details '])&&!await page.$('[name=settingsGeneralDraftNotice]'));
  failWrite=false;failRead=true;held=null;await replace('name',' Saved before refresh failure ');await submit();await poll();await replace('name',' Newer after failure ');await replace('description',' Full unsaved failure draft ');await held.continue();await done();saved=await call(P,null,token);check('refresh failure keeps newer draft with accurate saved receipt and actual old DB value',saved.name===' Saved before refresh failure '&&saved.description===' Late newer details '&&JSON.stringify(await values())===JSON.stringify([' Newer after failure ',' Full unsaved failure draft '])&&await page.$eval('[name=settingsGeneralDraftNotice]',e=>e.textContent.includes('were saved')&&e.textContent.includes('has not been saved'))&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed'));
  check('no pending general draft runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
