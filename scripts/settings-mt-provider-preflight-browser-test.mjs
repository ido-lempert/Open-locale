// Real local browser -> settings Fill empty exact loaded branch preflight -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56100, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
let completed=false;
process.on('exit',()=>{if(!completed)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-mt-provider-preflight-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('mt_provider_preflight_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/mt_provider_preflight_browser`;
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


  const provider=await call(P+'/mt/providers',{name:'Offline fixture only',type:'pseudo'},token);
  const key=await call(P+'/keys',{name:'hello'},token);
  await call(P+'/keys/'+key.id+'/translations',{locale:'en',value:'Hello {name}'},token,'PUT');
  const chosen=await call(P+'/mt/providers',{name:'Chosen offline provider',type:'pseudo'},token);
  const disabled=await call(P+'/mt/providers',{name:'Disabled offline provider',type:'pseudo'},token);
  await call(P+'/mt/providers/'+disabled.id,{enabled:false},token,'PATCH');
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=mtLocale]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,held,refuse=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET')reads++;else{writes++;if(path===`/api${P}/mt/pretranslate`){payloads.push(JSON.parse(r.postData()));if(payloads.at(-1).providerId!==provider.id)return r.respond({status:404,contentType:'application/json',body:JSON.stringify({message:'Provider unavailable'})});if(refuse)return r.respond({status:403,contentType:'application/json',body:JSON.stringify({message:'Permission denied'})});held=r;return;}}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const direct=()=>page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).runPretranslate());
  await page.select('[name=mtProviderId]',chosen.id);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.mtResult.set('Earlier result');c.error.set('Independent error');c.name.set('Other draft');});
  await call(P+'/mt/providers/'+chosen.id,null,token,'DELETE');await page.$eval('[name=refreshSettingsMtProviders]',e=>e.click());await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).mtProviderListRefreshing());await settle();const before=reads;
  check('actually removed provider kept exact with disabled Fill empty and linked rules',await page.$eval('[name=mtProviderId]',(e,id)=>e.value===id&&e.getAttribute('aria-invalid')==='true'&&e.getAttribute('aria-describedby')==='settingsMtProviderRules',chosen.id)&&await page.$eval('[name=runSettingsPretranslate]',e=>e.disabled));
  await page.focus('[name=mtProviderId]');await page.keyboard.press('Enter');await direct();await settle();
  check('missing Enter and captured handler zero effects preserve prior state',writes===0&&reads===before&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtProviderId()===id&&c.mtResult()==='Earlier result'&&c.error()==='Independent error'&&c.name()==='Other draft';},chosen.id));
  const capture=async label=>{await page.keyboard.press('Escape');await page.$eval('[name=mtProviderId]',e=>e.blur());for(const [size,width,height]of [['desktop',1280,900],['mobile',390,844]]){await page.setViewport({width,height});await page.$eval(label==='missing'?'[name=settingsMtProviderMissing]':'[name=mtProviderId]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-85));await settle();await page.screenshot({path:`/downloads/settings-mt-provider-preflight-${label}-${size}.png`});check(label+' '+size+' fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.setViewport({width:1280,height:900});};await capture('missing');
  for(const raw of ['',provider.id.toUpperCase(),' '+provider.id+' ',disabled.id,'<img>','x'.repeat(100)]){await page.evaluate(v=>ng.getComponent(document.querySelector('ol-settings')).mtProviderId.set(v),raw);await settle();await direct();check('exact unavailable provider kept without request '+raw.slice(0,8),writes===0&&reads===before&&await page.evaluate(v=>ng.getComponent(document.querySelector('ol-settings')).mtProviderId()===v,raw));}
  await page.select('[name=mtProviderId]',provider.id);await page.$eval('[name=runSettingsPretranslate]',e=>e.form.requestSubmit());for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Fill not held');await direct();check('explicit valid loaded choice sends exact provider once',writes===1&&payloads[0].branch==='main'&&payloads[0].providerId===provider.id&&payloads[0].locale==='he'&&await page.$eval('[name=runSettingsPretranslate]',e=>e.disabled));await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await settle();const keys=await call(P+'/keys?branch=main',null,token);const target=keys.find(k=>k.id===key.id).translations.find(t=>t.localeCode==='he');
  check('real pseudo fill persisted unverified preserving source and unrelated draft',target?.value.includes('{name}')&&target.status==='UNVERIFIED'&&keys[0].translations.find(t=>t.localeCode==='en').value==='Hello {name}'&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.mtResult().includes('1 filled')&&c.mtResult().includes('TEST DATA')&&c.name()==='Other draft';}));await capture('filled');
  const after=reads;refuse=true;await page.$eval('[name=runSettingsPretranslate]',e=>e.form.requestSubmit());await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('valid server refusal leaves existing target without refresh',await prisma.translation.count()===2&&reads===after);
  await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).mtProviders.set([]));await settle();const emptyWrites=writes;await direct();check('empty loaded choices never fallback to another provider',writes===emptyWrites&&!await page.$('[name=runSettingsPretranslate]')&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).mtProviderId()===id,provider.id));
  check('only expected source and pseudo target; no publications tokens tasks webhooks deliveries or rules',await prisma.translation.count()===2&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no Fill empty preflight runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
completed=failures===0;
process.exit(failures?1:0);
