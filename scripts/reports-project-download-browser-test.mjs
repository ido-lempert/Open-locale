// Real local browser -> Project dashboard download -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55723, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;const downloadDir=mkdtempSync(join(tmpdir(),'ol-project-dashboards-'));
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
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


  await call(`${P}/branches`,{name:'release'},token);await call(`${P}/import/en`,{entries:{title:'Private translation not in dashboard'}},token);await call(`${P}/tasks`,{title:'Private task title',description:'Private task description'},token);
  await page.goto(`${WEB}${P}/reports`,{waitUntil:'networkidle0'});await page.select('[name=usageDays]','7');await page.waitForFunction(()=>!document.querySelector('[name=usageLoading]')&&!document.querySelector('[name=tasksLoading]'));await page.evaluate(()=>window.rc=ng.getComponent(document.querySelector('ol-reports')));
  const loaded=await page.evaluate(()=>({usage:window.rc.usage(),tasks:window.rc.taskReport()}));const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  let reads=0,writes=0,hold='',fail='',held=[];await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;const name=['usage','tasks','progress','quality'].find(n=>path===`/api${P}/reports/${n}`);if(name&&fail===name)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE FAILURE'})});if(name&&hold===name){held.push(req);return;}}req.continue();});
  const file=join(downloadDir,'project-dashboards.json');const download=async()=>{await page.click('[name=downloadProjectReports]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const text=readFileSync(file,'utf8'),data=JSON.parse(text);rmSync(file);return {text,data};};
  const {text,data}=await download();
  check('actual JSON includes real loaded project usage/task counts and individual captured windows',data.schemaVersion===1&&data.projectId===project.id&&data.scope==='loaded-project-dashboards'&&data.singleDatabaseSnapshot===false&&data.usage.days===7&&data.usage.totalEvents===loaded.usage.totalEvents&&data.usage.totalEvents>0&&data.usage.since===loaded.usage.since&&data.usage.asOf===loaded.usage.asOf&&data.tasks.total===1&&data.tasks.asOf===loaded.tasks.asOf&&data.tasks.dueSoonThrough===loaded.tasks.dueSoonThrough&&JSON.stringify(data.tasks.perAssignee)===JSON.stringify(loaded.tasks.perAssignee));
  check('local file has no translation/task content or branch reports and no API effects',!text.includes('Private translation')&&!text.includes('Private task')&&!('byDay' in data.usage)&&!('progress' in data)&&!('branch' in data)&&reads===0&&writes===0);
  await page.waitForSelector('[name=projectDownloadNotice]');check('scope and bounded notice name separate reads/private identities/not shared',await page.$eval('[name=projectDownloadScope]',e=>e.textContent.includes('Separate reads')&&e.textContent.includes('private actor/assignee names and IDs'))&&await page.$eval('[name=projectDownloadNotice]',e=>e.textContent.includes('does not confirm')));
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:0,behavior:'instant'});});await page.waitForFunction(()=>scrollY===0);await page.$eval('main',e=>e.scrollTop=0);await page.screenshot({path:'/downloads/project-dashboards-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/project-dashboards-mobile.png',fullPage:true});check('390px download control and scope fit without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=downloadProjectReports]',e=>e.getBoundingClientRect().right<=390));await page.setViewport({width:1280,height:900});
  await call(`${P}/tasks`,{title:'New unread task'},token);const unread=await download();check('download excludes newer unread task state without refreshing',unread.data.tasks.total===1&&reads===0&&writes===0);
  hold='usage';await page.click('[name=refreshUsageReport]');await page.waitForSelector('[name=usageLoading]');await page.evaluate(()=>window.rc.downloadProject());check('pending usage blocks captured export and clears prior feedback while task figures remain',await page.$eval('[name=downloadProjectReports]',e=>e.disabled)&&!await page.$('[name=projectDownloadNotice]')&&readdirSync(downloadDir).length===0&&await page.evaluate(()=>window.rc.taskReport().total===1));for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));hold='';for(const r of held.splice(0))await r.continue();await page.waitForFunction(()=>!document.querySelector('[name=usageLoading]'));
  fail='tasks';await page.click('[name=refreshTaskReport]');await page.waitForSelector('[name=taskReportError]');await page.evaluate(()=>window.rc.downloadProject());check('failed task read blocks export with fixed guidance and independent usage retained',await page.$eval('[name=downloadProjectReports]',e=>e.disabled)&&readdirSync(downloadDir).length===0&&!(await page.content()).includes('PRIVATE FAILURE')&&await page.evaluate(()=>!!window.rc.usage()));
  fail='';hold='tasks';await page.click('[name=retryTasks]');await page.waitForSelector('[name=tasksLoading]');await page.evaluate(()=>window.rc.downloadProject());check('pending task read also blocks direct export',await page.$eval('[name=downloadProjectReports]',e=>e.disabled)&&readdirSync(downloadDir).length===0);for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));hold='';for(const r of held.splice(0))await r.continue();await page.waitForFunction(()=>!document.querySelector('[name=tasksLoading]'));const fresh=await download();check('successful current task reread enables export with newly persisted figures',fresh.data.tasks.total===2&&writes===0);
  fail='quality';await page.select('[name=reportBranch]','release');await page.waitForSelector('[name=branchReportError]');const independent=await download();check('branch failure does not block project dashboards or change their scope',independent.data.tasks.total===2&&!('branch' in independent.data)&&independent.data.usage.days===7);fail='';
  const emptyProject=await call('/projects',{name:'Empty',slug:'empty-dashboard',locales:['en','he']},token);await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${emptyProject.id}/reports`);await page.waitForFunction(()=>!document.querySelector('[name=usageLoading]')&&!document.querySelector('[name=tasksLoading]')&&!!ng.getComponent(document.querySelector('ol-reports')).taskReport());const empty=await download();check('reused project exports only current empty dashboards and reset usage window',empty.data.projectId===emptyProject.id&&empty.data.usage.days===30&&empty.data.tasks.total===0);
  await page.evaluate(()=>{window.lastReports=ng.getComponent(document.querySelector('ol-reports'));history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-reports'));await page.evaluate(()=>window.lastReports.downloadProject());check('departed captured download cannot create file',readdirSync(downloadDir).length===0);
  check('no project dashboard download runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
