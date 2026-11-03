// Real local browser -> QA screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55535, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-qa-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('qa_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/qa_browser`;
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
  const plural=await call(`${P}/keys`,{name:'plural.categories',isPlural:true},token);
  await call(`${P}/keys/${plural.id}/translations`,{locale:'en',value:'items',pluralForms:{one:'{count} item',other:'{count} items'}},token,'PUT');
  await call(`${P}/keys/${plural.id}/translations`,{locale:'he',value:'items',pluralForms:{one:'item',other:'items'}},token,'PUT');
  const actualQa=await call(`${P}/qa`,null,token);
  check('actual plural QA emits separate same-type category findings',actualQa.issues.filter(i=>i.keyId===plural.id&&i.type==='placeholder_mismatch').length===2);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  await page.setViewport({width:480,height:900});
  await page.goto(`${WEB}/projects/${project.id}/qa`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=qaCount]');
  check('actual QA fixtures render findings',await page.$eval('[name=qaCount]',e=>!e.textContent.startsWith('0 ')));
  const pluralRows=await page.$$eval('.qa-table tbody tr',rows=>rows.filter(r=>r.textContent.includes('plural.categories')).map(r=>r.textContent));
  check('both plural category findings render distinctly without duplicate tracking diagnostics',pluralRows.length===2&&pluralRows.some(t=>t.includes('category "one"'))&&pluralRows.some(t=>t.includes('category "other"'))&&!diagnostics.some(t=>/NG0955|duplicat.*track/i.test(t)));
  check('finding table fits narrow document and keeps separated columns',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('.qa-table',e=>getComputedStyle(e).borderCollapse==='collapse')&&await page.$eval('.qa-table td',e=>parseFloat(getComputedStyle(e).paddingLeft)>=8));
  await page.screenshot({path:'/downloads/qa-plural-findings-full.png',fullPage:true});await page.$eval('.table-scroll',e=>e.scrollLeft=e.scrollWidth);await page.screenshot({path:'/downloads/qa-plural-details-full.png',fullPage:true});
  let held=false,release;const gate=new Promise(r=>release=r);await page.setRequestInterception(true);
  const hold=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/qa`&&new URL(req.url()).searchParams.get('locale')==='he'){held=true;await gate;}return req.continue();};page.on('request',hold);
  await page.select('[name=qaLocale]','he');for(let n=0;n<50&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('QA locale not held');
  check('held locale clears old findings and announces loading instead of zero success',!!await page.$('[name=qaLoading]')&&!(await page.$('.qa-table'))&&!(await page.$('[name=qaCount]'))&&await page.$eval('main',e=>e.getAttribute('aria-busy')==='true'));
  const next=await call('/projects',{name:'QA next',slug:'qa-next',locales:['en','fr']},token);
  await page.evaluate(id=>{history.pushState({},'',`/projects/${id}/qa`);window.dispatchEvent(new PopStateEvent('popstate'));},next.id);await page.waitForSelector('[name=qaCount]');
  const late=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/qa`&&new URL(r.url()).searchParams.get('locale')==='he');release();await late;await new Promise(r=>setTimeout(r,100));page.off('request',hold);await page.setRequestInterception(false);
  check('late old project findings cannot cross reused QA route',await page.$eval('[name=qaCount]',e=>e.textContent==='0 issues')&&await page.$eval('[name=qaLocale]',e=>e.value===''&&Array.from(e.options).some(o=>o.value==='fr')&&!Array.from(e.options).some(o=>o.value==='he'))&&await page.$eval('.back',(e,id)=>e.getAttribute('href')===`/projects/${id}`,next.id));
  await page.setRequestInterception(true);const fail=async req=>new URL(req.url()).pathname===`/api/projects/${next.id}/qa`?req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-qa-detail'})}):req.continue();page.on('request',fail);
  await page.select('[name=qaLocale]','fr');await page.waitForSelector('[name=retryQa]');
  check('failed QA hides findings and success count with fixed nonprivate guidance',!(await page.$('.qa-table'))&&!(await page.$('[name=qaCount]'))&&!(await page.content()).includes('private-qa-detail')&&await page.$eval('[role=alert]',e=>e.textContent.includes('No findings are shown'))&&await page.$eval('main',e=>e.getAttribute('aria-busy')==='false'));
  await page.screenshot({path:'/downloads/qa-failure-retry-full.png',fullPage:true});page.off('request',fail);await page.setRequestInterception(false);
  const retry=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${next.id}/qa`&&new URL(r.url()).searchParams.get('locale')==='fr'&&r.status()===200);await page.click('[name=retryQa]');await retry;await page.waitForSelector('[name=qaCount]');
  check('real QA retry recovers selected locale without stale error',await page.$eval('[name=qaLocale]',e=>e.value==='fr')&&await page.$eval('[name=qaCount]',e=>e.textContent==='0 issues')&&!(await page.$('[role=alert]'))&&!(await page.$('[name=retryQa]')));
  check('QA recovery fits narrow viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'/downloads/qa-recovered-full.png',fullPage:true});
  console.log(failures?'QA BROWSER CHECKS FAILED':'ALL QA BROWSER CHECKS PASSED');process.exitCode=failures?1:0;
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
