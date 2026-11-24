// Real local browser -> QA local search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.QA_SEARCH_META_TEST_PG_PORT ?? 56340), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;const downloadDir=mkdtempSync(join(tmpdir(),'ol-qa-download-'));
process.exitCode = 1;
// Preserve startup/assertion failure when incomplete cleanup leaves no live handles.
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  const values=[null,42,true,{},[]],rows=values.map((value,i)=>({keyId:'bad'+i,key:value,locale:value,detail:value,type:'untranslated'}));rows.push({keyId:'match',key:'Release [A]',locale:'he',detail:'<img src=x> literal',type:'whitespace'});let reads=0,writes=0;
  await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname===`/api${P}/qa`&&req.method()==='GET'){reads++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({issues:rows})});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});
  await page.goto(`${WEB}${P}/qa`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=qaCount]');const search=async value=>{await page.$eval('[name=qaSearch]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));};
  await search(' RELEASE ');await page.waitForFunction(()=>document.querySelector('[name=qaTypeCount]')?.textContent.includes('1 of 6'));check('search safely skips malformed source fields and matches valid key',reads===1&&writes===0&&await page.$$eval('tbody tr',es=>es.length===1&&es[0].textContent.includes('Release [A]')));
  await search('literal');check('valid detail stays searchable literal text',!await page.$('tbody img')&&await page.$eval('tbody',e=>e.textContent.includes('<img src=x> literal'))&&reads===1);
  for(const value of ['object','42','true']){await search(value);await page.waitForSelector('[name=qaEmpty]');check('nonstring metadata not coerced into query '+value,await page.$eval('[name=qaTypeCount]',e=>e.textContent.includes('0 of 6'))&&reads===1&&writes===0);}
  await page.$eval('[name=clearAllQaFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/qa-search-metadata-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=clearAllQaFilters]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/qa-search-metadata-mobile.png'});check('390px malformed-search empty guidance fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__qaDownload=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});await page.$eval('[name=downloadQa]',e=>e.click());await page.waitForFunction(()=>!!window.__qaDownload);check('download keeps all exact raw fields despite no visible findings',await page.evaluate(expected=>JSON.stringify(window.__qaDownload.issues)===JSON.stringify(expected),rows)&&reads===1&&writes===0);
  await page.$eval('[name=clearAllQaFilters]',e=>e.click());await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===6);check('clear restores full loaded set without repair or reread',reads===1&&writes===0);check('no QA metadata search runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

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
