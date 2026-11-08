// Real local browser -> Reports screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55754, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const downloadDir=mkdtempSync(join(tmpdir(),'ol-new-term-download-'));
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-glossary-create-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('glossary_create_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/glossary_create_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he','fr']},token);
  const P=`/projects/${project.id}`;
  await call(`${P}/import/en`,{entries:{title:'Local title',conflict:'Local edit',remote:'Old text',empty:''}},token);
  await call(`${P}/tasks`,{title:'Actual task recovery'},token);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  await call(`${P}/import/en`,{entries:{greeting:'Hello {name}'}},token);await call(`${P}/import/he`,{entries:{greeting:'שלום'}},token);await call(`${P}/import/fr`,{entries:{greeting:'Bonjour'}},token);const next=await call('/projects',{name:'Next',slug:'next-report-search',locales:['en']},token);
  await page.goto(`${WEB}${P}/reports`,{waitUntil:'networkidle0'});await page.waitForSelector('.progress-table');await page.waitForSelector('.quality-table');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-reports')).usageLoading()&&!ng.getComponent(document.querySelector('ol-reports')).tasksLoading());const initial=await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-reports'));return {progress:c.report(),quality:c.quality(),usage:c.usage(),tasks:c.taskReport()};});
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}req.continue();});
  await page.type('[name=reportLocaleSearch]',' HE ');await page.waitForFunction(()=>document.querySelector('[name=progressLocaleMatches]')?.textContent.includes('1 of 3'));check('trimmed case-insensitive locale search filters both real loaded branch tables without requests',await page.$$eval('.progress-table tbody tr',es=>es.length===1&&es[0].textContent.includes('he'))&&await page.$$eval('.quality-table tbody tr',es=>es.length===1&&es[0].textContent.includes('he'))&&reads===0&&writes===0);
  check('totals and whole-project dashboards keep original loaded scope',await page.evaluate(i=>{const c=ng.getComponent(document.querySelector('ol-reports'));return JSON.stringify(c.report())===JSON.stringify(i.progress)&&JSON.stringify(c.quality())===JSON.stringify(i.quality)&&JSON.stringify(c.usage())===JSON.stringify(i.usage)&&JSON.stringify(c.taskReport())===JSON.stringify(i.tasks);},initial));
  await page.$eval('[name=reportLocaleSearch]',e=>{e.value='.*';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForSelector('[name=progressLocaleEmpty]');await page.waitForSelector('[name=qualityLocaleEmpty]');check('literal no-match shows table-specific filtered-empty guidance not no-findings claim',await page.$eval('[name=qualityLocaleEmpty]',e=>e.textContent.includes('Report totals are unchanged'))&&!await page.$('[name=qualityEmpty]')&&reads===0&&writes===0);
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'branch-reports.json');await page.$eval('[name=downloadBranchReports]',e=>e.click());for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const data=JSON.parse(readFileSync(file,'utf8'));rmSync(file);check('actual branch JSON keeps full loaded progress/quality despite no visible rows',JSON.stringify(data.progress)===JSON.stringify(initial.progress)&&JSON.stringify(data.quality)===JSON.stringify(initial.quality)&&reads===0&&writes===0);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/reports-locale-search-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/reports-locale-search-mobile.png',fullPage:true});check('390px search scope/counts/filtered-empty tables fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.$eval('[name=clearReportLocaleSearch]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=progressLocaleMatches]')?.textContent.includes('3 of 3'));check('clear restores all loaded rows locally',await page.$$eval('.progress-table tbody tr',es=>es.length===3)&&reads===0&&writes===0);
  await page.type('[name=reportLocaleSearch]','he');await page.$eval('[name=refreshBranchReports]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=branchReportLoading]')&&document.querySelector('[name=progressLocaleMatches]')?.textContent.includes('1 of 3'));check('explicit current branch refresh retains search and only reads progress/quality',reads===2&&writes===0&&await page.$eval('[name=reportLocaleSearch]',e=>e.value==='he')&&await page.evaluate(i=>JSON.stringify(ng.getComponent(document.querySelector('ol-reports')).usage())===JSON.stringify(i.usage),initial));
  await call(`${P}/branches`,{name:'release'},token);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-reports')).loadBranches());const beforeBranch=reads;await page.select('[name=reportBranch]','release');await page.waitForFunction(()=>!document.querySelector('[name=branchReportLoading]')&&ng.getComponent(document.querySelector('ol-reports')).report()?.branch==='release');check('branch change retains local locale search while replacing branch reports',await page.$eval('[name=reportLocaleSearch]',e=>e.value==='he')&&reads===beforeBranch+2&&writes===0);
  await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${next.id}/reports`);await page.waitForFunction(()=>!document.querySelector('[name=branchReportLoading]')&&ng.getComponent(document.querySelector('ol-reports')).projectId!==''&&ng.getComponent(document.querySelector('ol-reports')).report()?.totalKeys===0);check('reused project resets locale search and shows actual zero-quality state',await page.$eval('[name=reportLocaleSearch]',e=>e.value==='')&&!!await page.$('[name=qualityEmpty]'));
  await page.evaluate(()=>{window.oldReports=ng.getComponent(document.querySelector('ol-reports'));history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-reports'));await page.evaluate(()=>window.oldReports.setLocaleQuery('late'));check('departed locale search handler refuses',await page.evaluate(()=>window.oldReports.localeQuery()===''));
  check('no report locale search runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
