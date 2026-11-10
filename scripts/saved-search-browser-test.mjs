// Real local browser -> read-only saved text search -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55797, WEB_PORT = 4200, API_PORT = 3000;
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

  const release=await call(`${P}/branches`,{name:'release'},token);const put=async(name,locale,value,branch='main',forms)=>{let k=(await call(`${P}/keys?branch=${branch}`,null,token)).find(k=>k.name===name);if(!k)k=await call(`${P}/keys`,{name,branch,isPlural:!!forms},token);await call(`${P}/keys/${k.id}/translations`,{locale,value,...(forms?{pluralForms:forms}:{})},token,'PUT');return k;};
  await put('needle.en','en','Hello NEEDLE <img src=x onerror=alert(1)>');await put('needle.he','he','Needle Hebrew');await put('literal','en','100%_literal\\tail');await put('not.literal','en','100XXliteralZtail');await put('plural.only','en','Base without term','main',{other:'PLURAL_ONLY'});await put('release.only','en','Needle release','release');
  const search=async(q,locale='en',branch='main')=>call(`${P}/keys?valueSearch=${encodeURIComponent(q)}&locale=${locale}&branch=${branch}`,null,token);
  check('real database searches saved base values case-insensitively with branch and locale isolation',(await search('needle')).map(k=>k.name).join(',')==='needle.en'&&(await search('needle','he')).map(k=>k.name).join(',')==='needle.he'&&(await search('needle','en','release')).map(k=>k.name).join(',')==='release.only');
  check('literal wildcard/backslash search and plural exclusion are real database behavior',(await search('%_literal\\tail')).map(k=>k.name).join(',')==='literal'&&(await search('PLURAL_ONLY')).length===0);
  const bad=async(q,t=token)=>{const r=await fetch(`${API}${P}/keys?${q}`,{headers:{Authorization:`Bearer ${t}`}});return r.status;};const outsider=await call('/auth/signup',{email:'outsider@example.com',password:'pass1234',displayName:'Other'});
  check('missing/unknown locale, oversized input and outsider are refused',await bad('valueSearch=needle')===400&&await bad('valueSearch=needle&locale=xx')===400&&await bad('valueSearch='+ 'x'.repeat(201)+'&locale=en')===400&&[403,404].includes(await bad('valueSearch=needle&locale=en',outsider.accessToken)));
  check('value search combines with key-name filtering without widening matches',(await call(`${P}/keys?valueSearch=needle&locale=en&search=needle.en`,null,token)).map(k=>k.name).join(',')==='needle.en'&&(await call(`${P}/keys?valueSearch=needle&locale=en&search=needle.he`,null,token)).length===0);
  check('SQL-looking text is literal data, not query syntax',(await search("' OR 1=1 --")).length===0);
  let reads=[],writes=[],held=[],hold=false,fail=false;await page.setRequestInterception(true);page.on('request',req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')&&!['GET','OPTIONS'].includes(req.method()))writes.push(req.method()+u.pathname);if(u.pathname===`/api${P}/keys`&&u.searchParams.has('valueSearch')){reads.push(u);if(fail)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_ERROR'})});if(hold){held.push(req);return;}}req.continue();});
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.screenshot({path:'/downloads/saved-search-entry-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/saved-search-entry-mobile.png'});await page.setViewport({width:1280,height:900});await page.click('a[href$="/find"]');await page.waitForSelector('[name=savedSearchIdle]');check('editor entry opens idle read-only search without key-value requests',reads.length===0&&await page.$eval('[name=runSavedSearch]',e=>e.disabled));
  await page.type('[name=savedSearchText]','needle');await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchCount]');check('click-through shows actual saved matching text escaped and no writes',reads.length===1&&writes.length===0&&await page.$eval('[name=savedSearchResult]',e=>e.textContent.includes('needle.en')&&e.textContent.includes('<img src=x')&&!e.querySelector('img')));
  hold=true;await page.click('[name=runSavedSearch]');for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));await page.select('[name=savedSearchLocale]','he');await held.shift().continue();await new Promise(r=>setTimeout(r,100));check('scope edit clears old results and fences late actual response',!await page.$('[name=savedSearchResult]')&&!await page.$('[name=savedSearchLoading]')&&await page.$('[name=savedSearchIdle]'));
  hold=false;await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchCount]');check('manual new-locale search keeps selected scope and saved text',reads.at(-1).searchParams.get('locale')==='he'&&await page.$eval('[name=savedSearchResult]',e=>e.textContent.includes('needle.he')&&e.textContent.includes('Needle Hebrew')));
  await page.select('[name=savedSearchLocale]','en');await page.select('[name=savedSearchBranch]','release');await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchCount]');check('manual branch search returns only actual release saved value',reads.at(-1).searchParams.get('branch')==='release'&&await page.$eval('[name=savedSearchResult]',e=>e.textContent.includes('release.only')&&!e.textContent.includes('needle.en')));
  await page.screenshot({path:'/downloads/saved-search-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/saved-search-mobile.png'});check('390px search form/results fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  fail=true;await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchError]');check('failed read removes results with fixed error and no private server detail',!await page.$('[name=savedSearchResult]')&&!(await page.content()).includes('PRIVATE_ERROR'));fail=false;await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchCount]');check('explicit retry reads current saved values with no writes',writes.length===0&&await page.$eval('[name=savedSearchResult]',e=>e.textContent.includes('release.only')));
  await page.$eval('[name=savedSearchText]',e=>{e.value='NO_MATCH_SAVED_VALUE';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('[name=runSavedSearch]');await page.waitForSelector('[name=savedSearchEmpty]');check('empty result stays explicit about branch/locale/base-value scope',!await page.$('[name=savedSearchResult]')&&await page.$eval('[name=savedSearchEmpty]',e=>e.textContent.includes('plural forms or local drafts')));
  check('no saved search runtime errors' ,!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
