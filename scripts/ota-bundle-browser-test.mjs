// Real local browser -> OTA bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55545, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ota-bundle-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('ota_bundle_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/ota_bundle_browser`;
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


  const entries=Object.fromEntries(Array.from({length:51},(_,n)=>['key'+n,n===0?'':'Published '+n]));entries['key1']='<img src=x onerror=alert(1)> '+ 'long-value-'.repeat(50);
  await call(`${P}/import/en`,{entries},token);await call(`${P}/import/he`,{entries:{key0:'שלום'}},token);
  const pub=await call(`${P}/ota/publish`,{},token);await call(`${P}/import/en`,{entries:{key2:'Live changed after publish'}},token);
  await call(`${P}/branches`,{name:'feature-test'},token);await call(`${P}/import/en?branch=feature-test`,{entries:{key2:'Feature published'}},token);const feature=await call(`${P}/ota/publish`,{branch:'feature-test'},token);
  const mutations=[];page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','OPTIONS'].includes(r.method()))mutations.push(r.method());});
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`a[href="${P}/ota/1/en?branch=main"]`);await page.click(`a[href="${P}/ota/1/en?branch=main"]`);await page.waitForSelector('.bundle-row');
  check('settings exact version locale branch link opens retained bundle',new URL(page.url()).pathname===`${P}/ota/1/en`&&new URL(page.url()).searchParams.get('branch')==='main'&&await page.$$eval('.bundle-row',r=>r.length===50));
  check('published bytes remain unchanged despite later live edit',await page.$eval('.bundle-list',e=>e.textContent.includes('Published 2')&&!e.textContent.includes('Live changed after publish')));
  check('literal hostile value rendered as text and empty value labeled',await page.$eval('.bundle-list',e=>e.textContent.includes('<img src=x onerror=alert(1)>')&&!e.querySelector('img')&&e.textContent.includes('Empty value')));
  check('publication context includes dated zone and read-only retention limits',await page.$eval('main',e=>e.textContent.includes('25 recent versions')&&e.textContent.includes('does not publish or confirm client delivery')&&e.textContent.includes('51 translation values'))&&await page.$eval('time',e=>!!e.getAttribute('datetime')&&e.textContent.includes('GMT')));
  await page.screenshot({path:'/downloads/ota-bundle-desktop.png',fullPage:false});await page.setViewport({width:390,height:844});check('long published value fits mobile without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/downloads/ota-bundle-mobile.png',fullPage:false});
  await page.click('[name=nextBundlePage]');await page.waitForFunction(()=>document.querySelectorAll('.bundle-row').length===1);check('next local page shows remaining entry only',await page.$$eval('.bundle-row',r=>r.length===1)&&await page.$eval('[name=nextBundlePage]',e=>e.disabled));await page.click('[name=previousBundlePage]');await page.waitForFunction(()=>document.querySelectorAll('.bundle-row').length===50);check('previous local page returns first50',await page.$$eval('.bundle-row',r=>r.length===50)&&await page.$eval('[name=previousBundlePage]',e=>e.disabled));
  const route=async(branch,locale='en')=>page.evaluate(({path,branch})=>{history.pushState({},'',path+'?branch='+encodeURIComponent(branch));dispatchEvent(new PopStateEvent('popstate'));},{path:`${P}/ota/1/${locale}`,branch});
  await route('feature-test');await page.waitForFunction(()=>document.querySelector('.bundle-list')?.textContent.includes('Feature published'));check('query-only reused component reads distinct branch version',await page.$eval('.bundle-list',e=>!e.textContent.includes('Published 2')));
  await route('main','he');await page.waitForFunction(()=>document.querySelector('.bundle-list')?.textContent.includes('שלום'));check('same component locale route clears previous locale bytes',await page.$$eval('.bundle-row',r=>r.length===1)&&!await page.$eval('.bundle-list',e=>e.textContent.includes('Feature published')));
  await route('main');await page.waitForFunction(()=>document.querySelectorAll('.bundle-row').length===50);
  await page.setRequestInterception(true);let reads=0,held=false,release;const gate=new Promise(r=>release=r);const hold=async req=>{if(new URL(req.url()).pathname===`/api${P}/ota/1/en`){reads++;held=true;await gate;return req.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-ota-error'})});}return req.continue();};page.on('request',hold);await page.click('[name=refreshBundle]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('bundle read not held');await page.click('[name=refreshBundle]');
  check('held refresh clears old bytes and disables duplicate read',reads===1&&!!await page.$('[name=bundleLoading]')&&!(await page.$('.bundle-row'))&&await page.$eval('[name=refreshBundle]',e=>e.disabled));release();await page.waitForSelector('[role=alert]');check('failed read hides bytes and raw backend error',!(await page.$('.bundle-row'))&&!(await page.$('[name=bundleEmpty]'))&&!(await page.content()).includes('private-ota-error'));await page.screenshot({path:'/downloads/ota-bundle-error.png',fullPage:true});page.off('request',hold);await page.setRequestInterception(false);await page.click('[name=refreshBundle]');await page.waitForSelector('.bundle-row');check('manual retry restores persisted publication',await page.$$eval('.bundle-row',r=>r.length===50));
  const member=await call('/auth/signup',{email:'bundle-member@example.com',password:'pass1234',displayName:'Member'});await prisma.teamMember.create({data:{teamId:project.teamId,userId:member.user.id,role:'MEMBER'}});await page.evaluate(t=>localStorage.setItem('ol_token',t),member.accessToken);await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('.bundle-row');check('ordinary project member can inspect existing publication',await page.$$eval('.bundle-row',r=>r.length===50));
  const outsider=await call('/auth/signup',{email:'bundle-outsider@example.com',password:'pass1234',displayName:'Outsider'});const denied=await fetch(`${API}${P}/ota/1/en?branch=main`,{headers:{Authorization:`Bearer ${outsider.accessToken}`}});check('live bundle API rejects unrelated account with404',denied.status===404);
  await prisma.otaPublication.delete({where:{id:pub.id}});await page.click('[name=refreshBundle]');await page.waitForSelector('[role=alert]');check('pruned or deleted version clears previous bytes on404',!(await page.$('.bundle-row')));
  check('bundle navigation refresh paging retry and denial cause no mutations',mutations.length===0);check('no bundle page runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));
  console.log(failures?'OTA BUNDLE BROWSER CHECKS FAILED':'ALL OTA BUNDLE BROWSER CHECKS PASSED');process.exitCode=failures?1:0;
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
