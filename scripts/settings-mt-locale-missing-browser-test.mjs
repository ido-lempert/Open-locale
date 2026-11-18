// Real local browser -> settings read-only pseudo provider metadata refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56073, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mt-locale-missing-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('mt_locale_missing_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/mt_locale_missing_browser`;
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


  const provider=await call(P+'/mt/providers',{name:'Offline provider',type:'pseudo'},token);
  await call(P+'/locales',{code:'fr'},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=mtLocale]');await page.waitForNetworkIdle({idleTime:200});
  await page.select('[name=mtLocale]','he');
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.mtResult.set('Earlier pseudo result');c.newRuleLocales.set(['he']);c.newRuleName.set('Unsent rule');c.name.set('Other draft');});
  let reads=0,writes=0,deletes=0,failRead=false;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}`&&failRead){r.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});return;}}else {writes++;if(r.method()==='DELETE')deletes++;}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await settle();};
  const exact=async code=>page.$eval('[name=mtLocale]',(e,code)=>e.value===code&&e.selectedOptions[0]?.textContent.includes('not in loaded target locales'),code);
  const retained=()=>page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtLocale()==='he'&&c.mtProviderId()===id&&c.mtBranch()==='main'&&c.mtResult()==='Earlier pseudo result'&&JSON.stringify(c.newRuleLocales())==='["he"]'&&c.newRuleName()==='Unsent rule'&&c.name()==='Other draft';},provider.id);
  check('loaded target has no missing option or warning',!await page.$('[name=settingsMtLocaleMissing]')&&await page.$eval('[name=mtLocale]',e=>e.value==='he'&&![...e.options].some(o=>o.textContent.includes('not in loaded target locales'))));
  failRead=true;await click('startRemoveLocale-he');await click('confirmRemoveLocale-he');
  check('confirmed real removal plus503 keeps exact missing target in actual selector',await exact('he')&&await retained()&&!await prisma.projectLocale.findFirst({where:{projectId:project.id,code:'he'}}));
  check('warning explains exact retained non-base scope without repair guarantee',await page.$eval('[name=settingsMtLocaleMissing]',e=>e.textContent.includes('he')&&e.textContent.includes('not replaced')&&e.textContent.includes('non-base')&&e.textContent.includes('not add locales')&&e.textContent.includes('current availability')));
  check('accepted removal receipt and follow-up failure stay distinct',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.localeRemoveNotice().includes('was removed')&&c.error()==='Refresh failed';})&&writes===1&&deletes===1&&reads===2);
  await page.setViewport({width:1280,height:900});await page.$eval('[name=settingsMtLocaleMissing]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:'/downloads/settings-mt-locale-missing-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsMtLocaleMissing]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await settle();await page.screenshot({path:'/downloads/settings-mt-locale-missing-mobile.png'});check('warning and target choice fit390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});
  await page.select('[name=mtLocale]','fr');await settle();check('explicit listed choice clears only target warning without run or repair',!await page.$('[name=settingsMtLocaleMissing]')&&writes===1&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtResult()==='Earlier pseudo result'&&JSON.stringify(c.newRuleLocales())==='["he"]'&&c.newRuleName()==='Unsent rule';}));
  failRead=false;await click('startRemoveLocale-fr');await click('confirmRemoveLocale-fr');
  check('no remaining targets keeps exact missing choice rather than base fallback',await exact('fr')&&await page.$eval('[name=mtLocale]',e=>e.options.length===1&&![...e.options].some(o=>o.value==='en'))&&writes===2&&deletes===2);
  await page.select('[name=mtProviderId]',provider.id);await settle();check('unrelated provider choice leaves locale warning and exact target',await exact('fr')&&!!await page.$('[name=settingsMtLocaleMissing]')&&writes===2);
  await call(P+'/locales',{code:'fr'},token);await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.project.set(await c.api.getProject(c.projectId));});await settle();
  check('returned exact target clears display without replacing choice',!await page.$('[name=settingsMtLocaleMissing]')&&await page.$eval('[name=mtLocale]',e=>e.value==='fr'&&e.selectedOptions[0]?.textContent.trim()==='fr'));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).mtLocale.set('en'));await settle();check('retained base locale is explicitly not a target choice',await exact('en')&&!!await page.$('[name=settingsMtLocaleMissing]'));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).mtLocale.set(''));await settle();check('empty unset target does not invent a missing warning',!await page.$('[name=settingsMtLocaleMissing]'));
  check('only two requested locale deletions and expected reads, no other UI writes',writes===2&&deletes===2&&reads===5);
  check('no translations publications tokens tasks webhooks deliveries or saved rules',await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no missing-locale runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
