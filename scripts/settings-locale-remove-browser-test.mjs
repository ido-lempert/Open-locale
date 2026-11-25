// Real local browser -> guarded locale removal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_RESOURCE_REMOVE_TEST_PG_PORT ?? 55991), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-locale-remove-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('locale_remove_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/locale_remove_browser`;
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


  await call(P+'/locales',{code:'fr'},token);
  const key=await call(P+'/keys',{name:'kept'},token);
  await call(P+`/keys/${key.id}/translations`,{locale:'he',value:'First'},token,'PUT');
  await call(P+`/keys/${key.id}/translations`,{locale:'fr',value:'Kept French'},token,'PUT');
  const empty=await call(P+'/keys',{name:'empty'},token);await call(P+`/keys/${empty.id}/translations`,{locale:'he',value:''},token,'PUT');
  await call(P+'/branches',{name:'feature'},token);
  for(const [name,value] of [['branch-value','Branch text'],['branch-empty','']]){const branchKey=await call(P+'/keys',{name,branch:'feature'},token);await call(P+`/keys/${branchKey.id}/translations`,{locale:'he',value},token,'PUT');}
  const beforeHe=await prisma.translation.count({where:{projectId:project.id,localeCode:'he'}}),beforeHistory=await prisma.translationHistory.count();
  const keptFrench=await prisma.translation.findMany({where:{projectId:project.id,localeCode:'fr'},orderBy:{keyId:'asc'}});
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=startRemoveLocale-he]');await page.waitForNetworkIdle({idleTime:200});
  let deletes=0,reads=0,held,refuse=true,failRead=false,countHeld,holdCount=false,posts=0;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(holdCount&&path===`/api${P}/keys`){countHeld=req;return;}if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='POST'&&path===`/api${P}/locales`)posts++;if(req.method()==='DELETE'&&path===`/api${P}/locales/he`){deletes++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=code=>page.evaluate(code=>ng.getComponent(document.querySelector('ol-settings')).removeLocale(code),code);
  await direct('he');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-settings'));await c.askRemoveLocale('en');await c.askRemoveLocale('missing');});check('unconfirmed removal and base or missing preview send nothing',deletes===0&&reads===0);if(failures)throw new Error('Locale confirmation guard absent');
  await click('startRemoveLocale-fr');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct('he');check('mismatched confirmation cannot remove another locale',deletes===0);await click('cancelRemoveLocale-fr');
  holdCount=true;await click('startRemoveLocale-he');for(let n=0;n<150&&!countHeld;n++)await new Promise(r=>setTimeout(r,20));if(!countHeld)throw new Error('Count preview not held');const heldReads=reads;await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-settings'));await c.askRemoveLocale('fr');c.cancelRemoveLocale();});await settle();check('held preview blocks another preview and add locale',reads===heldReads&&await page.$eval('[name=startRemoveLocale-fr]',e=>e.disabled)&&await page.$eval('[name=addSettingsLocale]',e=>e.disabled));holdCount=false;await countHeld.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('default-branch preview is explicitly not total deletion count',await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).localeTxCount()===1)&&beforeHe===4&&await page.$eval('[name=confirmRemoveLocale-he]',e=>e.parentElement.textContent.includes('not a total deletion count')&&e.parentElement.textContent.includes('across all branches')));
  await page.$eval('[name=confirmRemoveLocale-he]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-locale-remove-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=confirmRemoveLocale-he]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-locale-remove-confirm-mobile.png'});check('390px confirmation fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});await click('cancelRemoveLocale-he');await direct('he');check('cancel requires new confirmation',deletes===0);
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newLocale.set('de');c.mtLocale.set('he');c.newRuleLocales.set(['he']);c.name.set('Other draft');});await settle();await click('startRemoveLocale-he');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await click('confirmRemoveLocale-he');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 keeps confirmation locale and drafts for retry',deletes===1&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingLocale()==='he'&&c.error()==='Permission denied'&&!c.localeRemoveNotice();})&&await prisma.translation.count({where:{projectId:project.id,localeCode:'he'}})===beforeHe);
  refuse=false;failRead=true;await click('confirmRemoveLocale-he');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Locale DELETE not held');await direct('he');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.cancelRemoveLocale();await c.askRemoveLocale('fr');await c.addLocale();});await settle();check('held deletion blocks duplicate cancel other preview and Add',deletes===2&&posts===0&&await page.$eval('[name=confirmRemoveLocale-he]',e=>e.disabled)&&await page.$eval('[name=cancelRemoveLocale-he]',e=>e.disabled)&&await page.$eval('[name=startRemoveLocale-fr]',e=>e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).confirmingLocale()==='he'));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct('he');const saved=await call(P,null,token);check('accepted503 removes locale locally and on server without retry preserving choices',deletes===2&&!saved.locales.some(l=>l.code==='he')&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.project().locales.some(l=>l.code==='he')&&c.confirmingLocale()===null&&c.error()==='Refresh failed'&&c.localeRemoveNotice().includes('was removed')&&c.newLocale()==='de'&&c.mtLocale()==='he'&&JSON.stringify(c.newRuleLocales())==='["he"]'&&c.name()==='Other draft';}));
  check('actual target translations and history cascade across branches including empty rows',await prisma.translation.count({where:{projectId:project.id,localeCode:'he'}})===0&&await prisma.translationHistory.count({where:{localeCode:'he'}})===0&&await prisma.translationHistory.count()<beforeHistory);
  check('other locale translations remain unchanged',JSON.stringify(await prisma.translation.findMany({where:{projectId:project.id,localeCode:'fr'},orderBy:{keyId:'asc'}}))===JSON.stringify(keptFrench));
  await page.$eval('[name=settingsLocaleRemoveNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-locale-remove-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsLocaleRemoveNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-locale-remove-mobile.png'});check('390px accepted receipt fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await call(P+'/locales',{code:'he'},token);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).project.update(p=>({...p,locales:[...p.locales,{code:'he'}]})));await settle();failRead=false;await click('startRemoveLocale-he');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());held=null;const previousReads=reads;await click('confirmRemoveLocale-he');for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Success DELETE not held');await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('successful project-only refresh preserves independent drafts and receipt',reads===previousReads+1&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.project().locales.some(l=>l.code==='he')&&c.newLocale()==='de'&&c.name()==='Other draft'&&c.localeRemoveNotice().includes('was removed')&&c.error()==='';}));
  check('no tasks or webhook deliveries',await prisma.task.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no locale removal runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
