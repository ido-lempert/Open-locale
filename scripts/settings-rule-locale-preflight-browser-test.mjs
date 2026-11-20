// Real local browser -> settings Fill empty exact loaded branch preflight -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56102, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
let completed=false;
process.on('exit',()=>{if(!completed)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-rule-locale-preflight-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('rule_locale_preflight_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/rule_locale_preflight_browser`;
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
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=newRuleAction]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,held,refuse=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET')reads++;else{writes++;if(path===`/api${P}/automations`){payloads.push(JSON.parse(r.postData()));if(refuse)return r.respond({status:403,contentType:'application/json',body:JSON.stringify({message:'Permission denied'})});if(payloads.at(-1).config.locales?.length!==1 || payloads.at(-1).config.locales.some(code=>code!=='he'))return r.respond({status:400,contentType:'application/json',body:JSON.stringify({message:'Invalid targets'})});held=r;return;}}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const direct=()=>page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addRule());
  await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newRuleProvider.set(id);c.newRuleLocales.set(['he','gone']);c.newRuleName.set(' Rule ');c.ruleDraftNotice.set('Earlier receipt');c.error.set('Independent error');c.name.set('Other draft');},provider.id);await settle();
  check('retained missing checked target blocks Add with linked rules',await page.$eval('[name=missingRuleLoc-gone]',e=>e.checked&&e.getAttribute('aria-invalid')==='true'&&e.getAttribute('aria-describedby')==='settingsRuleLocaleRules')&&await page.$eval('[name=addSettingsRule]',e=>e.disabled));
  await page.focus('[name=newRuleName]');await page.keyboard.press('Enter');await direct();await settle();
  check('missing Enter and captured handler zero effects preserve full earlier state',writes===0&&reads===0&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.newRuleLocales().join(',')==='he,gone'&&c.newRuleName()===' Rule '&&c.ruleDraftNotice()==='Earlier receipt'&&c.error()==='Independent error'&&c.name()==='Other draft';}));
  const capture=async label=>{await page.keyboard.press('Escape');for(const [size,width,height]of [['desktop',1280,900],['mobile',390,844]]){await page.setViewport({width,height});await page.$eval('[name=newRuleAction]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-85));await settle();await page.screenshot({path:`/downloads/settings-rule-locale-preflight-${label}-${size}.png`});check(label+' '+size+' fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.setViewport({width:1280,height:900});};await capture('missing');
  for(const raw of [[],[''],['en'],['HE'],[' he '],['<img>'],['he','he','he','he','he','he']]){await page.evaluate(v=>ng.getComponent(document.querySelector('ol-settings')).newRuleLocales.set(v),raw);await settle();await direct();check('invalid selection retained without effects '+JSON.stringify(raw),writes===0&&reads===0&&await page.$eval('[name=addSettingsRule]',e=>e.disabled)&&await page.evaluate(v=>JSON.stringify(ng.getComponent(document.querySelector('ol-settings')).newRuleLocales())===JSON.stringify(v),raw));}
  for(const action of ['task.create','notify']){await page.select('[name=newRuleAction]',action);await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newRuleTitle.set('Title');c.newRuleMessage.set('Message');});await settle();check('inactive locale draft does not block '+action,await page.$eval('[name=addSettingsRule]',e=>!e.disabled)&&!await page.$('[name=settingsRuleLocaleRules]'));}
  await page.select('[name=newRuleAction]','pretranslate');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).newRuleLocales.set(['he','gone']));await settle();await page.$eval('[name=missingRuleLoc-gone]',e=>e.click());await settle();
  check('explicit uncheck corrects only missing target without reads or save',writes===0&&reads===0&&await page.$eval('[name=addSettingsRule]',e=>!e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).newRuleLocales().join(',')==='he'));
  await page.$eval('[name=addSettingsRule]',e=>e.form.requestSubmit());for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Rule not held');await direct();check('corrected targets send exact rule once; duplicate busy blocked',writes===1&&payloads[0].name==='Rule'&&payloads[0].config.providerId===provider.id&&payloads[0].config.locales.join(',')==='he'&&await page.$eval('[name=addSettingsRule]',e=>e.disabled));await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await settle();
  const rules=await call(P+'/automations',null,token);check('real rule persisted and existing clear/list-refresh behavior unchanged',rules.length===1&&rules[0].config.locales.join(',')==='he'&&reads===1&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.newRuleName()===''&&c.newRuleLocales().length===0&&c.autoRules().length===1&&c.name()==='Other draft';}));await capture('saved');
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.newRuleLocales.set(['he']);c.newRuleName.set('Refused rule');});await settle();refuse=true;const before=reads;await direct();await settle();check('server refusal retains valid selection and draft without list refresh',await prisma.automationRule.count()===1&&reads===before&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.error()==='Permission denied'&&c.newRuleName()==='Refused rule'&&c.newRuleLocales().join(',')==='he';}));
  check('no rule execution translations keys tasks publications tokens webhooks deliveries',await prisma.translation.count()===0&&await prisma.key.count()===0&&await prisma.task.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no locale preflight runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
