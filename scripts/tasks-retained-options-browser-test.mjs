// Real local browser -> Tasks option recovery -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55750, WEB_PORT = 4200, API_PORT = 3000;
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


  await call(`${P}/tasks`,{title:'Existing task'},token);const group=await call(`${P}/groups`,{name:'Real translators',role:'MEMBER',allowedLocales:['he']},token);const key=await call(`${P}/keys`,{name:'real.lock.key'},token);const next=await call('/projects',{name:'Next',slug:'next-retained',locales:['en','he']},token);
  await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));return !c.loading()&&!c.membersLoading()&&!c.groupsLoading()&&!c.keysLoading();});
  const member=await page.$eval('[name=taskAssignee]',e=>[...e.options].find(o=>o.textContent==='Owner').value);await page.type('[name=taskTitle]','Keep form');await page.select('[name=taskAssignee]',member);await page.select('[name=taskLockKeys]',await page.$eval('[name=taskLockKeys]',e=>[...e.options].find(o=>o.textContent==='real.lock.key').value));const taskIds=await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).tasks().map(t=>t.id));
  let reads=0,writes=0,missing=false,failed=false;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(req.method()==='GET'&&['members','groups','keys'].some(k=>path===`/api${P}/${k}`)){if(failed)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_OPTIONS'})});if(missing)return req.respond({status:200,contentType:'application/json',body:'[]'});}}req.continue();});
  const reload=async()=>{await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));return Promise.all([c.loadMembers(),c.loadGroups(),c.loadKeys()]);});await page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));return !c.membersLoading()&&!c.groupsLoading()&&!c.keysLoading();});};
  check('loaded real selections initially show names without missing warning',!await page.$('[name=taskRetainedChoices]')&&await page.$eval('[name=taskAssignee]',e=>e.selectedOptions[0].textContent==='Owner'));
  missing=true;await reload();await page.waitForSelector('[name=taskRetainedChoices]');check('empty current option responses keep selected member and key visible without silently clearing IDs',await page.$eval('[name=taskAssignee]',(e,id)=>e.value===id&&e.selectedOptions[0].textContent.includes('unavailable'),member)&&await page.$eval('[name=taskLockKeys]',(e,id)=>[...e.selectedOptions].some(o=>o.textContent.includes('unavailable')),key.id)&&await page.$eval('[name=taskRetainedChoices]',e=>e.textContent.includes('not verified as available or allowed'))&&writes===0&&reads===3);
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'new-task-form.json');await page.$eval('[name=downloadTaskDraft]',e=>e.click());for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const data=JSON.parse(readFileSync(file,'utf8'));rmSync(file);check('actual form backup retains unverified selected IDs, not invented availability',data.draft.assigneeSelection===member&&JSON.stringify(data.draft.keyIds)===JSON.stringify([key.id])&&data.selectedIdsVerified===false&&writes===0&&reads===3);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/tasks-retained-options-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/tasks-retained-options-mobile.png',fullPage:true});check('390px retained selections and scope fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  failed=true;await reload();await page.waitForSelector('[name=taskMembersError]');check('failed option rereads preserve visible retained choices and ordinary task rows',await page.$eval('[name=taskAssignee]',(e,id)=>e.value===id,member)&&await page.$eval('[name=taskLockKeys]',(e,id)=>[...e.selectedOptions].some(o=>o.textContent.includes('unavailable')),key.id)&&await page.evaluate(ids=>JSON.stringify(ng.getComponent(document.querySelector('ol-tasks')).tasks().map(t=>t.id))===JSON.stringify(ids),taskIds)&&writes===0&&!(await page.content()).includes('PRIVATE_OPTIONS'));
  failed=false;missing=false;await reload();await page.waitForFunction(()=>!document.querySelector('[name=taskRetainedChoices]'));check('current option recovery restores labels without duplicated options or form reset',await page.$eval('[name=taskAssignee]',(e,id)=>e.value===id&&[...e.options].filter(o=>o.value===id).length===1&&e.selectedOptions[0].textContent==='Owner',member)&&await page.$eval('[name=taskLockKeys]',(e,id)=>e.selectedOptions[0]?.textContent==='real.lock.key'&&[...e.options].filter(o=>o.textContent==='real.lock.key').length===1,key.id)&&await page.$eval('[name=taskTitle]',e=>e.value==='Keep form')&&writes===0);
  await page.select('[name=taskAssignee]','g:'+group.id);missing=true;await reload();await page.waitForSelector('[name=taskRetainedChoices]');check('retained group uses the selected group ID without falling back to unassigned',await page.$eval('[name=taskAssignee]',(e,id)=>e.value==='g:'+id&&e.selectedOptions[0].textContent.includes('unavailable'),group.id));
  await page.select('[name=taskAssignee]','');await page.select('[name=taskLockKeys]');await page.waitForFunction(()=>!document.querySelector('[name=taskRetainedChoices]'));check('explicit clear removes unavailable selections locally without requests',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-tasks'));return c.assigneeId()===''&&c.selectedKeyIds().length===0&&c.title()==='Keep form';})&&writes===0);
  missing=false;await reload();await page.select('[name=taskAssignee]',member);await page.select('[name=taskLockKeys]',await page.$eval('[name=taskLockKeys]',e=>[...e.options].find(o=>o.textContent==='real.lock.key').value));missing=true;await reload();await page.waitForSelector('[name=taskRetainedChoices]');await page.$eval('[name=resetTaskDraft]',e=>e.click());await page.waitForSelector('[name=taskDraftResetConfirm]');await page.$eval('[name=confirmTaskDraftReset]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=taskRetainedChoices]'));check('explicit local discard clears retained IDs without server effects',writes===0&&await page.$eval('[name=taskTitle]',e=>e.value===''));
  missing=false;await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${next.id}/tasks`);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-tasks')).loading());check('reused project does not retain old unavailable-choice warnings',!await page.$('[name=taskRetainedChoices]')&&await page.$eval('[name=taskAssignee]',e=>e.value==='')&&writes===0);
  check('no retained-option runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
