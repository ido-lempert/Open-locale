// Real local browser -> new-key description validation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55931, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-description-validation-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('description_validation_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/description_validation_browser`;
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
  let creates=0,reads=0,failCreate=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/keys`)reads++;if(req.method()==='POST'&&path===`/api${P}/keys`){creates++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE_DESCRIPTION_ERROR"}'});}req.continue();});
  const replace=async(selector,value)=>{await page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  check('optional description rules linked with no native truncation',await page.$eval('[name=newKeyDescription]',e=>e.getAttribute('aria-describedby')==='newKeyDescriptionRules'&&e.getAttribute('aria-invalid')==='false'&&!e.hasAttribute('maxlength'))&&!!await page.$('[name=newKeyDescriptionRules]'));
  await replace('[name=newKey]','context.key');await page.click('[name=newKeyPlural]');await replace('[name=newKeyMaxLength]','42');await page.focus('[name=newKeyDescription]');await page.keyboard.sendCharacter('x'.repeat(2001));await page.waitForSelector('[name=newKeyDescriptionInvalid]');
  check('actual description keyboard2001 retained without truncation',await page.$eval('[name=newKeyDescription]',e=>e.value.length===2001));
  for(const bad of ['x'.repeat(2001),'😀'.repeat(2001),'✈️'.repeat(2001),' '+ 'x'.repeat(2000)]){await replace('[name=newKeyDescription]',bad);await page.waitForFunction(()=>document.querySelector('[name=addKey]').disabled);await page.$eval('[name=addKey]',e=>e.form.requestSubmit());await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).addKey());check('invalid description kept with complete form and no request '+bad.slice(0,12),creates===0&&reads===0&&await page.$eval('[name=newKeyDescription]',(e,v)=>e.value===v&&e.getAttribute('aria-invalid')==='true',bad)&&await page.$eval('[name=newKey]',e=>e.value==='context.key')&&await page.$eval('[name=newKeyPlural]',e=>e.checked)&&await page.$eval('[name=newKeyMaxLength]',e=>e.value==='42')&&!await page.$('[name=keyCreateError]'));}
  await page.$eval('.key-create',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/editor-description-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('.key-create',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/editor-description-validation-mobile.png'});check('390px description guidance fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=newKeyDescriptionRules]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.$eval('[name=newKeyDescriptionInvalid]',e=>e.getBoundingClientRect().right<=innerWidth));
  await replace('[name=newKeyDescription]','😀'.repeat(2000));await page.waitForFunction(()=>!document.querySelector('[name=addKey]').disabled);await page.click('[name=addKey]');await page.waitForSelector('[aria-label="context.key in en"]');await page.waitForFunction(()=>document.querySelector('[name=newKey]').value==='');const stored=(await call(`${P}/keys`,null,token)).find(k=>k.name==='context.key');check('corrected Unicode2000 really persists with captured name plural length and no read',creates===1&&reads===0&&payloads[0].description==='😀'.repeat(2000)&&payloads[0].isPlural===true&&payloads[0].maxLength===42&&stored.description==='😀'.repeat(2000)&&stored.isPlural&&stored.maxLength===42&&await page.$eval('[name=newKeyDescription]',e=>e.value===''));
  await replace('[name=newKey]','presentation');await replace('[name=newKeyDescription]','✈️'.repeat(2000));await page.click('[name=addKey]');await page.waitForSelector('[aria-label="presentation in en"]');await page.waitForFunction(()=>document.querySelector('[name=newKey]').value==='');check('presentation2000 accepted and stored untruncated',creates===2&&reads===0&&(await call(`${P}/keys`,null,token)).find(k=>k.name==='presentation').description==='✈️'.repeat(2000));
  await replace('[name=newKey]','literal');const literal='  literal\n context <img src=x onerror=alert(1)>  ';await replace('[name=newKeyDescription]',literal);await page.click('[name=addKey]');await page.waitForSelector('[aria-label="literal in en"]');await page.waitForFunction(()=>document.querySelector('[name=newKey]').value==='');const displayed=await page.$$eval('[name=keyDescriptionText]',(es,v)=>es.some(e=>e.textContent===v&&!e.querySelector('img')),literal);check('description whitespace multiline markup kept literal without trim',creates===3&&reads===0&&payloads[2].description===literal&&(await call(`${P}/keys`,null,token)).find(k=>k.name==='literal').description===literal&&displayed);
  failCreate=true;await replace('[name=newKey]','uncertain');await replace('[name=newKeyDescription]','😀'.repeat(2000));await page.click('[name=addKey]');await page.waitForSelector('[name=keyCreateError]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).addKey());check('valid failed create still pauses replay and retains raw context without private error',creates===4&&reads===0&&await page.$eval('[name=newKeyDescription]',e=>e.value==='😀'.repeat(2000))&&await page.$eval('[name=addKey]',e=>e.disabled)&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  check('no description validation runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
