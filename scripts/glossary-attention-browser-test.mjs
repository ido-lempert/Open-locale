// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55752, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
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
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);

  const a=await call(`${P}/glossary`,{term:'Alpha',translations:{he:'Saved alpha'}},token);const b=await call(`${P}/glossary`,{term:'Beta',translations:{he:'Saved beta'}},token);await call(`${P}/glossary`,{term:'Clean',translations:{he:'Clean text'}},token);const next=await call('/projects',{name:'Next',slug:'next-attention',locales:['en','he']},token);
  await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Alpha in he"]');
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',async req=>{const u=new URL(req.url());if(u.pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;if(['PATCH','DELETE'].includes(req.method())&&u.pathname.includes('/glossary/')){const r=await fetch(req.url(),{method:req.method(),headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('actual mutation failed');await r.json();return req.abort('failed');}}req.continue();});
  await page.type('[aria-label="Alpha in he"]',' local');await page.click('[name=glossaryAttentionSave]');await page.waitForSelector('[name=glossaryListEmpty]');check('actual pointer attention filter hides changed row without blur autosave or losing local text',reads===0&&writes===0&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).terms().find(t=>t.term==='Alpha').translations.he.includes(' local')));
  await page.click('[name=glossaryAttentionAll]');await page.waitForSelector('[aria-label="Alpha in he"]');await page.click('[aria-label="Alpha in he"]');await page.click('[name=gTerm]');await page.waitForSelector('[name=glossarySaveUnknown]');const actualSave=await call(`${P}/glossary`,null,token);check('actual committed then lost save is retained as unconfirmed',writes===1&&actualSave.find(t=>t.id===a.id).translations.he.includes(' local'));
  await page.click('[aria-label="Delete term Beta"]');await page.waitForSelector('[name=glossaryDeleteUnknown]');const actualDelete=await call(`${P}/glossary`,null,token);check('actual committed then lost delete stays as retained uncertain row',writes===2&&!actualDelete.some(t=>t.id===b.id)&&!!await page.$('[aria-label="Beta in he"]'));
  const before={reads,writes};await page.click('[name=glossaryAttentionSave]');await page.waitForFunction(()=>document.querySelector('[name=glossaryMatches]')?.textContent.includes('1 of 3'));check('save filter reveals only recorded save uncertainty without recovery or requests',!!await page.$('[name=glossarySaveUnknown]')&&!await page.$('[name=glossaryDeleteUnknown]')&&await page.$eval('[aria-label="Alpha in he"]',e=>e.readOnly)&&reads===before.reads&&writes===before.writes);
  await page.type('[name=glossarySearch]','Beta');await page.waitForSelector('[name=glossaryListEmpty]');check('search intersects attention with filtered-empty scope rather than no-terms claim',await page.$eval('[name=glossaryListEmpty]',e=>e.textContent.includes('these filters'))&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-glossary')).unknownSaveIds().length===1));
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'glossary-local-draft.json');await page.$eval('[name=downloadGlossaryDraft]',e=>e.click());for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const data=JSON.parse(readFileSync(file,'utf8'));rmSync(file);check('actual combined backup retains all three rows and both uncertainties despite zero visible matches',data.terms.length===3&&data.terms.find(t=>t.id===a.id).saveOutcomeUnconfirmed&&data.terms.find(t=>t.id===b.id).deleteOutcomeUnconfirmed&&reads===before.reads&&writes===before.writes);
  await page.click('[name=glossaryAttentionDelete]');await page.waitForSelector('[name=glossaryDeleteUnknown]');check('delete attention plus matching text reveals blocked retained row',await page.$eval('[name=glossaryMatches]',e=>e.textContent.includes('1 of 3'))&&!await page.$('[name=glossarySaveUnknown]'));
  await page.click('[name=clearGlossarySearch]');await page.waitForFunction(()=>document.querySelector('[name=glossarySearch]')?.value==='');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/glossary-attention-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/glossary-attention-mobile.png',fullPage:true});check('390px attention controls and uncertainty scope fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.click('[name=glossaryAttentionAll]');await page.waitForSelector('[name=glossarySaveUnknown]');check('return to all reveals both uncertainties without clearing retained text or requests',!!await page.$('[name=glossaryDeleteUnknown]')&&await page.$eval('[aria-label="Alpha in he"]',e=>e.value.includes(' local'))&&reads===before.reads&&writes===before.writes);
  await page.click('[name=glossaryAttentionSave]');await page.$eval('[name=refreshGlossaryList]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=glossaryListLoading]')&&document.querySelector('[name=glossaryMatches]')?.textContent.includes('0 of 2'));check('explicit current refresh recovers uncertainty while preserving attention filter and truthful empty state',reads===before.reads+1&&writes===before.writes&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-glossary'));return c.attention()==='save'&&!c.unknownSaveIds().length&&!c.unknownDeleteIds().length;})&&!!await page.$('[name=glossaryListEmpty]'));
  await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`/projects/${next.id}/glossary`);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-glossary')).loading());check('reused project resets attention and distinguishes actual no-terms state',await page.$eval('[name=glossaryAttentionAll]',e=>e.getAttribute('aria-pressed')==='true')&&await page.$eval('[name=glossaryListEmpty]',e=>e.textContent.includes('No glossary terms yet')));
  await page.evaluate(()=>{window.oldGlossary=ng.getComponent(document.querySelector('ol-glossary'));history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-glossary'));await page.evaluate(()=>window.oldGlossary.setAttention('delete'));check('departed attention handler refuses',await page.evaluate(()=>window.oldGlossary.attention()==='all'));
  check('no glossary attention runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(process.exitCode??1);
