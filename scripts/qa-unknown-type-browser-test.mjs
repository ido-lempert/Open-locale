// Real local browser -> QA local search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.QA_UNKNOWN_TYPE_TEST_PG_PORT ?? 56362), WEB_PORT = 4200, API_PORT = 3000;
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


  const types=['untranslated','placeholder_mismatch','max_length','whitespace','number_mismatch','html_mismatch','future_check','constructor','__proto__',null,42,{},['whitespace']];
  const rows=types.map((type,n)=>({keyId:String(n),key:`key.${n}`,locale:'he',detail:'<img src=x> literal detail',type}));
  let reads=0,writes=0;
  await page.setRequestInterception(true);
  page.on('request',req=>{if(new URL(req.url()).pathname===`/api${P}/qa`&&req.method()==='GET'){reads++;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({issues:rows})});}if(['POST','PUT','PATCH','DELETE'].includes(req.method()))writes++;req.continue();});
  await page.goto(`${WEB}${P}/qa`,{waitUntil:'networkidle0'});await page.waitForSelector('.qa-badge');
  const expected=['Untranslated','Placeholder mismatch','Too long','Whitespace','Number mismatch','HTML mismatch',...Array(7).fill('Unknown issue')];
  const labels=()=>page.$$eval('.qa-badge',els=>els.map(e=>e.textContent));
  const matches=async()=>JSON.stringify(await labels())===JSON.stringify(expected);
  check('known labels and fixed unknown labels preserve all loaded rows',await matches());
  await page.$$eval('.qa-badge',els=>els[6].textContent='');
  check('negative blank-unknown-label probe detected',!await matches());
  await page.$$eval('.qa-badge',els=>els[6].textContent='Unknown issue');
  check('unknown label restored after isolated negative probe',await matches());
  check('unknown types receive only neutral unknown styling',await page.$$eval('.qa-badge',els=>els.slice(6).every(e=>e.className==='qa-badge qa-unknown')));
  check('details stay literal with no inserted markup',await page.$$eval('.qa-table tbody tr',els=>els.every(e=>e.textContent.includes('<img src=x> literal detail')&&!e.querySelector('img'))));
  await page.screenshot({path:'/downloads/qa-unknown-desktop.png',fullPage:true});
  await page.select('[name=qaType]','whitespace');
  check('known issue filter excludes malformed and unknown types',JSON.stringify(await labels())===JSON.stringify(['Whitespace']));
  await page.select('[name=qaType]','unknown');
  const unknownMatches=async()=>JSON.stringify(await labels())===JSON.stringify(Array(7).fill('Unknown issue'));
  check('unknown issue filter isolates every malformed and future type locally',await unknownMatches());
  await page.$$eval('.qa-badge',els=>els[0].textContent='Whitespace');check('negative known-label leak into unknown filter detected',!await unknownMatches());
  await page.$$eval('.qa-badge',els=>els[0].textContent='Unknown issue');check('unknown-only filter restored after isolated probe',await unknownMatches());
  await page.screenshot({path:'/downloads/qa-unknown-filter-desktop.png',fullPage:true});
  await page.$eval('[name=qaSearch]',e=>{e.value='key.6';e.dispatchEvent(new Event('input',{bubbles:true}));});
  check('raw-key local search can retain an unknown issue row',JSON.stringify(await labels())===JSON.stringify(['Unknown issue']));
  await page.setViewport({width:390,height:844});await page.focus('[aria-label="Loaded QA findings"]');
  await page.screenshot({path:'/downloads/qa-unknown-filter-mobile.png'});
  await page.evaluate(()=>{URL.createObjectURL=b=>{b.text().then(t=>window.__report=JSON.parse(t));return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});
  await page.$eval('[name=downloadQa]',e=>e.click());await page.waitForFunction(()=>!!window.__report);
  check('filtered view download preserves every raw type and row',await page.evaluate(expected=>JSON.stringify(window.__report.issues)===expected,JSON.stringify(rows)));
  await page.$eval('[name=qaSearch]',e=>{e.value='key.0';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForSelector('[name=qaEmpty]');
  check('unknown filter excludes known matching search and names no-match scope',await page.$eval('[name=qaEmpty]',e=>e.textContent.includes('No loaded findings match this search')));
  await page.$eval('[name=clearAllQaFilters]',e=>e.click());
  check('clear restores complete findings after unknown filtering',await matches());
  check('labels and local filters do not rerun or mutate checks',reads===1&&writes===0);
  check('no QA unknown-type runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  completed=true;process.exitCode=failures?1:0;

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
