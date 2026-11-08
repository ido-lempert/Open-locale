// Real local browser -> Tasks loaded row choices -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55756, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const downloadDir=mkdtempSync(join(tmpdir(),'ol-retained-options-'));
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-list-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_list_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_list_browser`;
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


  const group=await call(`${P}/groups`,{name:'Real translators',role:'MEMBER',allowedLocales:['he']},token);
  const me=await prisma.user.findFirst({where:{email:'sync-owner@example.com'}});
  const predecessor=await call(`${P}/tasks`,{title:'Finished predecessor'},token);await call(`${P}/tasks/${predecessor.id}`,{status:'DONE'},token,'PATCH');
  const memberTask=await call(`${P}/tasks`,{title:'Member work',assigneeId:me.id,dependsOnId:predecessor.id},token);
  const groupTask=await call(`${P}/tasks`,{title:'Group work',assigneeGroupId:group.id,dependsOnId:predecessor.id},token);
  const next=await call('/projects',{name:'Next',slug:'next-row-retained',locales:['en']},token);
  let reads=0,writes=0,missing=true,failed=false;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(req.method()==='GET'&&['members','groups'].some(k=>path===`/api${P}/${k}`)){if(failed)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_OPTIONS'})});if(missing)return req.respond({status:200,contentType:'application/json',body:'[]'});}}req.continue();});
  await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));return !c.loading()&&!c.membersLoading()&&!c.groupsLoading();});
  const selector=title=>`select[aria-label="Assignee for ${title}"]`;
  check('loaded assigned member and group remain selected with missing current options',await page.$eval(selector('Member work'),(e,id)=>e.value===id&&e.selectedOptions[0].textContent.includes('outside options'),me.id)&&await page.$eval(selector('Group work'),(e,id)=>e.value==='g:'+id&&e.selectedOptions[0].textContent.includes('outside options'),group.id)&&writes===0);
  await page.select('select[aria-label="Filter by status"]','OPEN');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-tasks')).loading()&&ng.getComponent(document.querySelector('ol-tasks')).tasks().length===2);
  check('server filtered predecessor stays selected rather than blank or no predecessor',await page.$eval('select[aria-label="Depends on for Member work"]',(e,id)=>e.value===id&&e.selectedOptions[0].textContent.includes('Loaded predecessor'),predecessor.id)&&await page.$eval('select[aria-label="Depends on for Group work"]',(e,id)=>e.value===id,predecessor.id)&&writes===0);
  const before=reads;await page.$eval('[name=taskSearch]',e=>{e.value='Member';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>document.querySelectorAll('.task-row').length===1);check('local search retains loaded row choices without requests',reads===before&&writes===0&&await page.$eval(selector('Member work'),(e,id)=>e.value===id,me.id));
  await page.$eval('[name=clearTaskSearch]',e=>e.click());await page.waitForFunction(()=>document.querySelectorAll('.task-row').length===2);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/tasks-row-retained-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/tasks-row-retained-mobile.png',fullPage:true});check('390px loaded row warning and selectors fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const reload=async()=>{await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));return Promise.all([c.loadMembers(),c.loadGroups()]);});};
  failed=true;await reload();await page.waitForSelector('[name=taskMembersError]');check('failed independent option reads do not clear loaded row assignment or predecessor',await page.$eval(selector('Member work'),(e,id)=>e.value===id,me.id)&&await page.$eval('select[aria-label="Depends on for Member work"]',(e,id)=>e.value===id,predecessor.id)&&writes===0&&!(await page.content()).includes('PRIVATE_OPTIONS'));
  failed=false;missing=false;await reload();await page.waitForFunction(()=>document.querySelector('select[aria-label="Assignee for Member work"]').selectedOptions[0]?.textContent==='Owner');check('recovered options restore real names without duplicate values',await page.$eval(selector('Member work'),(e,id)=>e.value===id&&[...e.options].filter(o=>o.value===id).length===1,me.id)&&await page.$eval(selector('Group work'),(e,id)=>e.value==='g:'+id&&e.selectedOptions[0].textContent.includes('Real translators')&&[...e.options].filter(o=>o.value==='g:'+id).length===1,group.id)&&writes===0);
  await page.select('select[aria-label="Filter by status"]','');await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-tasks')).tasks().length===3&&!ng.getComponent(document.querySelector('ol-tasks')).loading());await page.waitForFunction(()=>!document.querySelector('[name=taskRowRetainedChoices]'));check('full list recovery restores real predecessor title without duplicate option',await page.$eval('select[aria-label="Depends on for Member work"]',(e,id)=>e.value===id&&e.selectedOptions[0].textContent.includes('Finished predecessor')&&[...e.options].filter(o=>o.value===id).length===1,predecessor.id)&&writes===0);
  missing=true;await reload();await page.waitForSelector('[name=taskRowRetainedChoices]');await page.select(selector('Member work'),'');await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-tasks')).tasks().find(t=>t.title==='Member work')?.assignee===null);check('explicit unassign still follows existing mutation route and persists',writes===1&&(await call(`${P}/tasks`,null,token)).find(t=>t.id===memberTask.id).assignee===null);
  await page.select('select[aria-label="Depends on for Member work"]','');await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-tasks')).tasks().find(t=>t.title==='Member work')?.dependsOn===null);check('explicit predecessor clear follows existing mutation route and persists',writes===2&&(await call(`${P}/tasks`,null,token)).find(t=>t.id===memberTask.id).dependsOn===null);
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).actionUnknown.set(true));await page.waitForFunction(()=>document.querySelector('select[aria-label="Assignee for Group work"]').disabled);check('missing-choice display does not enable paused row controls',await page.$eval(selector('Group work'),e=>e.disabled)&&await page.$eval('select[aria-label="Depends on for Group work"]',e=>e.disabled)&&writes===2);
  await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${next.id}/tasks`);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-tasks')).loading());check('reused project clears old row warnings and assignments',!await page.$('[name=taskRowRetainedChoices]')&&await page.$$eval('.task-row',es=>es.length===0)&&writes===2);
  check('no loaded row choice runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
