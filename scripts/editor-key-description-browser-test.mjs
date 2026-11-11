// Real local browser -> loaded key description -> literal context and read boundaries.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55897, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
const downloadDir=mkdtempSync(join(tmpdir(),'retained-download-'));
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-export-scope-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('export_scope_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/export_scope_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Saved alpha',beta:'Saved beta'}},token);const keys=await call(`${P}/keys`,null,token),a=keys.find(k=>k.name==='alpha');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  const description='Button label, not a heading.\nטקסט <img src=x onerror=alert(1)> '+ 'x'.repeat(180);
  await prisma.key.update({where:{id:a.id},data:{description}});await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  const requests=[];await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/'))requests.push({method:req.method(),path});req.continue();});
  check('only nonempty loaded description offers native context details',await page.$$eval('[name=keyDescription]',es=>es.length===1)&&!await page.$eval('[name=keyDescription]',e=>e.open));
  const input=await page.$('[aria-label="alpha in en"]');await input.focus();await input.type(' LOCAL_DRAFT');const local=await input.evaluate(e=>e.value);requests.length=0;
  await page.click('[name=keyDescriptionToggle]');await page.waitForSelector('[name=keyDescriptionText]',{visible:true});await new Promise(r=>setTimeout(r,150));
  check('pointer expansion retains local translation without blur save or API calls',requests.length===0&&await input.evaluate((e,v)=>e.value===v,local));
  check('stored multiline markup description is exact literal text, never HTML',await page.$eval('[name=keyDescriptionText]',(e,v)=>e.textContent===v&&!e.querySelector('img')&&getComputedStyle(e).whiteSpace==='pre-wrap',description));
  check('adjacent guidance explains loaded context and destructive read boundary',await page.$eval('[name=keyDescriptionScope]',e=>e.textContent.includes('not a fresh read')&&e.textContent.includes('not a fresh read or translation save confirmation')&&e.textContent.includes('discard local work')));
  await prisma.key.update({where:{id:a.id},data:{description:'Newer unread guidance'}});
  check('stored newer context cannot silently replace loaded description',await page.$eval('[name=keyDescriptionText]',(e,v)=>e.textContent===v,description)&&requests.length===0);
  await page.click('[name=toggleEditorTools]');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/editor-key-description-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=keyDescriptionToggle]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-key-description-mobile.png'});
  check('390px long literal context wraps within grid without document overflow',await page.$eval('[name=keyDescriptionText]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.$eval('[name=keyDescriptionToggle]',e=>e.focus());await page.waitForNetworkIdle({idleTime:250});requests.length=0;await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('[name=keyDescription]').open);
  check('keyboard collapses loaded context with no new request',requests.length===0);
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[name=keyDescription]').open);
  check('keyboard reopens identical literal description',await page.$eval('[name=keyDescriptionText]',(e,v)=>e.textContent===v,description)&&requests.length===0);
  // Explicit fixture reload discards the already-checked local draft. Not a safe reload feature.
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).reload());await page.waitForFunction(()=>document.querySelector('[name=keyDescriptionText]')?.textContent==='Newer unread guidance');
  check('successful explicit current key read replaces loaded context',await page.$eval('[name=keyDescriptionText]',e=>e.textContent==='Newer unread guidance')&&requests.filter(r=>r.path.endsWith('/keys')).length===1&&requests.every(r=>r.method==='GET'));
  await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.branch.set('missing-branch');await c.reload();});await page.waitForSelector('[name=keysError]');
  check('failed superseding read keeps prior description inside inert retained grid',await page.$eval('[name=keyDescriptionText]',e=>e.textContent==='Newer unread guidance'&&!!e.closest('[inert]')));
  await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.branch.set('main');await c.reload();});await prisma.key.update({where:{id:a.id},data:{description:''}});await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).reload());await page.waitForFunction(()=>!document.querySelector('[name=keyDescription]'));
  check('empty current description removes old private context without mutation requests',!await page.$('[name=keyDescription]')&&requests.every(r=>r.method==='GET'));
  check('no description runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){failures++;console.log(`FAIL suite aborted: ${e?.stack??String(e)}`);process.exitCode=1;}
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
process.exit(failures?1:0);
