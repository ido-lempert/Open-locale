// Real local browser -> settings read-only pseudo provider metadata refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_VALIDATION_GUARD_TEST_PG_PORT ?? 56075), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-rule-locales-missing-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('rule_locales_missing_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/rule_locales_missing_browser`;
  prisma=new PrismaClient({datasources:{db:{url}}});
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'sync-browser-secret',NODE_ENV:'test',PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/projects`);
  const call=async(path,body,token,method)=>{const r=await fetch(`${API}${path}`,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();};
  const owner=await call('/auth/signup',{email:'sync-owner@example.com',password:'pass1234',displayName:'Owner'});
  const token=owner.accessToken;
  const project=await call('/projects',{name:'Sync browser',slug:'sync-browser',locales:['en','he']},token);
  const P=`/projects/${project.id}`;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{env:{...process.env,NX_DAEMON:'false'},stdio:'pipe',detached:true});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const diagnostics=[];const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('pageerror',e=>diagnostics.push(e.message));await page.setViewport({width:1280,height:900});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),token);


  const provider=await call(P+'/mt/providers',{name:'Offline provider',type:'pseudo'},token);
  await call(P+'/locales',{code:'fr'},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=ruleLoc-he]');await page.waitForNetworkIdle({idleTime:200});
  await page.click('[name=ruleLoc-he]');await page.click('[name=ruleLoc-fr]');
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.mtResult.set('Earlier pseudo result');c.newRuleName.set('Unsent rule');c.name.set('Other draft');});
  let reads=0,writes=0,deletes=0,failRead=false;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}`&&failRead){r.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});return;}}else {writes++;if(r.method()==='DELETE')deletes++;}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await settle();};
  const missing=async code=>!!await page.$(`[name=missingRuleLoc-${code}]`)&&await page.$eval(`[name=missingRuleLoc-${code}]`,e=>e.checked&&e.parentElement.textContent.includes('not in loaded target locales'));
  const retained=()=>page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return JSON.stringify(c.newRuleLocales())==='["he","fr"]'&&c.newRuleProvider()===id&&c.mtLocale()==='he'&&c.mtBranch()==='main'&&c.mtResult()==='Earlier pseudo result'&&c.newRuleName()==='Unsent rule'&&c.name()==='Other draft';},provider.id);
  check('loaded checked targets have no missing warning or duplicate controls',!await page.$('[name=settingsRuleLocalesMissing]')&&!await page.$('[name=missingRuleLoc-he]')&&await page.$eval('[name=ruleLoc-he]',e=>e.checked));
  failRead=true;await click('startRemoveLocale-he');await click('confirmRemoveLocale-he');
  check('real confirmed removal plus503 keeps exact target as checked missing draft control',await missing('he')&&await retained()&&!await page.$('[name=ruleLoc-he]')&&!await prisma.projectLocale.findFirst({where:{projectId:project.id,code:'he'}}));
  check('bounded warning explains draft-only removal not repair or permission',await page.$eval('[name=settingsRuleLocalesMissing]',e=>e.textContent.includes('not replaced')&&e.textContent.includes('draft only')&&e.textContent.includes('not add locales')&&e.textContent.includes('current availability')));
  check('accepted removal receipt and503 stay distinct with no implicit rule save',writes===1&&deletes===1&&reads===2&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.localeRemoveNotice().includes('was removed')&&c.error()==='Refresh failed';}));
  await page.setViewport({width:1280,height:900});await page.$eval('[name=settingsRuleLocalesMissing]',e=>e.scrollIntoView({block:'center'}));await settle();await page.screenshot({path:'/downloads/settings-rule-locales-missing-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsRuleLocalesMissing]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await settle();await page.screenshot({path:'/downloads/settings-rule-locales-missing-mobile.png'});check('warning and checked exact missing target fit390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});
  await page.select('[name=newRuleAction]','task.create');await settle();check('inactive action hides warning and controls without clearing selections',!await page.$('[name=settingsRuleLocalesMissing]')&&!await page.$('[name=missingRuleLoc-he]')&&await retained());await page.select('[name=newRuleAction]','pretranslate');await settle();check('returning action restores exact checked target without writes',await missing('he')&&await retained()&&writes===1);
  await click('missingRuleLoc-he');check('explicit uncheck removes only missing local target without save or Fill empty change',!await page.$('[name=missingRuleLoc-he]')&&!await page.$('[name=settingsRuleLocalesMissing]')&&writes===1&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return JSON.stringify(c.newRuleLocales())==='["fr"]'&&c.mtLocale()==='he'&&c.mtResult()==='Earlier pseudo result'&&c.newRuleName()==='Unsent rule'&&c.name()==='Other draft';}));
  failRead=false;await click('startRemoveLocale-fr');await click('confirmRemoveLocale-fr');check('zero loaded targets retains remaining checked missing target not base fallback',await missing('fr')&&!await page.$('[name=ruleLoc-en]')&&!await page.$('[name=ruleLoc-fr]')&&writes===2&&deletes===2);
  await call(P+'/locales',{code:'fr'},token);await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.project.set(await c.api.getProject(c.projectId));});await settle();check('returning exact target moves to loaded checked choice without draft replacement',!await page.$('[name=missingRuleLoc-fr]')&&!await page.$('[name=settingsRuleLocalesMissing]')&&await page.$eval('[name=ruleLoc-fr]',e=>e.checked)&&await page.evaluate(()=>JSON.stringify(ng.getComponent(document.querySelector('ol-settings')).newRuleLocales())==='["fr"]'));
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).newRuleLocales.set(['en','HE','en']));await settle();check('base and exact-case missing targets shown once without rewriting stored list',await missing('en')&&await missing('HE')&&await page.$$eval('[name=missingRuleLoc-en]',e=>e.length===1)&&await page.evaluate(()=>JSON.stringify(ng.getComponent(document.querySelector('ol-settings')).newRuleLocales())==='["en","HE","en"]'));
  check('only two requested locale deletions and expected reads, no rule or work writes',writes===2&&deletes===2&&reads===5);
  check('no translations publications tokens tasks webhooks deliveries or saved rules',await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no missing-rule-target runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
process.exit(!completed||failures?1:0);
