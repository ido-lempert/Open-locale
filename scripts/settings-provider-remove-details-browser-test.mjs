// Real local browser -> guarded offline provider removal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56124, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
let completed=false;process.on('exit',()=>{if(!completed)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mt-remove-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('mt_remove_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/mt_remove_browser`;
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


  const first=await call(P+'/mt/providers',{name:'First provider',type:'pseudo',enabled:false},token);
  const other=await call(P+'/mt/providers',{name:'Other provider',type:'pseudo',enabled:false},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=startRemoveMtProvider-${first.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let deletes=0,reads=0,patches=0,held,refuse=true,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()==='PATCH'||(req.method()==='POST'&&path.endsWith('/pretranslate')))patches++;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}/mt/providers`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='DELETE'&&path===`/api${P}/mt/providers/${first.id}`){deletes++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=id=>page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).removeMtProvider({id}),id);
  await direct(first.id);check('unconfirmed direct provider removal makes no request',deletes===0&&reads===0);if(failures)throw new Error('Provider confirmation guard absent');
  await click('startRemoveMtProvider-'+other.id);await direct(first.id);check('wrong target confirmation does not authorize removal',deletes===0);await click('cancelRemoveMtProvider-'+other.id);
  await click('startRemoveMtProvider-'+first.id);
  const originalProviders=await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).mtProviders());
  const rawType='<img>'+ 'X'.repeat(300),created='2026-11-21T00:00:00.123Z';
  await page.evaluate(({id,rawType,created})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.mtProviders.set(c.mtProviders().map(p=>p.id===id?{...p,type:rawType,createdAt:created,config:{secret:'synthetic-hidden-provider-secret'},token:'synthetic-hidden-provider-secret'}:{...p,name:'First provider'}));},{id:first.id,rawType,created});await settle();
  check('exact provider ID type disabled state and raw creation metadata selected',await page.$eval('[name=settingsProviderRemoveId]',e=>e.textContent)===first.id&&await page.$eval('[name=settingsProviderRemoveType]',e=>e.textContent)===rawType&&await page.$eval('[name=settingsProviderRemoveState]',e=>e.textContent)==='disabled'&&await page.$eval('[name=settingsProviderRemoveCreated]',e=>e.textContent)===created);
  check('safe fields escape full raw type and omit unknown configuration credentials',await page.$eval('[name=settingsProviderRemoveDetails]',e=>!e.querySelector('img,a')&&!e.textContent.includes('synthetic-hidden-provider-secret'))&&reads===0&&deletes===0&&patches===0);
  check('identity review states no freshness permission readiness run history or provider request promise',await page.$eval('[name=settingsProviderRemoveDetails]',e=>e.textContent.includes('not a read of newer server values')&&e.textContent.includes('current permission, provider readiness or run history')&&e.textContent.includes('Configuration and credentials are not displayed')&&e.textContent.includes('does not test, enable or run')&&e.textContent.includes('this ID only')));
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.mtProviders.set(c.mtProviders().map(p=>p.id===id?{...p,enabled:true,createdAt:''}:p));},first.id);await settle();check('loaded replacement shows enabled and absent creation without readiness claim',await page.$eval('[name=settingsProviderRemoveState]',e=>e.textContent)==='enabled'&&await page.$eval('[name=settingsProviderRemoveCreated]',e=>e.textContent)==='(empty loaded value)'&&reads===0&&deletes===0&&patches===0);
  await page.evaluate(({id,created})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.mtProviders.set(c.mtProviders().map(p=>p.id===id?{...p,enabled:false,createdAt:created}:p));},{id:first.id,created});await settle();
  const referenceReads=reads;
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));const rule=(rid,name,action,providerId,enabled)=>({id:rid,name,action,config:{providerId},enabled,trigger:'key.created',createdAt:''});c.autoRules.set([rule('a','Enabled reference','pretranslate',id,true),rule('b','Disabled reference','pretranslate',id,false),rule('c','Wrong space','pretranslate',' '+id,true),rule('d','Notify reference','notify',id,true),rule('e','Wrong array','pretranslate',[id],true)]);c.mtProviderId.set(id);c.newRuleProvider.set(id);c.newRuleAction.set('notify');c.mtResult.set('Earlier result');c.mtRemoveNotice.set('Earlier receipt');c.error.set('Independent error');},first.id);await settle();
  const referenceNames=()=>page.$$eval('[name=settingsProviderRemoveRuleReferences] .locale-reference-name',es=>es.map(e=>e.textContent));
  check('exact loaded pretranslation provider references include enabled and disabled in order',JSON.stringify(await referenceNames())===JSON.stringify(['Enabled reference','Disabled reference'])&&await page.$eval('[name=settingsProviderRemoveRuleReferences]',e=>e.textContent.includes('enabled')&&e.textContent.includes('disabled')));
  check('current and inactive retained provider choices shown without effects',reads===referenceReads&&deletes===0&&patches===0&&await page.$eval('[name=settingsProviderRemoveFillReference]',e=>e.textContent.includes('references this provider')&&e.textContent.includes('first remaining loaded provider'))&&await page.$eval('[name=settingsProviderRemoveDraftReference]',e=>e.textContent.includes('references this provider')&&e.textContent.includes('inactive'))&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviderId()===id&&c.newRuleProvider()===id&&c.mtResult()==='Earlier result'&&c.mtRemoveNotice()==='Earlier receipt'&&c.error()==='Independent error'&&c.confirmingMtProvider()===id;},first.id));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.autoRules.set([]);c.mtProviderId.set('other');c.newRuleProvider.set('other');});await settle();check('loaded replacement immediately shows no references and nonmatching choices',!!await page.$('[name=settingsProviderRemoveNoRuleReferences]')&&await page.$eval('[name=settingsProviderRemoveFillReference]',e=>e.textContent.includes('does not reference'))&&await page.$eval('[name=settingsProviderRemoveDraftReference]',e=>e.textContent.includes('does not reference'))&&reads===referenceReads&&deletes===0&&patches===0);
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.autoRules.set([{id:'escaped',name:'<img>'+ 'X'.repeat(300),action:'pretranslate',config:{providerId:id},enabled:false,trigger:'key.created',createdAt:''}]);c.mtProviderId.set(id);c.newRuleProvider.set(id);},first.id);await settle();check('full rule name escaped wrapped and not a link',await page.$eval('[name=settingsProviderRemoveRuleReferences]',e=>!e.querySelector('img,a')&&e.textContent.includes('<img>'+ 'X'.repeat(300))));
  check('explicit incomplete local no save repair enable run or readiness promise',await page.$eval('[name=settingsProviderRemoveDependencies]',e=>e.textContent.includes('not a complete dependency scan')&&e.textContent.includes('Nothing is saved, repaired, enabled or run')&&e.textContent.includes('provider-readiness')));
  await page.$eval('[name=settingsProviderRemoveDetails]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-80));await page.screenshot({path:'/downloads/settings-provider-remove-details-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsProviderRemoveDetails]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-80));await page.screenshot({path:'/downloads/settings-provider-remove-details-confirm-mobile.png'});check('390px provider reference confirmation fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.$eval(`[name=confirmRemoveMtProvider-${first.id}]`,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-provider-remove-details-confirm-mobile-bottom.png'});await page.setViewport({width:1280,height:900});await page.evaluate(rows=>ng.getComponent(document.querySelector('ol-settings')).mtProviders.set(rows),originalProviders);await settle();await click('cancelRemoveMtProvider-'+first.id);await direct(first.id);check('cancel requires new explicit matching confirmation',deletes===0&&!!await page.$(`[name=startRemoveMtProvider-${first.id}]`));
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.mtProviderId.set(id);c.newMtName.set('Unsent provider');c.newRuleTitle.set('Next title');c.name.set('Other draft');},first.id);await settle();await click('startRemoveMtProvider-'+first.id);await click('confirmRemoveMtProvider-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains confirmation drafts and saved provider without reload',deletes===1&&reads===0&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingMtProvider()===id&&c.error()==='Permission denied'&&!c.mtRemoveNotice();},first.id)&&(await call(P+'/mt/providers',null,token)).length===2);
  refuse=false;failRead=true;await click('confirmRemoveMtProvider-'+first.id);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Provider DELETE not held');await direct(first.id);await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.cancelRemoveMtProvider();c.askRemoveMtProvider(id);c.toggleMtProvider({id,enabled:false});c.runPretranslate();},other.id);await settle();check('held removal blocks duplicate cancel and other target start',deletes===2&&patches===0&&await page.$eval('[name=runSettingsPretranslate]',e=>e.disabled)&&await page.$eval(`[name=toggleMtProvider-${other.id}]`,e=>e.disabled)&&await page.$eval(`[name=confirmRemoveMtProvider-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=cancelRemoveMtProvider-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=startRemoveMtProvider-${other.id}]`,e=>e.disabled)&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).confirmingMtProvider()===id,first.id));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(first.id);await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).askRemoveMtProvider(id),first.id);const rules=await call(P+'/mt/providers',null,token);check('accepted removal503 removes target locally and on server without retry or stale provider',deletes===2&&rules.length===1&&rules[0].id===other.id&&!await page.$(`[name=startRemoveMtProvider-${first.id}]`)&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviders().length===1&&c.mtProviders()[0].id===id&&c.mtProviderId()===id&&c.confirmingMtProvider()===null&&c.error()==='Refresh failed'&&c.newMtName()==='Unsent provider'&&c.newRuleTitle()==='Next title'&&c.name()==='Other draft'&&c.mtRemoveNotice().includes('was removed');},other.id));
  check('remaining provider stays disabled and no enable or Fill empty request is made',patches===0&&rules.every(r=>!r.enabled));
  check('only selected provider row is deleted',await prisma.mtProvider.count({where:{id:first.id}})===0&&await prisma.mtProvider.count({where:{id:other.id}})===1);
  await page.$eval('[name=settingsMtRemoveNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-provider-remove-details-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsMtRemoveNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/settings-provider-remove-details-mobile.png'});check('390px accepted removal receipt fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await click('startRemoveMtProvider-'+other.id);await click('confirmRemoveMtProvider-'+other.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('final provider removal clears Fill empty selection and leaves accurate empty local list',await prisma.mtProvider.count()===0&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviders().length===0&&c.mtProviderId()===''&&c.confirmingMtProvider()===null&&c.mtRemoveNotice().includes('was removed')&&c.error()==='Refresh failed';}));
  check('saved-reference fixture and new-rule provider remain unrepaired and prior result retained',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.autoRules()[0].config.providerId===id&&c.newRuleProvider()===id&&c.mtResult()==='Earlier result';},first.id));
  check('no tasks translations or webhook deliveries',await prisma.task.count()===0&&await prisma.translation.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no provider removal runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
completed=failures===0;process.exit(failures?1:0);
