// Real local browser -> Webhook journal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55710, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
const downloadDir=mkdtempSync(join(tmpdir(),'ol-webhook-download-'));
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-webhook-journal-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('webhook_journal_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/webhook_journal_browser`;
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


  const task=await call(`${P}/tasks`,{title:'Task [A]',description:'PRIVATE_DESCRIPTION',assigneeId:owner.user.id},token);await call(`${P}/tasks`,{title:'Task B',description:'PRIVATE_DESCRIPTION'},token);const emptyProject=await call('/projects',{name:'Empty',slug:'empty',locales:['en']},token),initial=await call(`${P}/tasks?status=OPEN`,undefined,token);
  const projectRows=rows=>rows.map(t=>({id:t.id,title:t.title,status:t.status,dueDate:t.dueDate,assigneeName:t.assignee?.displayName??null,assigneeGroupName:t.assigneeGroup?.name??null,dependsOnId:t.dependsOn?.id??null,lockKeys:t.lockKeys,keys:t.keys.map(({key})=>({id:key.id,name:key.name}))}));
  await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.querySelectorAll('.task-row').length===2);await page.select('[aria-label="Filter by status"]','OPEN');await page.waitForFunction(()=>!document.querySelector('[name=taskListLoading]'));const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  const file=join(downloadDir,'task-metadata.json'),readDownload=async()=>{for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));if(!existsSync(file))throw new Error('download not finished');return JSON.parse(readFileSync(file,'utf8'));};
  let reads=0,writes=0,held,hold=false,fail=false,unknown=false;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(u.pathname.endsWith('/tasks')&&req.method()==='GET'){if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_API'})});if(hold){held=req;return;}}if(unknown&&req.method()==='PATCH'&&u.pathname.endsWith(`/tasks/${task.id}`))return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_PATCH'})});}req.continue();});
  await page.type('[name=taskSearch]','[a]');await page.waitForFunction(()=>document.querySelectorAll('.task-row').length===1);await call(`${P}/tasks`,{title:'Newer unread'},token);await page.$eval('[name=downloadTasks]',e=>e.click());const report=await readDownload();check('actual JSON exact all loaded tasks despite local search and newer unread task',isDeepStrictEqual(report,{schemaVersion:1,projectId:project.id,scope:'all-loaded-filtered-tasks',filters:{status:'OPEN',mine:false},tasks:projectRows(initial)})&&report.tasks.length===2);check('local export has no API effects, excludes description/emails/creator with bounded notice',reads===0&&writes===0&&!JSON.stringify(report).includes('PRIVATE_')&&!JSON.stringify(report).includes('sync-owner@example.com')&&await page.$eval('[name=taskDownloadNotice]',e=>e.textContent.includes('does not confirm')));await page.screenshot({path:'/downloads/tasks-download-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/tasks-download-mobile.png',fullPage:true});check('narrow scope/button/feedback readable without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));rmSync(file);
  hold=true;await page.$eval('[name=refreshTaskList]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=downloadTasks]')?.disabled&&!document.querySelector('[name=taskDownloadNotice]'));for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).download());check('pending read clears notice and captured export cannot use old list',readdirSync(downloadDir).length===0&&reads===1);hold=false;await held.continue();held=null;await page.waitForFunction(()=>!document.querySelector('[name=taskListLoading]'));await page.$eval('[name=downloadTasks]',e=>e.click());const fresh=await readDownload();check('explicit current read includes newer task while local search remains',fresh.tasks.length===3&&fresh.tasks.some(t=>t.title==='Newer unread')&&reads===1&&writes===0&&await page.$eval('[name=taskSearch]',e=>e.value==='[a]'));rmSync(file);
  unknown=true;await page.select('[aria-label="Status for Task [A]"]','DONE');await page.waitForSelector('[name=taskActionUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=taskUpdating]'));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).download());check('real uncertain row mutation disables export and clears earlier notice without automatic read',writes===1&&reads===1&&await page.$eval('[name=downloadTasks]',e=>e.disabled)&&!await page.$('[name=taskDownloadNotice]')&&readdirSync(downloadDir).length===0);unknown=false;await page.$eval('[name=recoverTaskActions]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=taskActionUnknown]')&&!document.querySelector('[name=taskListLoading]')&&!document.querySelector('[name=downloadTasks]')?.disabled);
  fail=true;await page.$eval('[name=refreshTaskList]',e=>e.click());await page.waitForSelector('[name=retryTaskList]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-tasks')).download());check('failed read rejects export without raw detail or false empty',await page.$eval('[name=downloadTasks]',e=>e.disabled)&&readdirSync(downloadDir).length===0&&!(await page.content()).includes('PRIVATE_API')&&!await page.$('[name=taskListEmpty]'));
  fail=false;await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${emptyProject.id}/tasks`);await page.waitForSelector('[name=taskListEmpty]');await page.waitForFunction(()=>!document.querySelector('[name=downloadTasks]')?.disabled);await page.$eval('[name=downloadTasks]',e=>e.click());const empty=await readDownload();check('empty new project exports new exact scope without previous tasks',empty.projectId===emptyProject.id&&empty.tasks.length===0&&isDeepStrictEqual(empty.filters,{status:'',mine:false}));rmSync(file);
  await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('PRIVATE_DOWNLOAD');};ng.getComponent(document.querySelector('ol-tasks')).download();});await page.waitForFunction(()=>document.querySelector('[name=taskDownloadNotice]')?.textContent.includes('could not be started'));check('local failure guidance excludes raw detail',!(await page.content()).includes('PRIVATE_DOWNLOAD'));
  await page.evaluate(()=>{window.oldTasks=ng.getComponent(document.querySelector('ol-tasks'));window.afterDestroy=0;URL.createObjectURL=()=>{window.afterDestroy++;return 'blob:local';};history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-tasks'));await page.evaluate(()=>window.oldTasks.download());check('departed captured handler cannot export',await page.evaluate(()=>window.afterDestroy===0)&&readdirSync(downloadDir).length===0);
  check('no task download runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
