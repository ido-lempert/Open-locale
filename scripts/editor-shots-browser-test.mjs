// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55586, WEB_PORT = 4200, API_PORT = 3000;
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


  await call(`${P}/import/en`,{entries:{alpha:'Alpha',beta:'Beta'}},token);
  const keys=await call(`${P}/keys`,null,token),a=keys.find(k=>k.name==='alpha'),b=keys.find(k=>k.name==='beta');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
  const upload=async(id,name)=>{const f=new FormData();f.append('file',new Blob([png],{type:'image/png'}),name);const r=await fetch(`${API}${P}/keys/${id}/screenshots`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:f});if(!r.ok)throw new Error(`upload ${r.status}`);return r.json();};
  const sa=await upload(a.id,'alpha.png'),sb=await upload(b.id,'beta.png');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('.shots-toggle');
  await page.evaluate(()=>{window.__created=[];window.__revoked=[];const c=URL.createObjectURL.bind(URL),r=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{const u=c(b);window.__created.push(u);return u;};URL.revokeObjectURL=u=>{window.__revoked.push(u);r(u);};});
  const mutations=[];page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','OPTIONS'].includes(r.method()))mutations.push(r.method());});
  const toggle=async name=>page.evaluate(name=>{[...document.querySelectorAll('.grid tbody tr:not(.history-row)')].find(r=>r.textContent.includes(name)).querySelector('.shots-toggle').click();},name);
  await page.setRequestInterception(true);let mode='hold-list',held=[];
  page.on('request',req=>{const path=new URL(req.url()).pathname,isList=path.endsWith('/screenshots'),isBlob=path.includes('/screenshots/');if((mode==='hold-list'&&isList)||(mode==='hold-blob'&&isBlob)){held.push(req);return;}if(mode==='error'&&isList)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-shots-error'})});return req.continue();});
  const waitHeld=async()=>{for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==1)throw new Error(`held count ${held.length}`);return held.shift();};
  await toggle('alpha');const old=await waitHeld();await toggle('beta');const fresh=await waitHeld();await old.respond({status:200,contentType:'application/json',body:JSON.stringify([sa])});await new Promise(r=>setTimeout(r,150));check('old A list cannot fill B or settle pending read',!!await page.$('[name=shotsLoading]')&&!(await page.$('.shots-list img')));
  await fresh.respond({status:200,contentType:'application/json',body:JSON.stringify([sb])});await page.waitForSelector('.shots-list img');check('selected B list and authenticated image appear together',await page.$eval('.shots-list',e=>e.textContent.includes('beta.png')&&!e.textContent.includes('alpha.png'))&&await page.$eval('.shots-list img',e=>e.complete&&e.naturalWidth===1));
  await toggle('beta');check('closing revokes previously published blob',await page.evaluate(()=>window.__created.length===1&&window.__revoked.includes(window.__created[0])));
  mode='hold-blob';await toggle('alpha');const blob=await waitHeld();check('image bytes pending keeps list hidden',!!await page.$('[name=shotsLoading]')&&!(await page.$('.shots-list')));await toggle('alpha');await blob.respond({status:200,contentType:'image/png',body:png});await new Promise(r=>setTimeout(r,150));check('late blob after close revoked without reopening',!(await page.$('.shots-row'))&&await page.evaluate(()=>window.__created.length===2&&window.__created.every(u=>window.__revoked.includes(u))));
  mode='error';await toggle('alpha');await page.waitForSelector('[name=shotsError]');check('failure is fixed message not empty or raw backend error',!(await page.$('[name=shotsEmpty]'))&&!(await page.$('.shots-list'))&&!(await page.content()).includes('private-shots-error'));await page.$eval('[name=shotsError]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-shots-error.png',fullPage:false});
  mode='live';await page.click('[name=retryShots]');await page.waitForSelector('.shots-list img');check('manual retry loads actual stored image',await page.$eval('.shots-list img',e=>e.complete&&e.naturalWidth===1)&&!(await page.$('[name=shotsError]')));await page.screenshot({path:'/downloads/editor-shots-retry.png',fullPage:false});
  await page.click('a.settings-link');await page.waitForFunction(()=>location.pathname.endsWith('/settings')&&!document.querySelector('.grid'));check('navigation destroys pane and revokes all owned blobs',await page.evaluate(()=>window.__created.length===3&&window.__created.every(u=>window.__revoked.includes(u))));
  check('screenshot read controls make no mutations',mutations.length===0);check('no screenshot runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
