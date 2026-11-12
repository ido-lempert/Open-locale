// Real local browser -> new-project form preflight limits -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55941, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-validation-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_validation_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_validation_browser`;
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


  await page.goto(`${WEB}/projects`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('[name=projectsLoading]'));
  let posts=0,reads=0,failCreate=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path==='/api/projects')reads++;if(req.method()==='POST'&&path==='/api/projects'){posts++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE_PROJECT_LIMIT"}'});}req.continue();});
  const replace=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  check('project form rules linked and initial no invalid flags',await page.$$eval('form.create input',es=>es.every(e=>e.getAttribute('aria-describedby')==='newProjectRules'&&e.getAttribute('aria-invalid')==='false'))&&await page.$eval('form.create button',e=>e.disabled));
  await replace('slug','valid-project');await replace('locales','en,he');await page.focus('[name=name]');await page.keyboard.sendCharacter('x'.repeat(121));await page.waitForSelector('[name=newProjectInvalid]');check('actual name121 kept with local correction',await page.$eval('[name=name]',e=>e.value.length===121));
  for(const [name,slug,locales] of [['x'.repeat(121),'valid-project','en'],['valid','a','en'],['valid','-invalid','en'],['valid','valid-project',', ,'],['  ','valid-project','en']]){await replace('name',name);await replace('slug',slug);await replace('locales',locales);await page.waitForFunction(()=>document.querySelector('form.create button').disabled);await page.focus('[name=locales]');await page.keyboard.press('Enter');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-projects')).create());check('invalid project form stays local '+slug,posts===0&&reads===0&&await page.$eval('[name=name]',(e,v)=>e.value===v,name)&&await page.$eval('[name=slug]',(e,v)=>e.value===v,slug)&&await page.$eval('[name=locales]',(e,v)=>e.value===v,locales)&&!await page.$('[name=projectCreateUnknown]')&&!await page.$('[name=projectCreating]'));}
  await replace('name','x'.repeat(121));await replace('slug','a');await replace('locales',', ,');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/project-create-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/project-create-validation-mobile.png'});check('390px project rules and correction fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=newProjectRules]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.$eval('[name=newProjectInvalid]',e=>e.getBoundingClientRect().right<=innerWidth));
  const exactName=' '+ '😀'.repeat(118)+' ';await replace('name',exactName);await replace('slug','unicode-project');await replace('locales',' en, ,he ');await page.waitForFunction(()=>!document.querySelector('form.create button').disabled);await page.$eval('form.create button',e=>e.scrollIntoView({block:'center'}));await page.click('form.create button');await page.waitForSelector('[name=projectCreateNotice]');await page.waitForFunction(()=>document.querySelector('[name=name]').value==='');const list=await call('/projects',null,token);check('corrected raw Unicode name120 and parsed locale entries really persist once',posts===1&&reads===1&&payloads[0].name===exactName&&payloads[0].slug==='unicode-project'&&JSON.stringify(payloads[0].locales)==='["en","he"]'&&list.some(p=>p.name===exactName&&p.slug==='unicode-project'));
  await replace('name','literal <img>');await replace('slug','a-');await replace('locales','en');await page.$eval('form.create button',e=>e.scrollIntoView({block:'center'}));await page.click('form.create button');await page.waitForFunction(()=>document.querySelector('[name=name]').value==='');check('backend accepted trailing-dash slug persists with literal name',posts===2&&reads===2&&payloads[1].slug==='a-'&&(await call('/projects',null,token)).some(p=>p.slug==='a-'&&p.name==='literal <img>')&&await page.$$eval('.cards strong',es=>es.some(e=>e.textContent==='literal <img>'&&!e.querySelector('img'))));
  failCreate=true;await replace('name','valid failure');await replace('slug','valid-failure');await replace('locales','en');await page.$eval('form.create button',e=>e.scrollIntoView({block:'center'}));await page.click('form.create button');await page.waitForSelector('[name=projectCreateUnknown]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-projects')).create());check('valid failure keeps form and pauses replay without private error',posts===3&&reads===2&&await page.$eval('[name=name]',e=>e.value==='valid failure')&&await page.$eval('[name=slug]',e=>e.value==='valid-failure')&&await page.$eval('[name=locales]',e=>e.value==='en')&&await page.$eval('form.create button',e=>e.disabled)&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  check('no project validation runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
