// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55703, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
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
  let posts=0,reads=0,failRead=true,drop=true,committed=false;await page.setRequestInterception(true);page.on('request',async req=>{const path=new URL(req.url()).pathname;if(path==='/api/projects'&&req.method()==='POST'){posts++;if(drop){const r=await fetch(req.url(),{method:'POST',headers:req.headers(),body:req.postData()});if(!r.ok)throw new Error('forwarded project create failed');await r.json();committed=true;return req.abort('failed');}}if(path==='/api/projects'&&req.method()==='GET'){reads++;if(failRead)return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});}req.continue();});
  await page.type('[name=name]','Created despite lost response');await page.type('[name=slug]','lost-response');await page.type('[name=locales]','en, he');await page.click('form.create button');await page.waitForSelector('[name=projectCreateUnknown]');await page.waitForFunction(()=>!document.querySelector('[name=projectCreating]')&&document.querySelector('form.create button')?.disabled);
  check('real server project committed before dropped response, unknown preserves form and no automatic list read',committed&&await prisma.project.count({where:{slug:'lost-response'}})===1&&posts===1&&reads===0&&await page.$eval('[name=name]',e=>e.value==='Created despite lost response')&&!await page.$('[name=projectCreateNotice]'));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-projects')).create());await page.$eval('form.create',e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check('unknown blocks captured handler and DOM submit without replay or raw detail',posts===1&&reads===0&&!(await page.content()).includes('PRIVATE')&&await page.$eval('form.create button',e=>e.disabled));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-projects')).error.set('Independent setting error'));await page.waitForFunction(()=>[...document.querySelectorAll('[role=alert]')].some(e=>e.textContent==='Independent setting error'));check('unknown project state does not conceal independent security-setting error',!!await page.$('[name=projectCreateUnknown]')&&await page.$eval('form.create button',e=>e.disabled));await page.evaluate(()=>ng.getComponent(document.querySelector('ol-projects')).error.set('Project creation outcome unconfirmed. Your form is kept here. Check the project list before trying again.'));
  await page.screenshot({path:'/downloads/projects-create-unknown-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/projects-create-unknown-mobile.png',fullPage:true});check('narrow unconfirmed project guidance readable without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.click('[name=refreshProjects]');await page.waitForSelector('[name=retryProjects]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-projects')).create());check('failed current list read preserves pause without replay',posts===1&&reads===1&&!!await page.$('[name=projectCreateUnknown]')&&await page.$eval('form.create button',e=>e.disabled));
  failRead=false;await page.click('[name=retryProjects]');await page.waitForFunction(()=>!document.querySelector('[name=projectsLoading]')&&!document.querySelector('[name=projectCreateUnknown]')&&[...document.querySelectorAll('.cards strong')].some(e=>e.textContent==='Created despite lost response'));check('successful explicit list read reveals committed project and unlocks without form loss',posts===1&&reads===2&&await page.$eval('[name=name]',e=>e.value==='Created despite lost response')&&await page.$eval('[name=slug]',e=>e.value==='lost-response')&&await page.$eval('[name=locales]',e=>e.value==='en, he')&&!await page.$eval('form.create button',e=>e.disabled)&&!await page.$('[role=alert]'));
  await page.$eval('[name=name]',e=>{e.value='Explicit next project';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.$eval('[name=slug]',e=>{e.value='explicit-next';e.dispatchEvent(new Event('input',{bubbles:true}));});drop=false;await page.click('form.create button');await page.waitForFunction(()=>document.querySelector('[name=projectCreateNotice]')?.textContent.includes('Explicit next project')&&!document.querySelector('[name=projectCreating]'));check('explicit new project after recovery sends once and retains confirmed receipt',posts===2&&reads===3&&await prisma.project.count({where:{slug:'lost-response'}})===1&&await prisma.project.count({where:{slug:'explicit-next'}})===1&&!await page.$('[name=projectCreateUnknown]'));
  check('no project unknown recovery runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
