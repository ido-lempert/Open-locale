// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.GLOSSARY_SEARCH_META_TEST_PG_PORT ?? 56344), WEB_PORT = 4200, API_PORT = 3000;
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
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  await call(`${P}/import/en`,{entries:{title:'Local title',conflict:'Local edit',remote:'Old text',empty:''}},token);
  await call(`${P}/tasks`,{title:'Actual task recovery'},token);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-glossary')).loading());let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/'))req.method()==='GET'?reads++:writes++;req.continue();});
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.locales.set(['toString','__proto__','constructor']);c.terms.set([{id:'own',term:'Own',notes:'Stored literal values',doNotTranslate:false,translations:JSON.parse('{"toString":"own string","__proto__":"own proto","constructor":"own constructor"}')},{id:'absent',term:'Absent',notes:'No stored values',doNotTranslate:false,translations:{}}]);});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
  const ownInputs=()=>page.$$eval('.glossary-table tbody input',es=>JSON.stringify(es.map(e=>e.value))===JSON.stringify(['own string','own proto','own constructor','','','']));
  check('own prototype-name translations display while absent values stay empty',await ownInputs());
  await page.$eval('[aria-label="Absent in toString"]',e=>e.value='Inherited function');check('negative inherited-looking input display detected',!await ownInputs());await page.$eval('[aria-label="Absent in toString"]',e=>e.value='');check('own lookup display restored after isolated probe',await ownInputs());
  await page.screenshot({path:'/downloads/glossary-own-values-desktop.png',fullPage:true});
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).terms.set([]));
  const tableReady=()=>page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary')),hs=[...document.querySelectorAll('.glossary-table th')],cell=document.querySelector('[name=glossaryListEmpty] td');return hs.length===c.locales().length+3&&hs.every(h=>h.scope==='col')&&hs.at(-1).textContent==='Actions'&&cell?.colSpan===hs.length;});
  for(const locales of [[],['he'],['he','fr','de']]){await page.evaluate(ls=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.locales.set(ls);},locales);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));check('empty glossary spans exact dynamic columns '+locales.length,await tableReady());}
  await page.$eval('[name=glossaryListEmpty] td',e=>e.colSpan=9);
  check('negative hardcoded empty colspan detected',!await tableReady());
  await page.$eval('[name=glossaryListEmpty] td',e=>e.colSpan=6);
  check('dynamic colspan restored after isolated probe',await tableReady());
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));c.locales.set(['he']);c.terms.set([{id:'visual',term:'checkout',notes:'Payment step',translations:{he:'קופה'},doNotTranslate:false}]);});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));await page.$eval('.glossary-table',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/glossary-columns-desktop.png'});
  await page.setViewport({width:390,height:844});await page.$eval('.glossary-table',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/glossary-columns-mobile.png'});
  check('390px glossary cards retain field labels and viewport fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('[data-label="Actions"]')&&getComputedStyle(document.querySelector('.glossary-table td')).display==='block'));
  await page.setViewport({width:1280,height:900});
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary')),values=[null,42,true,{},[]];c.search('billing');c.terms.set([...values.map((value,i)=>({id:'bad'+i,term:value,notes:value,translations:{he:value},doNotTranslate:false})),{id:'valid',term:'Release [A]',notes:'Billing',translations:{he:'Local'},doNotTranslate:false}]);c.term.set('Keep draft');c.unknownSaveIds.set(['valid']);c.unknownDeleteIds.set(['bad0']);});
  const search=async value=>{await page.$eval('[name=glossarySearch]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));};for(const value of ['[a]','BILLING','LOCAL']){await search(value);await page.waitForFunction(()=>document.querySelector('[name=glossaryMatches]')?.textContent.includes('1 of 6'));check('valid loaded field remains searchable '+value,reads===0&&writes===0&&!!await page.$('[aria-label="Release [A] in he"]'));}
  await page.click('[name=glossaryAttentionSave]');check('search retains recorded attention without recovery',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));return c.attention()==='save'&&c.unknownSaveIds()[0]==='valid'&&c.unknownDeleteIds()[0]==='bad0';})&&reads===0&&writes===0);
  for(const value of ['42','true','object']){await search(value);await page.waitForSelector('[name=glossaryListEmpty]');check('nonstring field not coerced into query '+value,await page.$eval('[name=glossaryMatches]',e=>e.textContent.includes('0 of 6'))&&reads===0&&writes===0);}
  await page.$eval('[name=glossarySearch]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/glossary-search-metadata-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=glossarySearch]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/glossary-search-metadata-mobile.png'});check('390px typed-search empty guidance fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.$eval('[name=clearGlossarySearch]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[name=glossaryMatches]')?.textContent.includes('1 of 6'));check('clear retains attention draft source values and unknown outcomes',reads===0&&writes===0&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));return c.term()==='Keep draft'&&c.terms()[1].translations.he===42&&c.unknownSaveIds().length===1&&c.unknownDeleteIds().length===1&&c.attention()==='save';}));check('no glossary metadata search runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;

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
