// Real local browser -> form backup edit/revert -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55746, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
const downloadDir=mkdtempSync(join(tmpdir(),'ol-project-draft-'));process.exitCode = 1;
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
  const predecessor=await call(`${P}/tasks`,{title:'Predecessor'},token);await call(`${P}/keys`,{name:'lock.key'},token);
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  const downloaded=async file=>{const path=join(downloadDir,file);for(let n=0;n<100&&!existsSync(path);n++)await new Promise(r=>setTimeout(r,20));const data=JSON.parse(readFileSync(path,'utf8'));rmSync(path);return data;};
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}req.continue();});
  const cases=[{kind:'projects',url:'/projects',selector:'ol-projects',download:'downloadProjectDraft',notice:'projectDraftDownloadNotice',file:'new-project-form.json',fields:['name','slug','locales']},{kind:'tasks',url:`${P}/tasks`,selector:'ol-tasks',download:'downloadTaskDraft',notice:'taskDraftDownloadNotice',file:'new-task-form.json',fields:['taskTitle','taskDescription','taskDue','taskAssignee','taskDependsOn','taskLockKeys','taskLockToggle']}];
  for(const c of cases){
    await page.goto(WEB+c.url,{waitUntil:'networkidle0'});await page.waitForFunction(sel=>{const c=ng.getComponent(document.querySelector(sel));return sel==='ol-projects'?!c.projectsLoading():!c.loading()&&!c.keysLoading()&&!c.membersLoading();}, {},c.selector);
    await page.$eval(`[name=${c.fields[0]}]`,e=>{e.value='original';e.dispatchEvent(new Event('input',{bubbles:true}));});const before={reads,writes};
    for(const name of c.fields){
      await page.$eval(`[name=${c.download}]`,e=>e.click());const data=await downloaded(c.file);await page.waitForSelector(`[name=${c.notice}]`);
      await page.$eval(`[name=${name}]`,e=>{if(e.type==='checkbox'){const v=e.checked;e.checked=!v;e.dispatchEvent(new Event('change',{bubbles:true}));e.checked=v;e.dispatchEvent(new Event('change',{bubbles:true}));}else if(e.tagName==='SELECT'){const values=[...e.options].map(o=>o.selected);if(e.multiple){if(e.options.length)e.options[0].selected=!e.options[0].selected;}else e.selectedIndex=e.options.length>1?(e.selectedIndex===0?1:0):0;e.dispatchEvent(new Event('change',{bubbles:true}));[...e.options].forEach((o,i)=>o.selected=values[i]);e.dispatchEvent(new Event('change',{bubbles:true}));}else{const value=e.value;e.value=e.type==='date'?'2027-01-01':'edited';e.dispatchEvent(new Event('input',{bubbles:true}));e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}});
      await page.waitForFunction(notice=>!document.querySelector(`[name=${notice}]`),{},c.notice);check(`${c.kind} ${name} edit/revert cannot revive old backup notice or redownload`,(data.draft.name??data.draft.title)==='original'&&reads===before.reads&&writes===before.writes&&readdirSync(downloadDir).length===0);
    }
    await page.evaluate(()=>{window.savedCreateObjectURL=URL.createObjectURL;URL.createObjectURL=()=>{throw new Error('PRIVATE_DOWNLOAD');};});await page.$eval(`[name=${c.download}]`,e=>e.click());await page.waitForSelector(`[name=${c.notice}]`);await page.$eval(`[name=${c.fields[0]}]`,e=>{e.value='edited';e.dispatchEvent(new Event('input',{bubbles:true}));e.value='original';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(notice=>!document.querySelector(`[name=${notice}]`),{},c.notice);check(`${c.kind} failed-backup notice also cannot revive or leak detail`,reads===before.reads&&writes===before.writes&&!(await page.content()).includes('PRIVATE_DOWNLOAD'));await page.evaluate(()=>URL.createObjectURL=window.savedCreateObjectURL);
    await page.$eval(`[name=${c.download}]`,e=>e.click());const fresh=await downloaded(c.file);await page.waitForSelector(`[name=${c.notice}]`);check(`${c.kind} fresh explicit backup gives current form feedback with no API effects`,(fresh.draft.name??fresh.draft.title)==='original'&&reads===before.reads&&writes===before.writes);
    if(c.kind==='projects'){await page.type('[name=tfaSetupPassword]','PRIVATE_SECURITY');check('security input independent of project backup feedback',!!await page.$(`[name=${c.notice}]`));await page.$eval('[name=tfaSetupPassword]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});}
    if(c.kind==='tasks'){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/form-backup-edit-revert-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/form-backup-edit-revert-mobile.png',fullPage:true});check('390px backup feedback fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  }
  check('no backup edit/revert runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
finally {
  await browser?.close();rmSync(downloadDir,{recursive:true,force:true});
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
