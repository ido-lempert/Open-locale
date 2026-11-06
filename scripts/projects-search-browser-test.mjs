// Real local browser -> Projects search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55684, WEB_PORT = 4200, API_PORT = 3000;
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


  await call('/projects',{name:'Checkout [A]',slug:'billing-app',locales:['en','fr']},token);
  await page.goto(`${WEB}/projects`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.querySelector('[name=projectMatches]')?.textContent.includes('2 of 2'));await page.waitForFunction(()=>!document.querySelector('[name=tfaLoading]'));
  await page.type('[name=name]','Keep draft');await page.type('[name=slug]','keep-draft');await page.type('[name=locales]','en, he');const security=await page.$eval('.tfa',e=>e.textContent);
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/'))req.method()==='GET'?reads++:writes++;req.continue();});
  const search=async text=>{await page.$eval('[name=projectSearch]',(e,text)=>{e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));},text);};
  await search('CHECKOUT');await page.waitForFunction(()=>document.querySelector('[name=projectMatches]')?.textContent.includes('1 of 2'));check('case-insensitive name search filters real loaded project cards',await page.$$eval('.cards a',a=>a.length===1&&a[0].textContent.includes('Checkout [A]')));
  await search('BILLING-APP');await page.waitForFunction(()=>document.querySelector('[name=projectSearch]').value==='BILLING-APP');check('slug search finds real loaded project',await page.$$eval('.cards a',a=>a.length===1&&a[0].textContent.includes('Checkout [A]')));
  await search('FR');await page.waitForFunction(()=>document.querySelector('.cards')?.textContent.includes('Checkout [A]'));check('locale code search filters independently of project name',await page.$$eval('.cards a',a=>a.length===1&&a[0].textContent.includes('Checkout [A]')));
  await search('.*');await page.waitForSelector('[name=projectSearchEmpty]');check('regex characters treated literally with distinct no-match guidance',!await page.$('.cards a')&&await page.$eval('[name=projectMatches]',e=>e.textContent.includes('0 of 2'))&&!await page.$('.empty'));
  await page.click('[name=clearProjectSearch]');await page.waitForFunction(()=>document.querySelectorAll('.cards a').length===2);check('clear restores loaded projects preserving form and security without requests',reads===0&&writes===0&&await page.$eval('[name=name]',e=>e.value==='Keep draft')&&await page.$eval('[name=slug]',e=>e.value==='keep-draft')&&await page.$eval('[name=locales]',e=>e.value==='en, he')&&await page.$eval('.tfa',(e,t)=>e.textContent===t,security));
  await search('[a]');await page.waitForFunction(()=>document.querySelectorAll('.cards a').length===1);await page.screenshot({path:'/downloads/projects-search.png',fullPage:true});await page.setViewport({width:390,height:844});check('project search fits narrow viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/downloads/projects-search-narrow.png',fullPage:true});check('no project search runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
