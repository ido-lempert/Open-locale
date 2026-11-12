// Real local browser -> glossary new-term limits -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55939, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-glossary-validation-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('glossary_validation_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/glossary_validation_browser`;
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


  await call(`${P}/glossary`,{term:'Existing',translations:{he:'Original'}},token);await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Existing in he"]');
  let posts=0,reads=0,patches=0,failCreate=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/glossary`)reads++;if(req.method()==='PATCH'&&path.startsWith(`/api${P}/glossary/`))patches++;if(req.method()==='POST'&&path===`/api${P}/glossary`){posts++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE_GLOSSARY_LIMIT"}'});}req.continue();});
  const replace=async(selector,value)=>{await page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  check('new-term rules linked without truncation or initial invalid flag',await page.$eval('[name=gTerm]',e=>!e.hasAttribute('maxlength')&&e.getAttribute('aria-describedby')==='newGlossaryTermRules'&&e.getAttribute('aria-invalid')==='false')&&await page.$eval('[name=gNotes]',e=>e.getAttribute('aria-describedby')==='newGlossaryTermRules'&&e.getAttribute('aria-invalid')==='false')&&await page.$eval('.task-form button[type=submit]',e=>e.disabled));
  await page.click('[name=gDnt]');await page.focus('[name=gTerm]');await page.keyboard.sendCharacter('x'.repeat(201));await page.waitForSelector('[name=newGlossaryTermInvalid]');check('actual term input201 kept without native truncation',await page.$eval('[name=gTerm]',e=>e.value.length===201));
  for(const [term,notes] of [['x'.repeat(201),'context'],['valid','x'.repeat(1001)],['😀'.repeat(201),'✈️'.repeat(1001)],['  ','context']]){await replace('[name=gTerm]',term);await replace('[name=gNotes]',notes);await page.waitForFunction(()=>document.querySelector('.task-form button[type=submit]').disabled);await page.focus('[name=gNotes]');await page.keyboard.press('Enter');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).create());check('invalid form stays local '+term.slice(0,10),posts===0&&reads===0&&patches===0&&await page.$eval('[name=gTerm]',(e,v)=>e.value===v,term)&&await page.$eval('[name=gNotes]',(e,v)=>e.value===v,notes)&&await page.$eval('[name=gDnt]',e=>e.checked)&&!await page.$('[name=glossaryCreateUnknown]')&&!await page.$('[name=glossaryCreating]'));}
  await replace('[name=gTerm]','x'.repeat(201));await replace('[name=gNotes]','x'.repeat(1001));await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/glossary-create-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/glossary-create-validation-mobile.png'});check('390px new-term rules and correction fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=newGlossaryTermRules]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.$eval('[name=newGlossaryTermInvalid]',e=>e.getBoundingClientRect().right<=innerWidth));
  await replace('[name=gTerm]',' '+ '😀'.repeat(200)+' ');await replace('[name=gNotes]',' '+ '✈️'.repeat(1000)+' ');await page.waitForFunction(()=>!document.querySelector('.task-form button[type=submit]').disabled);await page.click('.task-form button[type=submit]');await page.waitForSelector('[name=glossaryCreateNotice]');await page.waitForFunction(()=>document.querySelector('[name=gTerm]').value==='');const list=await call(`${P}/glossary`,null,token);check('corrected Unicode200 and presentation1000 really persist once with trim and choice',posts===1&&reads===0&&patches===0&&payloads[0].term==='😀'.repeat(200)&&payloads[0].notes==='✈️'.repeat(1000)&&payloads[0].doNotTranslate&&list.some(t=>t.term==='😀'.repeat(200)&&t.notes==='✈️'.repeat(1000)&&t.doNotTranslate)&&await page.$eval('[aria-label="Existing in he"]',e=>e.value==='Original'));
  await replace('[name=gTerm]','  literal <img>  ');await replace('[name=gNotes]','   ');await page.click('.task-form button[type=submit]');await page.waitForFunction(()=>document.querySelector('[name=gTerm]').value==='');check('whitespace notes omitted and term literal after existing trim',posts===2&&reads===0&&!('notes' in payloads[1])&&payloads[1].term==='literal <img>'&&(await call(`${P}/glossary`,null,token)).some(t=>t.term==='literal <img>'&&t.notes==='')&&await page.$$eval('.glossary-table code',es=>es.some(e=>e.textContent==='literal <img>'&&!e.querySelector('img'))));
  failCreate=true;await replace('[name=gTerm]','valid failure');await replace('[name=gNotes]','keep context');await page.click('.task-form button[type=submit]');await page.waitForSelector('[name=glossaryCreateUnknown]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).create());check('valid failure still keeps form and pauses replay without private text',posts===3&&reads===0&&patches===0&&await page.$eval('[name=gTerm]',e=>e.value==='valid failure')&&await page.$eval('[name=gNotes]',e=>e.value==='keep context')&&await page.$eval('.task-form button[type=submit]',e=>e.disabled)&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  check('no new-term validation runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
