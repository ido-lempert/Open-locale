// Real local browser -> Reports screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.REPORT_TABLE_LAYOUT_TEST_PG_PORT ?? 56353), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const downloadDir=mkdtempSync(join(tmpdir(),'ol-report-layout-download-'));
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-report-count-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('report_layout_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/report_layout_browser`;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  await page.goto(`${WEB}${P}/reports`,{waitUntil:'networkidle0'});await page.waitForSelector('.progress-table');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-reports')).usageLoading()&&!ng.getComponent(document.querySelector('ol-reports')).tasksLoading());
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}req.continue();});
  const initial=await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-reports')),columns=['toString','__proto__','constructor','OPEN'],own=JSON.parse('{"toString":3,"__proto__":4,"constructor":5,"OPEN":6}'),rows=['en','he'].map((locale,i)=>({locale,total:20,translated:10,untranslated:10,percent:50,byStatus:i?{}:own,byType:i?{}:own}));c.statusColumns.set(columns);c.report.set({...c.report(),locales:rows});c.quality.set({...c.quality(),types:columns,totalIssues:18,locales:rows});c.taskReport.set({...c.taskReport(),byStatus:{}});return JSON.stringify({progress:c.report(),quality:c.quality(),tasks:c.taskReport()});});await page.waitForFunction(()=>document.querySelectorAll('.quality-table tbody tr').length===2);
  for(const [selector,offset] of [['.progress-table',4],['.quality-table',2]])check('own counts and absent cross-row prototype names '+selector,await page.$$eval(selector+' tbody tr',(rs,o)=>JSON.stringify(rs.map(r=>Array.from(r.cells).slice(o).map(c=>c.textContent.trim()))),offset)===JSON.stringify([['3','4','5','6'],['0','0','0','0']]));check('task absent status summary remains zero',await page.evaluate(()=>document.body.textContent.includes('0 open, 0 in progress, 0 done.')));check('no inherited function or object display',await page.evaluate(()=>!document.body.textContent.includes('function toString')&&!document.body.textContent.includes('[object Object]')));
  check('report scroll regions have distinct accessible names and keyboard stops',await page.$$eval('.table-scroll',es=>es.length===4&&new Set(es.map(e=>e.getAttribute('aria-label'))).size===4&&es.every(e=>e.tabIndex===0&&e.getAttribute('role')==='region')));
  const spaced=()=>page.$$eval('.quality-table th,.quality-table td,.usage-table th,.usage-table td,.tasks-table th,.tasks-table td',es=>es.every(e=>{const s=getComputedStyle(e);return parseFloat(s.paddingLeft)>=12&&parseFloat(s.paddingTop)>=7&&parseFloat(s.borderBottomWidth)>=1;}));check('QA usage and workload cells have separated headers counts and row borders',await spaced());
  const bad=await page.addStyleTag({content:'.qa-table:not(.progress-table) th,.qa-table:not(.progress-table) td{padding:0!important;border:0!important}'});check('negative old-layout spacing probe is detected',!await spaced());await bad.evaluate(e=>e.remove());check('spacing restored after isolated negative probe',await spaced());
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/reports-layout-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.$eval('.quality-table',e=>{e.parentElement.scrollLeft=e.scrollWidth;e.scrollIntoView({block:'center'});});await page.screenshot({path:'/downloads/reports-layout-mobile.png'});check('390px tables scroll internally without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const region='[aria-label="Quality findings by locale"]';await page.$eval(region,e=>{e.scrollLeft=0;e.focus();});await page.keyboard.press('ArrowRight');await new Promise(r=>setTimeout(r,180));check('keyboard scroll reaches offscreen report columns',await page.$eval(region,e=>e.scrollLeft>0&&document.activeElement===e));await page.keyboard.press('Tab');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');check('focused region has visible outline',await page.$eval(region,e=>parseFloat(getComputedStyle(e).outlineWidth)>=2));
  await page.$eval(region,e=>{e.scrollLeft=e.scrollWidth;e.scrollIntoView({block:'center'});});await page.screenshot({path:'/downloads/reports-layout-mobile-focused.png'});
  await page.$eval('[name=reportLocaleSearch]',e=>{e.value='he';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>document.querySelectorAll('.quality-table tbody tr').length===1);check('locale filtering retains absent-count zeros',await page.$$eval('.quality-table tbody td',es=>es.slice(2).every(e=>e.textContent.trim()==='0')));
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__reportDownload=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.$eval('[name=downloadBranchReports]',e=>e.click());await page.waitForFunction(()=>!!window.__reportDownload);check('download retains exact raw full report maps not projected zeros',await page.evaluate(raw=>{const i=JSON.parse(raw);return JSON.stringify(window.__reportDownload.progress)===JSON.stringify(i.progress)&&JSON.stringify(window.__reportDownload.quality)===JSON.stringify(i.quality);},initial));check('display and filter do not repair sources or fetch or mutate',await page.evaluate(raw=>{const i=JSON.parse(raw),c=ng.getComponent(document.querySelector('ol-reports'));return JSON.stringify(c.report())===JSON.stringify(i.progress)&&JSON.stringify(c.quality())===JSON.stringify(i.quality)&&JSON.stringify(c.taskReport())===JSON.stringify(i.tasks);},initial)&&reads===0&&writes===0);check('no own-count runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(!completed||failures?1:0);
