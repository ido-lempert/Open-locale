// Real local browser -> settings Fill empty exact loaded branch preflight -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56104, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
let completed=false;
process.on('exit',()=>{if(!completed)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-rule-provider-preflight-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('rule_provider_preflight_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/rule_provider_preflight_browser`;
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


  const provider=await call(P+'/mt/providers',{name:'Loaded disabled fixture',type:'pseudo'},token);
  await call(P+'/mt/providers/'+provider.id,{enabled:false},token,'PATCH');
  const chosen=await call(P+'/mt/providers',{name:'Removed fixture',type:'pseudo'},token);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=newRuleAction]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,held,refuse=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET')reads++;else{writes++;if(path===`/api${P}/automations`){payloads.push(JSON.parse(r.postData()));if(refuse)return r.respond({status:403,contentType:'application/json',body:JSON.stringify({message:'Permission denied'})});if(payloads.at(-1).config.providerId!==provider.id)return r.respond({status:400,contentType:'application/json',body:JSON.stringify({message:'Invalid provider'})});held=r;return;}}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const direct=()=>page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());
  await page.select('[name=newRuleProvider]',chosen.id);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newRuleLocales.set(['he']);c.newRuleName.set(' Rule ');c.ruleDraftNotice.set('Earlier receipt');c.error.set('Independent error');c.name.set('Other draft');});
  await call(P+'/mt/providers/'+chosen.id,null,token,'DELETE');await page.$eval('[name=refreshSettingsMtProviders]',e=>e.click());await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).mtProviderListRefreshing());await settle();const before=reads;
  check('actually removed provider kept exact with disabled Add and linked rules',await page.$eval('[name=newRuleProvider]',(e,id)=>e.value===id&&e.getAttribute('aria-invalid')==='true'&&e.getAttribute('aria-describedby')==='settingsRuleProviderRules',chosen.id)&&await page.$eval('[name=addSettingsRule]',e=>e.disabled));
  await page.focus('[name=newRuleName]');await page.keyboard.press('Enter');await direct();await settle();
  check('missing Enter and captured handler zero effects preserve earlier state',writes===0&&reads===before&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.newRuleProvider()===id&&c.newRuleLocales().join(',')==='he'&&c.newRuleName()===' Rule '&&c.ruleDraftNotice()==='Earlier receipt'&&c.error()==='Independent error'&&c.name()==='Other draft';},chosen.id));
  const capture=async label=>{await page.keyboard.press('Escape');for(const [size,width,height]of [['desktop',1280,900],['mobile',390,844]]){await page.setViewport({width,height});await page.$eval(label==='missing'?'[name=settingsRuleProviderMissing]':'[name=newRuleProvider]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-85));await settle();await page.screenshot({path:`/downloads/settings-rule-provider-preflight-${label}-${size}.png`});check(label+' '+size+' fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.setViewport({width:1280,height:900});};await capture('missing');
  for(const raw of ['',provider.id.toUpperCase(),' '+provider.id+' ','<img>','x'.repeat(100)]){await page.evaluate(v=>ng.getComponent(document.querySelector('ol-settings')).newRuleProvider.set(v),raw);await settle();await direct();check('invalid provider retained without effects '+raw.slice(0,8),writes===0&&reads===before&&await page.$eval('[name=addSettingsRule]',e=>e.disabled)&&await page.evaluate(v=>ng.getComponent(document.querySelector('ol-settings')).newRuleProvider()===v,raw));}
  for(const action of ['task.create','notify']){await page.select('[name=newRuleAction]',action);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newRuleTitle.set('Title');c.newRuleMessage.set('Message');});await settle();check('inactive provider draft does not block '+action,await page.$eval('[name=addSettingsRule]',e=>!e.disabled)&&!await page.$('#settingsRuleProviderRules'));}
  await page.select('[name=newRuleAction]','pretranslate');await page.select('[name=newRuleProvider]',provider.id);await settle();
  check('explicit listed disabled provider permits save without enablement promise',await page.$eval('[name=addSettingsRule]',e=>!e.disabled)&&await page.$eval('[name=newRuleProvider]',e=>e.selectedOptions[0].textContent.includes('disabled in loaded list'))&&await page.$eval('#settingsRuleProviderRules',e=>e.textContent.includes('does not enable')));
  await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Rule not held');await direct();check('corrected provider sends exact rule once; duplicate busy blocked',writes===1&&payloads[0].name==='Rule'&&payloads[0].config.providerId===provider.id&&payloads[0].config.locales.join(',')==='he'&&await page.$eval('[name=addSettingsRule]',e=>e.disabled));await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await settle();
  const rules=await call(P+'/automations',null,token);check('real rule persisted disabled provider reference without enabling or run',rules.length===1&&rules[0].config.providerId===provider.id&&reads===before+1&&await prisma.mtProvider.findUnique({where:{id:provider.id}}).then(p=>p.enabled===false)&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.newRuleName()===''&&c.newRuleLocales().length===0&&c.autoRules().length===1&&c.name()==='Other draft';}));await capture('saved');
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newRuleLocales.set(['he']);c.newRuleName.set('Refused rule');});await settle();refuse=true;const after=reads;await direct();await settle();check('server refusal keeps valid provider and draft without list refresh',await prisma.automationRule.count()===1&&reads===after&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.error()==='Permission denied'&&c.newRuleName()==='Refused rule'&&c.newRuleProvider()===id;},provider.id));
  const priorWrites=writes;await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).mtProviders.set([]));await settle();await direct();check('empty loaded list retains provider without fallback or request',writes===priorWrites&&await page.$eval('[name=addSettingsRule]',e=>e.disabled)&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).newRuleProvider()===id,provider.id));
  check('no rule execution translations keys tasks publications tokens webhooks deliveries',await prisma.translation.count()===0&&await prisma.key.count()===0&&await prisma.task.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no provider preflight runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
