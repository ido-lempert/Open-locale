// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55734, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-create-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_create_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_create_browser`;
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
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);await page.goto(`${WEB}/projects`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('[name=projectsLoading]'));
  check('empty project form has no draft feedback',!await page.$('[name=projectLocalDraft]'));await page.type('[name=tfaSetupPassword]','LOCAL_TEST_PASSWORD');check('security input alone does not count as project draft',!await page.$('[name=projectLocalDraft]'));await page.$eval('[name=tfaSetupPassword]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});
  let held,posts=0,reads=0,hold=true,drop=false,failRead=false;await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path==='/api/projects'&&req.method()==='POST'){posts++;if(hold){held=req;return;}if(drop){const r=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('create failed');await r.json();return req.abort('failed');}}if(path==='/api/projects'&&req.method()==='GET'){reads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ'})});}req.continue();});
  await page.type('[name=name]','Local project');await page.type('[name=slug]','local-project');await page.type('[name=locales]','en, he');await page.waitForSelector('[name=projectLocalDraft]');check('raw project draft explains no persistence/copy scope without API effects',posts===0&&reads===0&&await page.$eval('[name=projectLocalDraft]',e=>e.textContent.includes('not automatically saved or restored')&&e.textContent.includes('a copy does not create a project')));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/projects-local-draft-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/projects-local-draft-mobile.png',fullPage:true});check('390px new-project feedback fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.$eval('form.create',e=>e.requestSubmit());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.waitForSelector('[name=projectCreating]');check('held creation distinguishes editable current form from submitted project',posts===1&&reads===0&&await page.$eval('[name=projectLocalDraft]',e=>e.textContent.includes('may differ from the submitted project')&&e.textContent.includes('Do not create again')));await page.$eval('[name=name]',e=>{e.value='Newer project';e.dispatchEvent(new Event('input',{bubbles:true}));});hold=false;failRead=true;await held.continue();held=null;await page.waitForSelector('[name=retryProjects]');await page.waitForFunction(()=>!document.querySelector('[name=projectCreating]'));check('confirmed create with failed follow-up read keeps newer local form/receipt, not unknown',posts===1&&reads===1&&await page.$eval('[name=name]',e=>e.value==='Newer project')&&await page.$eval('[name=projectLocalDraft]',e=>e.textContent.includes('not automatically saved'))&&await page.$('[name=projectCreateNotice]')&&!await page.$('[name=projectCreateUnknown]'));
  failRead=false;await page.$eval('[name=retryProjects]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=projectsLoading]'));await page.$eval('[name=slug]',e=>{e.value='newer-project';e.dispatchEvent(new Event('input',{bubbles:true}));});drop=true;await page.$eval('form.create',e=>e.requestSubmit());await page.waitForSelector('[name=projectCreateUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=projectCreating]'));const actual=await call('/projects',null,token);check('real committed then lost response stays explicitly unconfirmed not unsaved-server state',posts===2&&reads===2&&actual.some(p=>p.slug==='newer-project')&&await page.$eval('[name=projectLocalDraft]',e=>e.textContent.includes('creation is unconfirmed')&&!e.textContent.includes('not automatically saved')));
  failRead=true;await page.$eval('[name=refreshProjects]',e=>e.click());await page.waitForSelector('[name=retryProjects]');check('failed recovery keeps uncertain local form/copy guidance with no replay',posts===2&&reads===3&&await page.$eval('[name=projectLocalDraft]',e=>e.textContent.includes('Copy the form before leaving'))&&!(await page.content()).includes('PRIVATE_READ'));
  failRead=false;await page.$eval('[name=retryProjects]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=projectsLoading]')&&!document.querySelector('[name=projectCreateUnknown]'));check('explicit current recovery returns local form scope without clearing form',posts===2&&reads===4&&await page.$eval('[name=name]',e=>e.value==='Newer project')&&await page.$eval('[name=projectLocalDraft]',e=>e.textContent.includes('not automatically saved')));
  drop=false;await page.$eval('[name=slug]',e=>{e.value='confirmed-next';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.$eval('form.create',e=>e.requestSubmit());await page.waitForFunction(()=>!document.querySelector('[name=projectCreating]')&&document.querySelector('[name=projectCreateNotice]')?.textContent.includes('was created'));check('confirmed unchanged form clears draft feedback but keeps receipt',posts===3&&reads===5&&!await page.$('[name=projectLocalDraft]')&&await page.$eval('[name=name]',e=>e.value==='')&&await page.$('[name=projectCreateNotice]'));
  await page.type('[name=locales]','en, ');await page.waitForSelector('[name=projectLocalDraft]');check('locale-only input counts as raw local draft',await page.$eval('[name=name]',e=>e.value===''));await page.$eval('[name=locales]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>!document.querySelector('[name=projectLocalDraft]'));check('clearing raw fields removes local feedback without requests',posts===3&&reads===5);check('no project-draft runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(process.exitCode??1);
