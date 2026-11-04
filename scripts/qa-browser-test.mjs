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
  let qaReads=0;const countQa=req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}/qa`)qaReads++;};page.on('request',countQa);await page.setRequestInterception(true);const failMetadata=async req=>{const path=new URL(req.url()).pathname;if(path===`/api/projects/${project.id}`)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-project-detail'})});return req.continue();};page.on('request',failMetadata);
  await page.goto(`${WEB}/projects/${project.id}/qa`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=qaCount]');
  await page.waitForSelector('[name=retryQaLocales]');const beforeLocaleRetry=await page.$eval('.qa-table',e=>e.textContent);
  check('failed locale discovery keeps actual findings without raw metadata error',!!await page.$('[name=qaLocalesError]')&&!(await page.content()).includes('private-project-detail')&&await page.$eval('[name=qaLocale]',e=>e.options.length===1&&e.getAttribute('aria-busy')==='false'));
  await page.screenshot({path:'/downloads/qa-locale-options-failure-full.png',fullPage:true});page.off('request',failMetadata);await page.setRequestInterception(false);
  let metadataHeld=false,releaseMetadata;const metadataGate=new Promise(r=>releaseMetadata=r);await page.setRequestInterception(true);const holdMetadata=async req=>{if(new URL(req.url()).pathname===`/api/projects/${project.id}`){metadataHeld=true;await metadataGate;}return req.continue();};page.on('request',holdMetadata);
  await page.click('[name=retryQaLocales]');for(let n=0;n<50&&!metadataHeld;n++)await new Promise(r=>setTimeout(r,20));if(!metadataHeld)throw new Error('metadata retry not held');await page.waitForSelector('[name=qaLocalesLoading]');await page.waitForFunction(()=>document.querySelector('[name=qaLocale]')?.getAttribute('aria-busy')==='true'&&!document.querySelector('[name=retryQaLocales]'));
  check('held locale retry announces independent loading without hiding or rerunning checks',qaReads===1&&!!await page.$('[name=qaLocalesLoading]')&&await page.$eval('[name=qaLocale]',e=>e.getAttribute('aria-busy')==='true')&&await page.$eval('main',e=>e.getAttribute('aria-busy')==='false')&&await page.$eval('.qa-table',(e,t)=>e.textContent===t,beforeLocaleRetry)&&!(await page.$('[name=qaLocalesError]'))&&!(await page.$('[name=retryQaLocales]')));
  await page.screenshot({path:'/downloads/qa-held-locale-options-full.png',fullPage:true});const metadataResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}`);releaseMetadata();await metadataResponse;page.off('request',holdMetadata);await page.setRequestInterception(false);
  await page.waitForFunction(()=>document.querySelector('[name=qaLocale]')?.options.length===2&&document.querySelector('[name=qaLocale]')?.getAttribute('aria-busy')==='false');
  check('locale discovery retry restores options without rerunning or replacing checks',qaReads===1&&!(await page.$('[name=qaLocalesLoading]'))&&await page.$eval('.qa-table',(e,t)=>e.textContent===t,beforeLocaleRetry)&&!(await page.$('[name=qaLocalesError]'))&&!(await page.$('[name=retryQaLocales]'))&&await page.$eval('[name=qaLocale]',e=>e.value===''));
  page.off('request',countQa);
  check('actual QA fixtures render findings',await page.$eval('[name=qaCount]',e=>!e.textContent.startsWith('0 ')));
  const pluralRows=await page.$$eval('.qa-table tbody tr',rows=>rows.filter(r=>r.textContent.includes('plural.categories')).map(r=>r.textContent));
  check('both plural category findings render distinctly without duplicate tracking diagnostics',pluralRows.length===2&&pluralRows.some(t=>t.includes('category "one"'))&&pluralRows.some(t=>t.includes('category "other"'))&&!diagnostics.some(t=>/NG0955|duplicat.*track/i.test(t)));
  check('finding table fits narrow document and keeps separated columns',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('.qa-table',e=>getComputedStyle(e).borderCollapse==='collapse')&&await page.$eval('.qa-table td',e=>parseFloat(getComputedStyle(e).paddingLeft)>=8));
  await page.screenshot({path:'/downloads/qa-plural-findings-full.png',fullPage:true});await page.$eval('.table-scroll',e=>e.scrollLeft=e.scrollWidth);await page.screenshot({path:'/downloads/qa-plural-details-full.png',fullPage:true});
  await page.select('[name=qaLocale]','he');await page.waitForSelector('[name=qaCount]');
  await call(`${P}/keys/${plural.id}/translations`,{locale:'he',value:'items',pluralForms:{one:'{count} item',other:'{count} items'}},token,'PUT');
  let refreshHeld=false,refreshReads=0,releaseRefresh,metadataReads=0;const refreshGate=new Promise(r=>releaseRefresh=r);await page.setRequestInterception(true);
  const refreshHandler=async req=>{const path=new URL(req.url()).pathname;if(path===`/api/projects/${project.id}`)metadataReads++;if(path===`/api/projects/${project.id}/qa`){refreshReads++;refreshHeld=true;await refreshGate;}return req.continue();};page.on('request',refreshHandler);
  await page.click('[name=refreshQa]');for(let n=0;n<50&&!refreshHeld;n++)await new Promise(r=>setTimeout(r,20));if(!refreshHeld)throw new Error('QA refresh not held');await page.waitForSelector('[name=qaLoading]');
  check('explicit QA refresh clears old findings and disables repeat while pending',await page.$eval('[name=refreshQa]',e=>e.disabled)&&!(await page.$('.qa-table'))&&!(await page.$('[name=qaCount]'))&&await page.$eval('[name=qaLocale]',e=>e.value==='he'));
  await page.click('[name=refreshQa]');await new Promise(r=>setTimeout(r,150));check('held explicit QA refresh pointer repeat causes no second request or metadata read',refreshReads===1&&metadataReads===0&&await page.$eval('[name=refreshQa]',e=>e.disabled)&&!(await page.$('[name=qaCount]')));await page.screenshot({path:'/downloads/qa-refresh-repeat-pending-full.png',fullPage:true});
  const refreshedResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project.id}/qa`);releaseRefresh();const refreshed=await (await refreshedResponse).json();await page.waitForSelector('[name=qaCount]');page.off('request',refreshHandler);await page.setRequestInterception(false);
  check('real refresh reflects changed translations with selected locale and no metadata reload',refreshed.issues.length===3&&!(await page.$eval('.qa-table',e=>e.textContent.includes('plural.categories')))&&await page.$eval('[name=qaCount]',e=>e.textContent==='3 issues')&&await page.$eval('[name=qaLocale]',e=>e.value==='he')&&metadataReads===0&&await page.$eval('[name=refreshQa]',e=>!e.disabled));
  await page.screenshot({path:'/downloads/qa-refreshed-findings-full.png',fullPage:true});
  await page.select('[name=qaLocale]','');await page.waitForSelector('[name=qaCount]');
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
  let staleMetadataHeld=false,releaseStaleMetadata;const staleMetadataGate=new Promise(r=>releaseStaleMetadata=r);await page.setRequestInterception(true);const staleMetadata=async req=>{if(req.method()==='GET'&&new URL(req.url()).pathname===`/api/projects/${project.id}`&&!staleMetadataHeld){staleMetadataHeld=true;await staleMetadataGate;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-first-qa-visit-metadata'})});}return req.continue();};page.on('request',staleMetadata);const route=async id=>page.evaluate(id=>{history.pushState({},'',`/projects/${id}/qa`);window.dispatchEvent(new PopStateEvent('popstate'));},id);
  await route(project.id);await page.waitForSelector('[name=qaLocalesLoading]');for(let n=0;n<50&&!staleMetadataHeld;n++)await new Promise(r=>setTimeout(r,20));if(!staleMetadataHeld)throw new Error('first QA metadata visit not held');await route(next.id);await page.waitForFunction(()=>document.querySelector('[name=qaCount]')&&document.querySelector('[name=qaLocale]')?.getAttribute('aria-busy')==='false');await route(project.id);await page.waitForFunction(()=>document.querySelector('[name=qaCount]')&&document.querySelector('[name=qaLocale]')?.getAttribute('aria-busy')==='false'&&[...document.querySelector('[name=qaLocale]').options].some(o=>o.value==='he'));await page.select('[name=qaLocale]','he');await page.waitForSelector('[name=qaCount]');const currentQaTable=await page.$eval('.qa-table',e=>e.textContent),currentQaCount=await page.$eval('[name=qaCount]',e=>e.textContent);const staleMetadataResponse=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname===`/api/projects/${project.id}`);releaseStaleMetadata();const staleMetadataBody=await(await staleMetadataResponse).json();await new Promise(r=>setTimeout(r,200));
  check('late failed first-visit QA metadata cannot replace successful repeated-project locale options or findings',staleMetadataBody.message==='private-first-qa-visit-metadata'&&await page.$eval('[name=qaLocale]',e=>e.value==='he'&&[...e.options].some(o=>o.value==='he')&&e.getAttribute('aria-busy')==='false')&&await page.$eval('.qa-table',(e,text)=>e.textContent===text,currentQaTable)&&await page.$eval('[name=qaCount]',(e,text)=>e.textContent===text,currentQaCount)&&!(await page.$('[name=qaLocalesError]'))&&!(await page.$('[name=retryQaLocales]'))&&!(await page.$('[name=qaLocalesLoading]')));
  check('repeated QA metadata failure remains private and runtime clean at narrow viewport',!(await page.content()).includes('private-first-qa-visit-metadata')&&!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d))&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));page.off('request',staleMetadata);await page.setRequestInterception(false);await page.screenshot({path:'/downloads/qa-locales-repeat-visit-full.png',fullPage:true});
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
