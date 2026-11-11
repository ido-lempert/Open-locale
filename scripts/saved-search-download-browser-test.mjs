// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55807, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-task-receipt-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('task_receipt_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/task_receipt_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  await call(`${P}/import/en`,{entries:{title:'Local title',conflict:'Local edit',remote:'Old text',empty:''}},token);
  await call(`${P}/tasks`,{title:'Actual task recovery'},token);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  const put=async(name,locale,value)=>{let k=(await call(`${P}/keys`,null,token)).find(k=>k.name===name);if(!k)k=await call(`${P}/keys`,{name},token);await call(`${P}/keys/${k.id}/translations`,{locale,value},token,'PUT');return k;};
  await put('with.source','en','Source <img src=x onerror=alert(1)> context');await put('with.source','he','Needle target');await put('empty.source','en','');await put('empty.source','he','Needle empty source');await put('missing.source','he','Needle missing source');
  const downloadDir=mkdtempSync(join(tmpdir(),'ol-search-download-'));const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  let reads=[],writes=[],held=null;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){reads.push({method:req.method(),path:u.pathname,search:u.search});if(!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(held&&u.pathname===`/api${P}/keys`){held.request=req;held.started();return;}}req.continue();});
  await page.goto(`${WEB}${P}/find`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=savedSearchIdle]');check('idle search has no download control',!await page.$('[name=downloadSavedSearch]'));await page.select('[name=savedSearchLocale]','he');await page.type('[name=savedSearchText]','needle');await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchCount]');
  await page.evaluate(()=>{window.savedDownloadStats={made:0,revoked:[]};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{window.savedDownloadStats.made++;return create(b);};URL.revokeObjectURL=u=>{window.savedDownloadStats.revoked.push(u);return revoke(u);};});
  reads=[];await page.click('[name=downloadSavedSearch]');for(let n=0;n<100&&!readdirSync(downloadDir).includes('saved-text-matches.json');n++)await new Promise(r=>setTimeout(r,50));const raw=readFileSync(join(downloadDir,'saved-text-matches.json'),'utf8'),report=JSON.parse(raw);
  check('actual browser saved JSON has exact loaded scope not complete/import authority',report.schemaVersion===2&&report.kind==='loaded-saved-text-matches'&&report.scope==='current-loaded-matches-only'&&!report.completeProject&&!report.importFile&&report.projectId===project.id&&report.sourceLocale==='en'&&JSON.stringify(report.filters)===JSON.stringify({branch:'main',locale:'he',query:'needle',match:'contains',status:null,tag:null}));
  check('actual JSON preserves source target empty and missing distinctions',report.matches.length===3&&report.matches.find(x=>x.key==='with.source').value==='Needle target'&&report.matches.find(x=>x.key==='with.source').sourceValue==='Source <img src=x onerror=alert(1)> context'&&report.matches.find(x=>x.key==='empty.source').sourceValue===''&&report.matches.find(x=>x.key==='missing.source').sourceValue===null&&report.matches.every(x=>Object.keys(x).sort().join(',')==='commentCount,description,id,key,screenshotCount,sourceValue,status,tags,value'));
  check('download makes no API request or mutation and releases its Blob URL',reads.length===0&&writes.length===0&&await page.evaluate(()=>window.savedDownloadStats.made===1&&window.savedDownloadStats.revoked.length===1));
  check('visible download caveats and notice deny complete export and saved confirmation',await page.$eval('[name=savedSearchDownloadScope]',e=>e.textContent.includes('private translation text')&&e.textContent.includes('Not a complete project export'))&&await page.$eval('[name=savedSearchDownloadNotice]',e=>e.textContent.includes('does not confirm')));
  await page.screenshot({path:'/downloads/saved-search-download-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=downloadSavedSearch]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/saved-search-download-mobile.png'});check('390px download and results fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.type('[name=savedSearchTag]','missing');check('filter edit removes prior download control and feedback',!await page.$('[name=downloadSavedSearch]')&&!await page.$('[name=savedSearchDownloadNotice]'));await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchEmpty]');check('empty successful scope permits explicit empty report',!!await page.$('[name=downloadSavedSearch]'));
  await page.evaluate(()=>HTMLAnchorElement.prototype.click=function(){throw new Error('PRIVATE');});await page.click('[name=downloadSavedSearch]');await page.waitForSelector('[name=savedSearchDownloadNotice]');check('failed browser download shows fixed error and still revokes new URL',await page.$eval('[name=savedSearchDownloadNotice]',e=>e.textContent==='Download could not be started. Try again from the current results.')&&await page.evaluate(()=>window.savedDownloadStats.made===2&&window.savedDownloadStats.revoked.length===2));
  let started;const ready=new Promise(r=>started=r);held={started};await page.$eval('[name=runSavedSearch]',e=>e.scrollIntoView({block:'center'}));await page.click('[name=runSavedSearch]');await Promise.race([ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Held search request did not start')),10000))]);await page.waitForSelector('[name=savedSearchLoading]');check('pending query removes old download control and notice',!await page.$('[name=downloadSavedSearch]')&&!await page.$('[name=savedSearchDownloadNotice]'));const old=held.request;held=null;await old.respond({status:503,contentType:'application/json',body:'{}'});await page.waitForSelector('[name=savedSearchError]');check('failed query leaves no stale download control',!await page.$('[name=downloadSavedSearch]')&&writes.length===0);
  rmSync(downloadDir,{recursive:true,force:true});check('no match-download runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
