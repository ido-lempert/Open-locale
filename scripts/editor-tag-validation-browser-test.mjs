// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55923, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-tags-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('tags_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/tags_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  let calls=0,reads=0,failTags=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/keys`)reads++;if(req.method()==='PATCH'&&path.endsWith('/tags')){calls++;payloads.push(JSON.parse(req.postData()));if(failTags)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE_TAG_ERROR"}'});}req.continue();});
  await page.focus('[aria-label="alpha in en"]');await page.type('[aria-label="alpha in en"]',' LOCAL');await page.click('.tags-toggle');await page.waitForSelector('.tag-edit');
  const replace=async(value)=>{await page.$eval('.tag-edit',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  check('tag rules linked with valid initial state',await page.$eval('.tag-edit',e=>e.getAttribute('aria-describedby')?.startsWith('tagRules-')&&e.getAttribute('aria-invalid')==='false')&&!!await page.$('[name=tagRules]'));
  for(const bad of ['x'.repeat(41),Array(21).fill('same').join(','),'😀'.repeat(41),'✈️'.repeat(41)]){await replace(bad);await page.waitForSelector('[name=tagDraftInvalid]');await page.focus('.tag-edit');await page.keyboard.press('Enter');await page.$eval('.tag-edit',e=>{e.focus();e.blur();});await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.saveTags(c.keys()[0]);});check('invalid tags kept after Enter blur and captured call '+bad.slice(0,15),calls===0&&reads===0&&await page.$eval('.tag-edit',(e,v)=>e.value===v&&e.getAttribute('aria-invalid')==='true',bad)&&!await page.$('[name=tagsError]')&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original LOCAL'));}
  await page.$eval('.tag-edit',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-tag-validation-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('.tag-edit',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/editor-tag-validation-mobile.png'});check('390px tag rules and correction fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=tagRules]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.$eval('[name=tagDraftInvalid]',e=>e.getBoundingClientRect().right<=innerWidth));
  await page.click('[name=cancelTagEdit]');await page.waitForSelector('.tags-toggle');check('invalid tag draft can cancel without mutation',calls===0&&reads===0&&!await page.$('.tag-edit')&&!await page.$('[name=tagsError]'));
  await page.click('.tags-toggle');await page.waitForSelector('.tag-edit');await replace('x'.repeat(41));await page.$eval('.tag-edit',e=>{e.focus();e.blur();});await replace('  '+ '😀'.repeat(40)+', '+ '✈️'.repeat(40)+' , , ');await page.waitForFunction(()=>!document.querySelector('[name=tagDraftInvalid]'));await page.focus('.tag-edit');await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('[name=tagsSaving]')&&document.querySelectorAll('.tag-chip').length===2);const row=(await call(`${P}/keys`,null,token))[0];check('corrected Unicode40 limits really persist and keep local grid with no read',calls===1&&reads===0&&payloads[0].tags[0]==='😀'.repeat(40)&&payloads[0].tags[1]==='✈️'.repeat(40)&&row.tags.length===2&&row.tags.includes('😀'.repeat(40))&&row.tags.includes('✈️'.repeat(40))&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original LOCAL'));
  await page.click('.tags-toggle');await page.waitForSelector('.tag-edit');await replace(Array(20).fill('same').join(','));await page.$eval('.tag-edit',e=>{e.focus();e.blur();});await page.waitForFunction(()=>!document.querySelector('[name=tagsSaving]')&&document.querySelector('.tag-chip')?.textContent==='same');check('20 duplicates sent unchanged then normalized by real server',calls===2&&payloads[1].tags.length===20&&(await call(`${P}/keys`,null,token))[0].tags.join(',')==='same'&&reads===0);
  await page.click('.tags-toggle');await page.waitForSelector('.tag-edit');await replace(' , , ');await page.$eval('.tag-edit',e=>{e.focus();e.blur();});await page.waitForFunction(()=>!document.querySelector('[name=tagsSaving]')&&document.querySelectorAll('.tag-chip').length===0);check('empty entries preserve existing clear-all behavior',calls===3&&payloads[2].tags.length===0&&(await call(`${P}/keys`,null,token))[0].tags.length===0&&reads===0);
  failTags=true;await page.click('.tags-toggle');await page.waitForSelector('.tag-edit');await replace('valid');await page.$eval('.tag-edit',e=>{e.focus();e.blur();});await page.waitForSelector('[name=tagsError]');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.saveTags(c.keys()[0]);});check('valid server failure still pauses replay without private text or reads',calls===4&&reads===0&&!await page.$('.tag-edit')&&await page.$eval('.tags-toggle',e=>e.disabled)&&!(await page.$eval('.grid',e=>e.innerText)).includes('PRIVATE_')&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original LOCAL'));
  check('no tag runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??String(e)}`);process.exitCode=1;}
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
process.exit(failures?1:0);
