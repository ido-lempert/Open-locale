// Real local browser -> Glossary screen -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55649, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-glossary-delete-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('glossary_delete_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/glossary_delete_browser`;
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

  const alpha=await call(`${P}/glossary`,{term:'Alpha',translations:{he:'Original'}},token),beta=await call(`${P}/glossary`,{term:'Beta'},token),gamma=await call(`${P}/glossary`,{term:'Gamma'},token);
  await page.goto(`${WEB}${P}/glossary`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Alpha in he"]');
  let heldDelete,heldPatch,deletes=0,reads=0,rejectGamma=false,failRead=false;await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/glossary`){reads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:'{}'});}if(req.method()==='DELETE'&&path===`/api${P}/glossary/${beta.id}`){deletes++;heldDelete=req;return;}if(req.method()==='DELETE'&&path===`/api${P}/glossary/${gamma.id}`){deletes++;if(rejectGamma)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}if(req.method()==='PATCH'&&path===`/api${P}/glossary/${alpha.id}`){heldPatch=req;return;}req.continue();});
  await page.$eval('[aria-label="Alpha in he"]',e=>{e.value='Local translation draft';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('blur'));});for(let n=0;n<100&&!heldPatch;n++)await new Promise(r=>setTimeout(r,20));if(!heldPatch)throw new Error('translation PATCH not held');
  await page.click('[aria-label="Delete term Beta"]');await page.waitForSelector('[name=glossaryDeleting]');await page.$eval('[aria-label="Delete term Beta"]',e=>e.click());await page.type('[name=gTerm]','Newer term draft');await heldDelete.continue();await page.waitForFunction(()=>!document.querySelector('[aria-label="Delete term Beta"]'));const list=await call(`${P}/glossary`,null,token);
  check('confirmed delete removes only Beta while unrelated save/draft remains without GET',deletes===1&&reads===0&&!list.some(t=>t.id===beta.id)&&list.find(t=>t.id===alpha.id).translations.he==='Original'&&await page.$eval('[aria-label="Alpha in he"]',e=>e.value==='Local translation draft')&&!!await page.$('[name=glossarySaving]')&&await page.$eval('[name=gTerm]',e=>e.value==='Newer term draft'));
  await page.screenshot({path:'/downloads/glossary-delete-keeps-local.png',fullPage:false});await heldPatch.continue();await page.waitForFunction(()=>!document.querySelector('[name=glossarySaving]'));check('unrelated translation save independently completes without list reload',reads===0&&(await call(`${P}/glossary`,null,token)).find(t=>t.id===alpha.id).translations.he==='Local translation draft');
  rejectGamma=true;await page.click('[aria-label="Delete term Gamma"]');await page.waitForSelector('[name=glossaryDeleteUnknown]');await page.$eval('[aria-label="Delete term Gamma"]',e=>e.click());check('unknown delete keeps row and blocks blind replay without GET or private error',deletes===2&&reads===0&&await page.$eval('[aria-label="Delete term Gamma"]',e=>e.disabled)&&await page.$eval('[aria-label="Gamma in he"]',e=>e.disabled)&&!(await page.content()).includes('PRIVATE'));
  await page.screenshot({path:'/downloads/glossary-delete-unknown.png',fullPage:false});failRead=true;await page.click('[name=refreshGlossaryList]');await page.waitForSelector('[name=retryGlossaryList]');check('failed explicit recovery read leaves unknown outcome',reads===1&&!(await page.$('[aria-label="Delete term Gamma"]')));failRead=false;await page.click('[name=retryGlossaryList]');await page.waitForSelector('[aria-label="Delete term Gamma"]');check('successful explicit current read restores persisted term and unlocks without DELETE replay',reads===2&&deletes===2&&!await page.$eval('[aria-label="Delete term Gamma"]',e=>e.disabled)&&!(await page.$('[name=glossaryDeleteUnknown]'))&&await page.$eval('[name=gTerm]',e=>e.value==='Newer term draft'));
  check('no glossary delete runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
