// Real local browser -> Tasks search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55685, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
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


  const first=await call(`${P}/tasks`,{title:'Checkout [A]',description:'Billing note'},token);
  await call(`${P}/tasks`,{title:'Account',description:'Customer identity'},token);
  await page.goto(`${WEB}${P}/tasks`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.querySelector('[name=taskMatches]')?.textContent.includes('2 of 2'));await page.type('[name=taskTitle]','New draft');await page.type('[name=taskDescription]','Keep details');await page.select('[name=taskDependsOn]',first.id);await page.select('[aria-label="Filter by status"]','OPEN');await page.waitForFunction(()=>document.querySelector('[name=taskMatches]')?.textContent.includes('2 of 2'));
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else{writes++;if(req.method()==='PATCH'&&u.pathname===`/api${P}/tasks/${first.id}`)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}}req.continue();});
  const search=async text=>{await page.$eval('[name=taskSearch]',(e,text)=>{e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));},text);};
  await search('BILLING');await page.waitForFunction(()=>document.querySelector('[name=taskMatches]')?.textContent.includes('1 of 2'));check('description search filters real tasks while full dependency choices remain',await page.$$eval('.task-row',r=>r.length===1&&r[0].textContent.includes('Checkout [A]'))&&await page.$eval('[name=taskDependsOn]',e=>e.options.length===3));
  await search('[a]');await page.waitForFunction(()=>document.querySelector('[name=taskSearch]').value==='[a]');check('task title search is literal and case insensitive',await page.$$eval('.task-row',r=>r.length===1&&r[0].textContent.includes('Checkout [A]')));
  await search('.*');await page.waitForSelector('[name=taskListEmpty]');check('literal no-match guidance differs from empty server list',await page.$eval('[name=taskListEmpty]',e=>e.textContent.includes('No loaded tasks match'))&&await page.$eval('[name=taskMatches]',e=>e.textContent.includes('0 of 2')));
  await page.click('[name=clearTaskSearch]');await page.waitForFunction(()=>document.querySelectorAll('.task-row').length===2);check('clear preserves form filter and dependency without requests',reads===0&&writes===0&&await page.$eval('[name=taskTitle]',e=>e.value==='New draft')&&await page.$eval('[name=taskDescription]',e=>e.value==='Keep details')&&await page.$eval('[name=taskDependsOn]',(e,id)=>e.value===id,first.id)&&await page.$eval('[aria-label="Filter by status"]',e=>e.value==='OPEN'));
  await page.select('[aria-label="Status for Checkout [A]"]','DONE');await page.waitForSelector('[name=taskActionUnknown]');await search('Account');await page.waitForFunction(()=>document.querySelectorAll('.task-row').length===1);check('search does not clear real unknown-action pause or replay mutation',writes===1&&reads===0&&await page.$eval('[aria-label="Status for Account"]',e=>e.disabled)&&!!await page.$('[name=taskActionUnknown]'));
  await page.screenshot({path:'/downloads/tasks-search.png',fullPage:true});await page.click('[name=recoverTaskActions]');await page.waitForFunction(()=>!document.querySelector('[name=taskActionUnknown]')&&document.querySelectorAll('.task-row').length===2);check('explicit recovery clears search and filters using one current read without replay',reads===1&&writes===1&&await page.$eval('[name=taskSearch]',e=>e.value==='')&&await page.$eval('[aria-label="Filter by status"]',e=>e.value==='')&&await page.$eval('[name=taskTitle]',e=>e.value==='New draft'));
  check('no task search runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
