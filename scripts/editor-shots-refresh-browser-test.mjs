// Real local browser -> screenshot refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55758, WEB_PORT = 4200, API_PORT = 3000;
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
  await toggle('alpha');await page.waitForSelector('.shots-list img');const initialUrl=await page.$eval('.shots-list img',e=>e.src);await upload(a.id,'new-current.png');
  await page.setRequestInterception(true);let mode='hold',held=[],reads=[];
  page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET')reads.push(path);if(mode==='hold'&&path.endsWith('/screenshots')){held.push(req);return;}if(mode==='error'&&path.endsWith('/screenshots'))return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_SHOTS'})});req.continue();});
  const waitHeld=async()=>{for(let n=0;n<100&&!held.length;n++)await new Promise(r=>setTimeout(r,20));if(held.length!==1)throw new Error(`held count ${held.length}`);return held.shift();};
  const input=await page.evaluateHandle(()=>[...document.querySelectorAll('.grid tbody tr:not(.history-row)')].find(r=>r.textContent.includes('alpha')).querySelector('textarea'));
  await input.asElement().focus();await input.asElement().type(' local draft');const localValue=await input.asElement().evaluate(e=>e.value);await page.click('[name=refreshShots]');const pending=await waitHeld();check('pointer refresh retains focused local translation and starts only screenshot read',mutations.length===0&&reads.length===1&&reads[0].endsWith(`/keys/${a.id}/screenshots`)&&await input.asElement().evaluate((e,v)=>e.value===v&&document.activeElement===e,localValue));
  await page.waitForFunction(()=>document.querySelector('[name=refreshShots]')?.disabled&&!!document.querySelector('[name=shotsLoading]')&&!document.querySelector('.shots-list'));
  check('pending refresh disables duplicate handler and hides old image while revoking URL',await page.$eval('[name=refreshShots]',e=>e.disabled)&&!!await page.$('[name=shotsLoading]')&&!await page.$('.shots-list')&&await page.evaluate(u=>window.__revoked.includes(u),initialUrl));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));return c.refreshShots(c.keys().find(k=>k.name==='alpha'));});check('captured duplicate refresh refuses while pending',reads.length===1&&mutations.length===0);
  mode='live';await pending.continue();await page.waitForFunction(()=>document.querySelectorAll('.shots-list img').length===2&&[...document.querySelectorAll('.shots-list img')].every(e=>e.complete&&e.naturalWidth===1));check('refresh displays actual newly stored image without editor reload or draft loss',reads.length===3&&reads.every(p=>p.includes('/screenshots'))&&mutations.length===0&&await input.asElement().evaluate((e,v)=>e.value===v,localValue)&&await page.$eval('.shots-list',e=>e.textContent.includes('new-current.png')));
  await page.$eval('[name=refreshShots]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-shots-refresh-desktop.png',fullPage:false});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshShots]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-shots-refresh-mobile.png',fullPage:false});check('mobile screenshot refresh scope remains available',await page.$eval('[name=shotsRefreshScope]',e=>e.textContent.includes('not reload translations'))&&await page.$eval('[name=refreshShots]',e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth;}));
  mode='error';await page.$eval('[name=refreshShots]',e=>e.click());await page.waitForSelector('[name=shotsError]');check('failed refresh hides stale images and uses existing fixed-message retry',!await page.$('[name=refreshShots]')&&!await page.$('.shots-list')&&!await page.$('[name=shotsEmpty]')&&!(await page.content()).includes('PRIVATE_SHOTS')&&await input.asElement().evaluate((e,v)=>e.value===v,localValue));
  mode='live';await page.$eval('[name=retryShots]',e=>e.click());await page.waitForSelector('.shots-list img');check('existing retry restores actual image and normal refresh control',!!await page.$('[name=refreshShots]')&&await page.$eval('.shots-list',e=>e.textContent.includes('new-current.png'))&&mutations.length===0);
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.shotsMutationError.set([c.shotsFor()]);});await page.waitForSelector('[name=checkCurrentShots]');check('uncertainty keeps dedicated recovery rather than normal refresh',!await page.$('[name=refreshShots]')&&mutations.length===0);await page.$eval('[name=checkCurrentShots]',e=>e.click());await page.waitForSelector('[name=refreshShots]');
  mode='hold';await page.$eval('[name=refreshShots]',e=>e.click());const late=await waitHeld();await toggle('alpha');mode='live';await late.continue();await new Promise(r=>setTimeout(r,150));check('closing during refresh does not reopen pane or retain owned images',!await page.$('.shots-row')&&await page.evaluate(()=>window.__created.every(u=>window.__revoked.includes(u)))&&mutations.length===0);
  check('no screenshot refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
