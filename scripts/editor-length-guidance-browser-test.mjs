// Real local browser -> loaded length advisory -> local base and plural values.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55905, WEB_PORT = 4200, API_PORT = 3000;
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


  await call(`${P}/import/en`,{entries:{alpha:'Hi',beta:'No limit'}},token);const keys=await call(`${P}/keys`,null,token),alpha=keys.find(k=>k.name==='alpha');
  await prisma.key.update({where:{id:alpha.id},data:{maxLength:3,isPlural:true}});
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
  const requests=[];await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/'))requests.push({method:req.method(),path:new URL(req.url()).pathname});req.continue();});
  const read=()=>page.$eval('[aria-label="alpha in en"]',e=>e.closest('td').querySelector('[name=baseLengthGuidance]').textContent);
  check('only limited key offers base and plural advisory',await page.$$eval('[name=baseLengthGuidance]',es=>es.length===2)&&!await page.$eval('[aria-label="beta in en"]',e=>!!e.closest('td').querySelector('[name=baseLengthGuidance]'))&&(await read()).includes('2 / 3 UTF-16 code units'));
  const text='😀é <b>';await page.focus('[aria-label="alpha in en"]');await page.$eval('[aria-label="alpha in en"]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},text);
  check('emoji combining markup local text counts8 without truncation save or extra read',await page.$eval('[aria-label="alpha in en"]',(e,v)=>e.value===v&&!e.hasAttribute('maxlength'),text)&&(await read()).includes('8 / 3 UTF-16 code units')&&(await read()).includes('Over loaded limit.')&&requests.length===0);
  check('guidance says loaded only not QA or save confirmation',(await read()).includes('not fresh QA or save confirmation')&&(await read()).includes('not truncated or blocked'));
  await page.$eval('[aria-label="alpha other form in en"]',e=>{e.value='😀😀';e.dispatchEvent(new Event('input',{bubbles:true}));});
  check('displayed plural form counts current local4 separately without API',await page.$eval('[aria-label="alpha other form in en"]',e=>e.value==='😀😀'&&e.closest('label').querySelector('[name=pluralLengthGuidance]').textContent.includes('4 / 3 UTF-16 code units')&&e.closest('label').textContent.includes('Over loaded limit.'))&&requests.length===0);
  await prisma.key.update({where:{id:alpha.id},data:{maxLength:100}});
  check('newer unread limit cannot silently update local advisory',(await read()).includes('8 / 3')&&requests.length===0);
  check('desktop plural input remains usable beside guidance',await page.$eval('[aria-label="alpha other form in en"]',e=>e.getBoundingClientRect().width>=100));
  await page.$eval('[name=toggleEditorTools]',e=>e.click());await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/editor-length-guidance-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=baseLengthGuidance]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-180));await page.screenshot({path:'/downloads/editor-length-guidance-mobile.png'});
  check('mobile plural input remains usable below guidance',await page.$eval('[aria-label="alpha other form in en"]',e=>e.getBoundingClientRect().width>=100));
  check('390px guidance wraps without document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=baseLengthGuidance]',e=>e.getBoundingClientRect().right<=innerWidth));
  // Explicit fixture read discards the already checked local draft, not a safe reload feature.
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).reload());await page.waitForFunction(()=>document.querySelector('[name=baseLengthGuidance]')?.textContent.includes('/ 100 UTF-16'));
  check('explicit current key read installs new limit and saved value', (await read()).includes('2 / 100')&&requests.every(r=>r.method==='GET'));
  await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.branch.set('missing-branch');await c.reload();});await page.waitForSelector('[name=keysError]');
  check('failed superseding read retains limit inside inert grid',await page.$eval('[name=baseLengthGuidance]',e=>e.textContent.includes('/ 100')&&!!e.closest('[inert]')));
  await prisma.key.update({where:{id:alpha.id},data:{maxLength:null}});await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.branch.set('main');await c.reload();});await page.waitForFunction(()=>!document.querySelector('[name=baseLengthGuidance]'));
  check('current null limit removes base and plural guidance without writes',!await page.$('[name=pluralLengthGuidance]')&&requests.every(r=>r.method==='GET'));
  check('no length guidance runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
