// Real local browser -> targeted key deletion -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55612, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-key-delete-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('key_delete_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/key_delete_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original',remove:'Remove me',failure:'Keep on failure'}},token);await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  let heldTranslation,heldDelete,deletes=0,keyReads=0,failDelete=false;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='PUT'&&path.endsWith('/translations')){heldTranslation=req;return;}if(req.method()==='DELETE'&&path.startsWith(`/api${P}/keys/`)){deletes++;if(failDelete)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_DELETE_ERROR'})});heldDelete=req;return;}if(req.method()==='GET'&&path===`/api${P}/keys`)keyReads++;req.continue();});
  await page.click('[aria-label="alpha in en"]');await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type('Local translation draft');await page.click('[aria-label="Delete key remove"]');for(let n=0;n<100&&(!heldTranslation||!heldDelete);n++)await new Promise(r=>setTimeout(r,20));if(!heldTranslation||!heldDelete)throw new Error('PUT/DELETE not held');await page.waitForSelector('[name=keyDeleting]');await page.$eval('[aria-label="Delete key remove"]',e=>e.click());check('pending deletion guards duplicate and blocks dirty unrelated row deletion',deletes===1&&await page.$eval('[aria-label="Delete key remove"]',e=>e.disabled)&&await page.$eval('[aria-label="Delete key alpha"]',e=>e.disabled));await page.screenshot({path:'/downloads/editor-key-delete-pending.png',fullPage:false});
  await heldDelete.continue();await page.waitForFunction(()=>!document.querySelector('[aria-label="remove in en"]'));const keys=await call(`${P}/keys`,null,token);check('targeted delete persists removal without list GET or unrelated draft loss',keyReads===0&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Local translation draft')&&!keys.some(k=>k.name==='remove')&&keys.find(k=>k.name==='alpha').translations.find(t=>t.localeCode==='en').value==='Original'&&await page.$eval('.notice',e=>e.textContent.trim()==='Key "remove" was deleted. Other local translation values were kept.'));await page.screenshot({path:'/downloads/editor-key-delete-retained.png',fullPage:false});
  failDelete=true;await page.click('[aria-label="Delete key failure"]');await page.waitForSelector('[name=keyDeleteError]');await page.$eval('[aria-label="Delete key failure"]',e=>e.click());check('unknown deletion retains row and unrelated draft with scoped error/no replay',deletes===2&&keyReads===0&&!!await page.$('[aria-label="failure in en"]')&&await page.$eval('[aria-label="Delete key failure"]',e=>e.disabled)&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Local translation draft')&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));await page.screenshot({path:'/downloads/editor-key-delete-error.png',fullPage:false});await heldTranslation.respond({status:503,contentType:'application/json',body:'{}'});await page.waitForSelector('[name=reloadAfterSave]');
  check('no key deletion runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
