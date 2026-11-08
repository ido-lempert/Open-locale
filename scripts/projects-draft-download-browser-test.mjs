// Real local browser -> new-project form backup -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55736, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
const downloadDir=mkdtempSync(join(tmpdir(),'ol-project-draft-'));process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-project-create-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('project_create_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/project_create_browser`;
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
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);await page.goto(`${WEB}/projects`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('[name=projectsLoading]'));
  await page.type('[name=name]',' Raw project [A] ');await page.type('[name=slug]','draft-project');await page.type('[name=locales]','en, he, ');await page.type('[name=tfaSetupPassword]','PRIVATE_SECURITY_INPUT');
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'new-project-form.json'),readDownload=async()=>{for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const text=readFileSync(file,'utf8');rmSync(file);return JSON.parse(text);};
  let held,posts=0,reads=0,hold=false,drop=false,failRead=false;await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')){if(req.method()==='GET')reads++;else posts++;}if(path==='/api/projects'&&req.method()==='POST'){if(hold){held=req;return;}if(drop){const r=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('create failed');await r.json();return req.abort('failed');}}if(path==='/api/projects'&&req.method()==='GET'&&failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_READ'})});req.continue();});
  await page.$eval('[name=downloadProjectDraft]',e=>e.click());const data=await readDownload();check('actual JSON is exact raw current form with no security/loaded-project data',JSON.stringify(data)===JSON.stringify({schemaVersion:1,scope:'current-local-new-project-form',serverStateConfirmed:false,importable:false,canCreate:false,createOutcomeUnconfirmed:false,draft:{name:' Raw project [A] ',slug:'draft-project',localesText:'en, he, '}})&&!JSON.stringify(data).includes('PRIVATE_')&&!JSON.stringify(data).includes(project.id));check('backup creates no API effects and does not confirm save/share/create',posts===0&&reads===0&&await page.$eval('[name=projectDraftDownloadNotice]',e=>e.textContent.includes('does not confirm')));await page.$eval('[name=tfaSetupPassword]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/projects-draft-download-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/downloads/projects-draft-download-mobile.png',fullPage:true});check('390px form-backup scope/feedback fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.type('[name=name]',' newer');await page.waitForFunction(()=>!document.querySelector('[name=projectDraftDownloadNotice]'));check('editing raw fields hides obsolete backup notice',!await page.$('[name=projectDraftDownloadNotice]'));
  hold=true;await page.$eval('form.create',e=>e.requestSubmit());for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>document.querySelector('[name=downloadProjectDraft]')?.disabled);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-projects')).downloadDraft());check('pending actual creation blocks captured backup without file',posts===1&&reads===0&&readdirSync(downloadDir).length===0);hold=false;await held.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_POST'})});held=null;await page.waitForSelector('[name=projectCreateUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=downloadProjectDraft]')?.disabled);await page.$eval('[name=downloadProjectDraft]',e=>e.click());const unknown=await readDownload();check('uncertain creation remains flagged with no retry/read and exact current form',unknown.createOutcomeUnconfirmed&&unknown.draft.name.endsWith(' newer')&&!unknown.serverStateConfirmed&&posts===1&&reads===0&&await page.$('[name=projectCreateUnknown]'));
  failRead=true;await page.$eval('[name=refreshProjects]',e=>e.click());await page.waitForSelector('[name=retryProjects]');await page.$eval('[name=downloadProjectDraft]',e=>e.click());const failed=await readDownload();check('failed project read allows local-only backup preserving uncertainty',failed.createOutcomeUnconfirmed&&failed.draft.slug==='draft-project'&&posts===1&&reads===1&&!await page.$eval('[name=downloadProjectDraft]',e=>e.disabled));failRead=false;await page.$eval('[name=retryProjects]',e=>e.click());await page.waitForFunction(()=>!document.querySelector('[name=projectsLoading]')&&!document.querySelector('[name=projectCreateUnknown]'));await page.$eval('[name=downloadProjectDraft]',e=>e.click());const recovered=await readDownload();check('explicit recovery updates uncertainty flag without creation or form loss',!recovered.createOutcomeUnconfirmed&&recovered.draft.name===unknown.draft.name&&posts===1&&reads===2);
  await page.$eval('form.create',e=>e.requestSubmit());await page.waitForFunction(()=>!document.querySelector('[name=projectCreating]')&&document.querySelector('[name=projectCreateNotice]')?.textContent.includes('was created'));await page.$eval('[name=downloadProjectDraft]',e=>e.click());const empty=await readDownload();check('confirmed unchanged form clears old notice and exports empty form not submission authority',empty.draft.name===''&&empty.draft.slug===''&&empty.draft.localesText===''&&!empty.canCreate&&posts===2&&reads===3);
  await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('PRIVATE_DOWNLOAD');};ng.getComponent(document.querySelector('ol-projects')).downloadDraft();});await page.waitForFunction(()=>document.querySelector('[name=projectDraftDownloadNotice]')?.textContent.includes('Copy your form text'));check('bounded local failure excludes raw exception',!(await page.content()).includes('PRIVATE_DOWNLOAD'));
  await page.evaluate(()=>{window.oldProjects=ng.getComponent(document.querySelector('ol-projects'));window.afterDestroy=0;URL.createObjectURL=()=>{window.afterDestroy++;return 'blob:local';};history.pushState({},'','/account/identities');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-projects'));await page.evaluate(()=>window.oldProjects.downloadDraft());check('departed captured form backup cannot export',await page.evaluate(()=>window.afterDestroy===0)&&readdirSync(downloadDir).length===0&&posts===2);check('no project form-backup runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(process.exitCode??1);
