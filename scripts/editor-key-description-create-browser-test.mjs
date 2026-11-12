// Real local browser -> optional description create -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55901, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-key-create-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('key_create_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/key_create_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  let heldKey,heldTranslation,creates=0,keyReads=0,failCreate=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='PUT'&&path.endsWith('/translations')){heldTranslation=req;return;}if(req.method()==='POST'&&path===`/api${P}/keys`){creates++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE"}'});heldKey=req;return;}if(req.method()==='GET'&&path===`/api${P}/keys`)keyReads++;req.continue();});
  const replace=async(selector,value)=>{await page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  const poll=async(fn)=>{for(let n=0;n<150;n++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Fixture request not held');};
  const description='  Button context\nטקסט <img src=x onerror=alert(1)> '+ 'x'.repeat(180)+'  ';
  check('optional multiline form exposes backend2000 bound and local-only creation scope',await page.$eval('[name=newKeyDescription]',e=>e.tagName==='TEXTAREA'&&e.maxLength===2000)&&await page.$eval('[name=newKeyDescriptionScope]',e=>e.textContent.includes('not an edit to an existing key')&&e.textContent.includes('not automatically saved')));
  await replace('[name=newKeyDescription]',description);await replace('[name=newKey]','described');await page.focus('[aria-label="alpha in en"]');await page.type('[aria-label="alpha in en"]',' LOCAL_DRAFT');const draft=await page.$eval('[aria-label="alpha in en"]',e=>e.value);
  await page.$eval('[name=addKey]',e=>e.form.requestSubmit());await poll(()=>heldKey);
  check('one create captures exact literal description and branch without key read or translation blur',creates===1&&keyReads===0&&!heldTranslation&&payloads[0].description===description&&payloads[0].name==='described'&&payloads[0].branch==='main'&&await page.$eval('[aria-label="alpha in en"]',(e,v)=>e.value===v,draft));
  await replace('[name=newKeyDescription]','Newer local description');await page.$eval('[name=addKey]',e=>e.form.requestSubmit());check('pending duplicate is refused while newer description stays editable',creates===1&&await page.$eval('[name=addKey]',e=>e.disabled)&&await page.$eval('[name=newKeyDescription]',e=>!e.disabled&&e.value==='Newer local description'));
  await page.screenshot({path:'/downloads/editor-key-description-create-pending.png'});
  await heldKey.continue();await page.waitForSelector('[aria-label="described in en"]');await page.waitForFunction(()=>!document.querySelector('[name=addKey]').disabled);
  const stored=await prisma.key.findFirst({where:{projectId:project.id,name:'described'}});
  check('real create persisted exact description while confirmation keeps newer pair and local translation',stored.description===description&&keyReads===0&&!heldTranslation&&await page.$eval('[name=newKey]',e=>e.value==='described')&&await page.$eval('[name=newKeyDescription]',e=>e.value==='Newer local description')&&await page.$eval('[aria-label="alpha in en"]',(e,v)=>e.value===v,draft));
  await page.$eval('[name=keyDescription]',e=>e.open=true);
  check('returned description is literal context, not newer form draft',await page.$eval('[name=keyDescriptionText]',(e,v)=>e.textContent===v&&!e.querySelector('img'),description));
  await replace('[name=newKey]','second');await replace('[name=newKeyDescription]','Exact second context');heldKey=null;await page.$eval('[name=addKey]',e=>e.form.requestSubmit());await poll(()=>heldKey);await heldKey.continue();await page.waitForSelector('[aria-label="second in en"]');await page.waitForFunction(()=>document.querySelector('[name=newKey]').value==='');
  check('unchanged submitted pair clears only after confirmed creation',await page.$eval('[name=newKeyDescription]',e=>e.value==='')&&(await prisma.key.findFirst({where:{projectId:project.id,name:'second'}})).description==='Exact second context'&&creates===2&&keyReads===0&&!heldTranslation);
  await replace('[name=newKey]','too-long');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.newKeyDescription.set('x'.repeat(2001));});await page.waitForFunction(()=>document.querySelector('[name=addKey]').disabled);await page.$eval('[name=addKey]',e=>e.form.requestSubmit());
  check('overlimit programmatic form cannot create or truncate',creates===2&&await page.$eval('[name=newKeyDescription]',e=>e.value.length===2001));
  await replace('[name=newKey]','uncertain');await replace('[name=newKeyDescription]','Keep uncertain context');failCreate=true;await page.$eval('[name=addKey]',e=>e.form.requestSubmit());await page.waitForSelector('[name=keyCreateError]');await page.$eval('[name=addKey]',e=>e.form.requestSubmit());
  check('unconfirmed create keeps pair and pauses replay with no private error or reads',creates===3&&keyReads===0&&!heldTranslation&&await page.$eval('[name=newKeyDescription]',e=>e.value==='Keep uncertain context')&&await page.$eval('[name=newKey]',e=>e.value==='uncertain')&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE'));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/editor-key-description-create-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('.key-create',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/editor-key-description-create-mobile.png'});
  check('390px creation form fits without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=newKeyDescription]',e=>e.getBoundingClientRect().right<=innerWidth));
  check('no description creation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
