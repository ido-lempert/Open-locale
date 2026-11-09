// Real local browser -> comment refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55778, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-shots-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('shots_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/shots_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Alpha'}},token);const a=(await call(`${P}/keys`,null,token))[0];
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');const upload=async name=>{const f=new FormData();f.append('file',new Blob([png],{type:'image/png'}),name);const r=await fetch(`${API}${P}/keys/${a.id}/screenshots`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:f});if(!r.ok)throw new Error(`upload ${r.status}`);return r.json();};const removed=await upload('removed.png');await upload('retained.png');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.shots-toggle');await page.click('.shots-toggle');await page.waitForFunction(()=>document.querySelectorAll('.shots-list img').length===2&&[...document.querySelectorAll('.shots-list img')].every(e=>e.complete&&e.naturalWidth===1));
  let mode='live',held,deletes=0;const reads=[],writes=[];await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads.push(path);else writes.push(path);}if(req.method()==='DELETE'&&path.endsWith(`/screenshots/${removed.id}`)){deletes++;await call(`${P}/keys/${a.id}/screenshots/${removed.id}`,null,token,'DELETE');return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_SHOT_WRITE'})});}if(req.method()==='GET'&&path.endsWith('/screenshots')){if(mode==='error')return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_SHOT_READ'})});if(mode==='hold'){held=req;return;}}req.continue();});
  await page.click('[aria-label="Delete screenshot removed.png"]');await page.waitForSelector('[name=shotsMutationError]');check('real committed then lost screenshot delete pauses changes without automatic read',deletes===1&&reads.length===0&&!(await call(`${P}/keys/${a.id}/screenshots`,null,token)).some(s=>s.id===removed.id));
  const input=await page.$('[aria-label="alpha in en"]');await input.focus();await input.type(' local draft');mode='error';await page.click('[name=checkCurrentShots]');await page.waitForSelector('[name=shotsError]');check('focused unknown-result check reads only screenshots without blur autosave',writes.length===1&&reads.length===1&&reads[0].endsWith(`/keys/${a.id}/screenshots`)&&await input.evaluate(e=>e.value==='Alpha local draft'&&document.activeElement===e));check('failed read keeps mutation pause and fixed private-error-free guidance',!!await page.$('[name=shotsMutationError]')&&!await page.$('.shots-list')&&!(await page.content()).includes('PRIVATE_SHOT'));
  await page.$eval('[name=shotsMutationError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-shots-read-recovery-error-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=shotsMutationError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-shots-read-recovery-error-mobile.png'});await page.setViewport({width:1280,height:900});
  mode='hold';await page.click('[name=retryShots]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('recovery read not held');await page.waitForSelector('[name=shotsLoading]');check('focused retry retains translation without blur autosave',writes.length===1&&reads.length===2&&await input.evaluate(e=>document.activeElement===e&&e.value==='Alpha local draft'));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.recoverShots(c.keys()[0]);});check('captured duplicate recovery refuses pending read',reads.length===2&&writes.length===1);
  mode='live';await held.continue();await page.waitForFunction(()=>!document.querySelector('[name=shotsLoading]')&&!document.querySelector('[name=shotsMutationError]')&&document.querySelectorAll('.shots-list img').length===1&&document.querySelector('.shots-list img')?.complete&&document.querySelector('.shots-list img')?.naturalWidth===1);check('current screenshots restore actual image and removed item without replay or translation reload',deletes===1&&writes.length===1&&reads.length===3&&reads.every(p=>p.includes('/screenshots'))&&await page.$eval('.shots-list',e=>e.textContent.includes('retained.png')&&!e.textContent.includes('removed.png'))&&await input.evaluate(e=>e.value==='Alpha local draft'));
  await page.$eval('[name=shotsRefreshScope]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-shots-read-recovery-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=shotsRefreshScope]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-shots-read-recovery-mobile.png'});check('390px restored screenshot and scope readable',await page.$eval('[name=shotsRefreshScope]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})&&await page.$eval('.shots-list img',e=>e.complete&&e.naturalWidth===1));check('no screenshot recovery runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
