// Real local browser -> screenshot size preflight -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55935, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-shot-size-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('shot_size_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/shot_size_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original'}},token);const key=(await call(`${P}/keys`,null,token))[0];await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.click('.shots-toggle');await page.waitForSelector('[aria-label="Upload screenshot"]');
  let posts=0,reads=0,keyReads=0,failUpload=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='GET'&&path===`/api${P}/keys`)keyReads++;if(path.endsWith('/screenshots')){if(req.method()==='GET')reads++;if(req.method()==='POST'){posts++;if(failUpload)return req.respond({status:503,contentType:'application/json',body:'{"message":"PRIVATE_SIZE_UPLOAD"}'});}}req.continue();});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
  const pick=async(size,name='picked.png')=>page.evaluate(({size,name,png})=>{const bytes=new Uint8Array(size);bytes.set(png.slice(0,Math.min(size,png.length)));const input=document.querySelector('[aria-label="Upload screenshot"]'),d=new DataTransfer();d.items.add(new File([bytes],name,{type:'image/png'}));input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));},{size,name,png:[...png]});
  check('file chooser linked to exact byte size rules',await page.$eval('[aria-label="Upload screenshot"]',e=>e.getAttribute('aria-describedby')?.startsWith('shotUploadRules-'))&&await page.$eval('[name=shotUploadRules]',e=>e.textContent.includes('2,097,152')&&e.textContent.includes('Size alone does not confirm')));
  for(const size of [2097153,4000000]){await pick(size);await page.waitForSelector('[name=shotUploadTooLarge]');check('oversize file event sends no request/read/pause '+size,posts===0&&reads===0&&keyReads===0&&await page.$eval('[aria-label="Upload screenshot"]',e=>!e.disabled&&e.value===''&&e.files.length===0)&&!await page.$('[name=shotsMutationError]')&&!await page.$('[name=shotsMutating]')&&!!await page.$('[name=shotsEmpty]'));}
  await page.$eval('[name=shotUploadTooLarge]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-shot-size-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=shotUploadRules]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-170));await page.screenshot({path:'/downloads/editor-shot-size-mobile.png'});check('390px size correction and chooser fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=shotUploadTooLarge]',e=>e.getBoundingClientRect().right<=innerWidth));
  const toggle=async()=>{await page.$eval('.shots-toggle',e=>e.scrollIntoView({block:'center'}));console.log('TOGGLE_HIT',await page.$eval('.shots-toggle',e=>{const r=e.getBoundingClientRect();return {disabled:e.disabled,top:r.top,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e};}));await page.click('.shots-toggle');};
  await toggle();await page.waitForFunction(()=>!document.querySelector('.shots-row'));await toggle();await page.waitForSelector('[aria-label="Upload screenshot"]');check('close and reopen clears local size feedback without upload',posts===0&&reads===1&&!await page.$('[name=shotUploadTooLarge]'));
  await pick(2097153);await page.waitForSelector('[name=shotUploadTooLarge]');await pick(png.length,'valid.png');await page.waitForSelector('[aria-label="Delete screenshot valid.png"]');await page.waitForFunction(()=>!document.querySelector('[name=shotsMutating]')&&!document.querySelector('[name=shotsLoading]'));const list=await call(`${P}/keys/${key.id}/screenshots`,null,token);check('choosing smaller valid file clears correction and really persists once',posts===1&&reads===2&&keyReads===0&&list.length===1&&list[0].filename==='valid.png'&&!await page.$('[name=shotUploadTooLarge]'));
  failUpload=true;await pick(png.length,'uncertain.png');await page.waitForSelector('[name=shotsMutationError]');await pick(2097153);check('valid size server failure stays unknown and cannot replay or replace feedback',posts===2&&reads===2&&keyReads===0&&await page.$eval('[aria-label="Upload screenshot"]',e=>e.disabled)&&!await page.$('[name=shotUploadTooLarge]')&&!(await page.$eval('main',e=>e.innerText)).includes('PRIVATE_'));
  failUpload=false;await page.click('[name=checkCurrentShots]');await page.waitForFunction(()=>!document.querySelector('[name=shotsMutationError]')&&!document.querySelector('[name=shotsLoading]'));check('explicit current read still recovers without upload replay',posts===2&&reads===3&&await page.$eval('[aria-label="Upload screenshot"]',e=>!e.disabled)&&!!await page.$('[aria-label="Delete screenshot valid.png"]'));
  check('no size validation runtime error',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
