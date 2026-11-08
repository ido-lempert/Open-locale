// Real local browser -> new-project form reset -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55738, WEB_PORT = 4200, API_PORT = 3000;
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
  await page.type('[name=name]',' Raw project [A] ');await page.type('[name=slug]','draft-project');await page.type('[name=locales]','en, he, ');await page.type('[name=tfaSetupPassword]','PRIVATE_SECURITY_INPUT');
  let posts=0,reads=0,hold=false,held,drop=false,failRead=false;
  await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads++;else posts++;}if(path==='/api/projects'&&req.method()==='POST'){if(hold){held=req;return;}if(drop){const r=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('fixture commit failed');await r.json();return req.abort('failed');}}if(path==='/api/projects'&&req.method()==='GET'&&failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ'})});req.continue();});
  const form=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-projects'));return [c.name(),c.slug(),c.locales()];});
  const original=await form();await page.click('[name=resetProjectDraft]');await page.waitForSelector('[name=projectDraftResetConfirm]');check('inline prompt preserves current form with zero API effects',JSON.stringify(await form())===JSON.stringify(original)&&posts===0&&reads===0);await page.click('[name=keepProjectDraft]');await page.waitForFunction(()=>!document.querySelector('[name=projectDraftResetConfirm]'));check('Keep preserves exact local form',JSON.stringify(await form())===JSON.stringify(original));
  await page.click('[name=resetProjectDraft]');await page.type('[name=name]',' newer');await page.waitForFunction(()=>!document.querySelector('[name=projectDraftResetConfirm]'));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-projects')).confirmDraftReset());check('edit invalidates captured confirmation without clearing newer text',(await form())[0].endsWith(' newer')&&posts===0&&reads===0);
  await page.click('[name=resetProjectDraft]');await page.evaluate(()=>scrollTo(0,0));await page.$eval('[name=tfaSetupPassword]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.screenshot({path:'/downloads/projects-draft-reset-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/projects-draft-reset-mobile.png',fullPage:true});check('390px reset confirmation fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.type('[name=tfaSetupPassword]','PRIVATE_SECURITY_INPUT');await page.click('[name=confirmProjectDraftReset]');await page.waitForSelector('[name=projectDraftResetNotice]');check('confirmed reset clears local fields only with security/project data and zero requests retained',JSON.stringify(await form())===JSON.stringify(['','',''])&&await page.$eval('[name=tfaSetupPassword]',e=>e.value==='PRIVATE_SECURITY_INPUT')&&await page.$eval('.cards',e=>e.textContent.includes('Sync browser'))&&posts===0&&reads===0&&!await page.$('[name=projectDraftResetConfirm]'));
  await page.type('[name=name]','Unknown reset');await page.type('[name=slug]','unknown-reset');await page.type('[name=locales]','en, he');await page.waitForFunction(()=>!document.querySelector('[name=projectDraftResetNotice]'));hold=true;await page.$eval('form.create',e=>e.requestSubmit());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>document.querySelector('[name=resetProjectDraft]')?.disabled);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-projects'));c.askDraftReset();c.confirmDraftReset();});check('held real POST blocks reset without clearing submitted form',posts===1&&(await form())[0]==='Unknown reset'&&!await page.$('[name=projectDraftResetConfirm]'));hold=false;drop=true;await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=projectCreating]'));drop=false;
  // Use a second real creation with a committed response deliberately dropped.
  await page.$eval('[name=name]',e=>{e.value='Committed unseen reset';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.$eval('[name=slug]',e=>{e.value='committed-reset';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.$eval('[name=locales]',e=>{e.value='en';e.dispatchEvent(new Event('input',{bubbles:true}));});drop=true;await page.$eval('form.create',e=>e.requestSubmit());await page.waitForSelector('[name=projectCreateUnknown]');drop=false;const beforePosts=posts,beforeReads=reads;await page.waitForFunction(()=>!document.querySelector('[name=resetProjectDraft]')?.disabled);await page.click('[name=resetProjectDraft]');await page.waitForSelector('[name=confirmProjectDraftReset]');await page.click('[name=confirmProjectDraftReset]');await page.waitForSelector('[name=projectDraftResetNotice]');check('real committed then lost creation stays unknown after local discard with no replay/read',posts===beforePosts&&reads===beforeReads&&JSON.stringify(await form())===JSON.stringify(['','',''])&&!!await page.$('[name=projectCreateUnknown]')&&await page.$eval('form.create button[type=submit]',e=>e.disabled)&&(await call('/projects',null,token)).some(p=>p.slug==='committed-reset'));
  failRead=true;await page.click('[name=refreshProjects]');await page.waitForSelector('[name=retryProjects]');await page.type('[name=name]','Keepable despite failed read');await page.waitForFunction(()=>!document.querySelector('[name=resetProjectDraft]')?.disabled);await page.click('[name=resetProjectDraft]');await page.waitForSelector('[name=confirmProjectDraftReset]');await page.click('[name=confirmProjectDraftReset]');check('failed recovery does not block local discard or clear creation uncertainty',posts===beforePosts&&reads===beforeReads+1&&!!await page.$('[name=projectCreateUnknown]')&&(await form())[0]==='');failRead=false;await page.click('[name=retryProjects]');await page.waitForFunction(()=>!document.querySelector('[name=projectsLoading]')&&!document.querySelector('[name=projectCreateUnknown]'));check('only explicit current project read resolves uncertainty without creation',posts===beforePosts&&reads===beforeReads+2);
  await page.type('[name=name]','departed');await page.click('[name=resetProjectDraft]');await page.evaluate(()=>{window.oldProjects=ng.getComponent(document.querySelector('ol-projects'));history.pushState({},'','/account/identities');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-projects'));check('departure rejects captured confirmation',await page.evaluate(()=>{window.oldProjects.confirmDraftReset();return window.oldProjects.name()==='departed'&&!window.oldProjects.draftResetPending();}));check('no reset runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
