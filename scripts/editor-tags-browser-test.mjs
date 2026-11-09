// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55601, WEB_PORT = 4200, API_PORT = 3000;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');let heldTranslation,heldTags,tagCalls=0,keyReads=0,failTags=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='PUT'&&path.endsWith('/translations')){heldTranslation=req;return;}if(req.method()==='GET'&&path===`/api${P}/keys`)keyReads++;if(req.method()==='PATCH'&&path.endsWith('/tags')){tagCalls++;if(failTags)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_TAG_DETAIL'})});heldTags=req;return;}req.continue();});
  await page.click('[aria-label="alpha in en"]');await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type('Local uncommitted text');await page.$eval('[aria-label="alpha in en"]',e=>e.blur());await page.click('.tags-toggle');for(let n=0;n<100&&!heldTranslation;n++)await new Promise(r=>setTimeout(r,20));if(!heldTranslation)throw new Error('translation not held');console.log('STEP tag edit');await page.waitForSelector('.tag-edit');await page.type('.tag-edit','context, context');await page.keyboard.press('Enter');for(let n=0;n<100&&!heldTags;n++)await new Promise(r=>setTimeout(r,20));if(!heldTags)throw new Error('tag PATCH not held');await page.waitForSelector('[name=tagsSaving]');check('pending tag mutation disables same-key editor without losing local translation',await page.$eval('.tags-toggle',e=>e.disabled)&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Local uncommitted text')&&tagCalls===1);await heldTags.continue();await page.waitForFunction(()=>!document.querySelector('[name=tagsSaving]')&&document.querySelector('.tag-chip')?.textContent==='context');const row=(await call(`${P}/keys`,null,token))[0];check('confirmed normalized tags do not reload keys or persist held translation',keyReads===0&&row.tags.length===1&&row.tags[0]==='context'&&row.translations.find(t=>t.localeCode==='en').value==='Original'&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Local uncommitted text'));await page.screenshot({path:'/downloads/editor-tags-retained.png',fullPage:false});
  failTags=true;await page.click('.tags-toggle');console.log('STEP tag edit');await page.waitForSelector('.tag-edit');await page.type('.tag-edit',', failed');await page.keyboard.press('Enter');await page.waitForSelector('[name=tagsError]');check('unknown tag failure is fixed inline and keeps draft/no reload',keyReads===0&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Local uncommitted text')&&!(await page.$eval('.grid',e=>e.innerText)).includes('PRIVATE_'));await page.screenshot({path:'/downloads/editor-tags-error.png',fullPage:false});
  await heldTranslation.respond({status:503,contentType:'application/json',body:'{}'});await page.waitForSelector('[name=reloadAfterSave]');check('tag failure never retried automatically',tagCalls===2);
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
