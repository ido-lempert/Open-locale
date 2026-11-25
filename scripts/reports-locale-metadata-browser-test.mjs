// Real local browser -> Reports screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.REPORT_LOCALE_META_TEST_PG_PORT ?? 56341), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  await page.goto(`${WEB}${P}/reports`,{waitUntil:'networkidle0'});await page.waitForSelector('.progress-table');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-reports')).usageLoading()&&!ng.getComponent(document.querySelector('ol-reports')).tasksLoading());
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}req.continue();});
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-reports'));c.statusColumns.set(['IN_PROGRESS',null,42,true,{},[]]);c.quality.set({...c.quality(),totalIssues:4,types:['placeholder_mismatch',null,42,true,{},[]]});});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
  const headings=()=>page.evaluate(()=>[...document.querySelectorAll('.progress-table thead tr:last-child th')].slice(2).map(e=>e.textContent).join('|')==='in_progress|Status unavailable|Status unavailable|Status unavailable|Status unavailable|Status unavailable'&&[...document.querySelectorAll('.quality-table thead th')].slice(2).map(e=>e.textContent).join('|')==='placeholder mismatch|Issue type unavailable|Issue type unavailable|Issue type unavailable|Issue type unavailable|Issue type unavailable');
  check('malformed status and quality headings use fixed fallback',await headings());
  await page.$eval('.quality-table thead th:nth-child(4)',e=>e.textContent='');check('negative blank malformed heading detected',!await headings());await page.$eval('.quality-table thead th:nth-child(4)',e=>e.textContent='Issue type unavailable');check('heading restored after isolated negative probe',await headings());
  await page.screenshot({path:'/downloads/reports-heading-types-desktop.png',fullPage:true});
  const initial=await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-reports')),values=[null,42,true,{},[],'pt-BR'],rows=values.map(locale=>({locale,total:2,translated:1,untranslated:1,progress:50,byStatus:{},byType:{}}));c.setLocaleQuery('pt-br');c.report.set({...c.report(),locales:rows});c.quality.set({...c.quality(),totalIssues:4,locales:rows});return {progress:c.report(),quality:c.quality(),usage:c.usage(),tasks:c.taskReport()};});
  await page.waitForFunction(()=>document.querySelector('[name=progressLocaleMatches]')?.textContent.includes('1 of 6'));check('both locale projections skip malformed fields and match valid string',await page.$eval('[name=qualityLocaleMatches]',e=>e.textContent.includes('1 of 6'))&&await page.$$eval('.progress-table tbody tr',es=>es.length===1&&es[0].textContent.includes('pt-BR'))&&reads===0&&writes===0);
  const search=async value=>{await page.$eval('[name=reportLocaleSearch]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));};for(const value of ['42','true','object']){await search(value);await page.waitForSelector('[name=qualityLocaleEmpty]');check('nonstring locale not coerced into query '+value,await page.$eval('[name=progressLocaleMatches]',e=>e.textContent.includes('0 of 6'))&&reads===0&&writes===0);}
  check('full reports totals and sibling dashboards unchanged',await page.evaluate(i=>{const c=ng.getComponent(document.querySelector('ol-reports'));return JSON.stringify(c.report())===JSON.stringify(i.progress)&&JSON.stringify(c.quality())===JSON.stringify(i.quality)&&JSON.stringify(c.usage())===JSON.stringify(i.usage)&&JSON.stringify(c.taskReport())===JSON.stringify(i.tasks);},initial));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/reports-locale-metadata-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=reportLocaleSearch]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/reports-locale-metadata-mobile.png'});check('390px locale search and filtered-empty guidance fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__reportDownload=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.$eval('[name=downloadBranchReports]',e=>e.click());await page.waitForFunction(()=>!!window.__reportDownload);check('branch download retains exact raw locale metadata in both full reports',await page.evaluate(i=>JSON.stringify(window.__reportDownload.progress)===JSON.stringify(i.progress)&&JSON.stringify(window.__reportDownload.quality)===JSON.stringify(i.quality),initial)&&reads===0&&writes===0);
  await page.$eval('[name=clearReportLocaleSearch]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=progressLocaleMatches]')?.textContent.includes('6 of 6'));check('clear returns full loaded counts without repair or reads',reads===0&&writes===0);check('no report locale metadata runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

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
