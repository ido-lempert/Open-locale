// Real local browser -> captured import scope -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.EDITOR_FILE_SCOPE_TEST_PG_PORT ?? 55616), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-import-scope-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('import_scope_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/import_scope_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  await call(`${P}/import/en`,{arb:JSON.stringify({plural:'{count, plural, one {one original} other {many stable}}'})},token);
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  const previewCases=[['pot','preview.pot','msgid "alpha"\nmsgstr ""\n\nmsgid "fresh.preview"\nmsgstr ""\n','would create 1 keys, update 1 translations, 1 unchanged'],['arb','preview.arb',JSON.stringify({plural:'{count, plural, one {one edited} other {many stable}}'}),'would create 0 keys, update 1 translations, 0 unchanged']];
  for(const [format,filename,text,notice] of previewCases){
    await page.select('[name=ioFormat]',format);
    const before=JSON.stringify(await call(`${P}/keys`,null,token)),runs=(await call(`${P}/imports`,null,token)).length;
    await page.evaluate(({filename,text})=>{const input=document.querySelector('[name=previewFile]'),data=new DataTransfer();data.items.add(new File([text],filename,{type:'text/plain'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));},{filename,text});
    await page.waitForFunction(()=>!document.querySelector('[name=importPending]')&&document.querySelector('.notice')?.textContent.includes('Preview only'));
    check(`${format} actual file preview shows corrected counters`,await page.$eval('.notice',(e,notice)=>e.textContent.includes(notice)&&e.textContent.includes('nothing imported'),notice));
    check(`${format} actual file preview leaves server keys forms and runs unchanged`,JSON.stringify(await call(`${P}/keys`,null,token))===before&&(await call(`${P}/imports`,null,token)).length===runs);
  }
  await page.screenshot({path:'/downloads/editor-plural-preview-desktop.png',fullPage:true});
  await page.select('[name=ioFormat]','android');
  const beforeInvalid=JSON.stringify(await call(`${P}/keys`,null,token)),invalidRuns=(await call(`${P}/imports`,null,token)).length;
  await page.evaluate(()=>{const input=document.querySelector('[name=previewFile]'),data=new DataTransfer();data.items.add(new File(['<resources><plurals name="invalid.preview"><item quantity="one">one only</item></plurals><string name="fresh.valid">valid</string></resources>'],'invalid.xml',{type:'text/xml'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>!document.querySelector('[name=importPending]')&&document.querySelector('.notice')?.textContent.includes('Preview only'));
  check('actual invalid XML preview shows partial counters and required-other guidance',await page.$eval('.notice',e=>e.textContent.includes('would create 1 keys, update 1 translations, 0 unchanged, 1 would fail:')&&e.textContent.includes('invalid.preview')&&e.textContent.includes('requires an "other" item')));
  check('actual invalid XML preview creates no valid or invalid key or import run',JSON.stringify(await call(`${P}/keys`,null,token))===beforeInvalid&&(await call(`${P}/imports`,null,token)).length===invalidRuns);

  await page.select('[name=ioFormat]','json');
  let held,imports=0,reads=0;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='POST'&&path.includes(`/api${P}/import/`)){imports++;held=req;return;}if(req.method()==='GET'&&path===`/api${P}/keys`)reads++;req.continue();});
  const pick=async(delayed)=>page.evaluate(delayed=>{const input=document.querySelector('[name=importFile]');const data=new DataTransfer();const file=new File(['{"scoped":"value"}'],'scope.json',{type:'application/json'});if(delayed)file.text=()=>new Promise(resolve=>{window.releaseImportRead=()=>resolve('{"scoped":"value"}');});data.items.add(file);input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));},delayed);
  await pick(true);await page.select('[name=ioLocale]','he');await page.evaluate(()=>window.releaseImportRead());await new Promise(r=>setTimeout(r,200));check('scope change while file bytes pending prevents any request',imports===0&&!(await page.$('.import-conflict')));
  await page.select('[name=ioFormat]','csv');await pick(false);await page.waitForSelector('.import-conflict');await page.select('[name=ioLocale]','en');check('scope change clears conflict before it can retarget a write',!(await page.$('.import-conflict'))&&imports===0);
  await page.select('[name=ioFormat]','json');await pick(false);for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('import POST not held');await page.waitForSelector('[name=importPending]');check('pending import shows status and disables both single-file picks',await page.$eval('[name=importFile]',e=>e.disabled)&&await page.$eval('[name=previewFile]',e=>e.disabled));await page.screenshot({path:'/downloads/editor-import-pending.png',fullPage:false});const before=reads;await page.select('[name=ioLocale]','he');await held.continue();await page.waitForFunction(()=>!document.querySelector('[name=importPending]'));const exportedEn=await call(`${P}/export/en`,null,token),exportedHe=await call(`${P}/export/he`,null,token);check('sent import retains original locale and late completion never reloads changed scope',imports===1&&reads===before&&exportedEn.scoped==='value'&&!exportedHe.scoped&&!(await page.$('.notice'))&&await page.$eval('[name=ioLocale]',e=>e.value==='he'));await page.screenshot({path:'/downloads/editor-import-scope-kept.png',fullPage:false});
  check('no import scope runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
process.exit(!completed||failures?1:0);
