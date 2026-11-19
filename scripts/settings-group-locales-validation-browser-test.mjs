// Real local browser -> settings new-group locale validation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56092, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-new-group-locales-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('new_group_locales_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/new_group_locales_browser`;
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


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=groupLocales]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,refuse=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET')reads++;else{writes++;if(path===`/api${P}/groups`&&r.method()==='POST'){payloads.push(JSON.parse(r.postData()));if(refuse){r.respond({status:403,contentType:'application/json',body:JSON.stringify({message:'Permission denied'})});return;}held=r;return;}}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const field=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const submit=async()=>{await page.$eval('[name=addSettingsGroup]',e=>e.form.requestSubmit());await settle();};
  const poll=async()=>{for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Group POST not held');};
  await field('groupName','First group');await field('name','Other project draft');
  check('scope rules linked no truncation and explicit Add group control',await page.$eval('[name=groupLocales]',e=>e.getAttribute('aria-describedby')==='settingsNewGroupLocalesRules'&&!e.hasAttribute('maxlength'))&&await page.$eval('#settingsNewGroupLocalesRules',e=>e.textContent.includes('team-wide')&&e.textContent.includes('Admin roles')&&e.textContent.includes('does not add members')));
  await field('groupLocales',',');await page.focus('[name=groupLocales]');await page.keyboard.press('Enter');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addGroup());await settle();
  check('comma-only cannot silently become unrestricted via Enter or captured handler',writes===0&&reads===0&&await page.$eval('[name=groupLocales]',e=>e.value===','&&e.getAttribute('aria-invalid')==='true')&&await page.$eval('[name=addSettingsGroup]',e=>e.disabled));
  for(const raw of [' he,,en ','he,','zz','HE','x'.repeat(500)]){await field('groupLocales',raw);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addGroup());check('invalid full scope retained no effects '+raw.slice(0,12),writes===0&&reads===0&&await page.$eval('[name=groupLocales]',(e,v)=>e.value===v,raw)&&await page.$eval('[name=groupName]',e=>e.value==='First group')&&await page.$eval('[name=name]',e=>e.value==='Other project draft'));}
  const capture=async label=>{for(const [size,width,height] of [['desktop',1280,900],['mobile',390,844]]){await page.setViewport({width,height});await page.$eval('#settingsNewGroupHeading',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await settle();await page.screenshot({path:`/downloads/settings-group-locales-validation-${label}-${size}.png`});check(label+' '+size+' fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.setViewport({width:1280,height:900});};await field('groupLocales',',');await capture('invalid');
  await field('groupLocales',' he ');await submit();await poll();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addGroup());check('corrected loaded scope submitted once without blank widening',writes===1&&JSON.stringify(payloads[0].allowedLocales)==='["he"]'&&payloads[0].role==='MEMBER'&&payloads[0].name==='First group'&&await page.$eval('[name=addSettingsGroup]',e=>e.disabled));await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await settle();let groups=await call(P+'/groups',null,token);check('actual group saved with restricted scope and other project draft kept',groups.length===1&&groups[0].name==='First group'&&JSON.stringify(groups[0].allowedLocales)==='["he"]'&&groups[0].members.length===0&&await page.$eval('[name=name]',e=>e.value==='Other project draft')&&await page.$eval('[name=groupName]',e=>e.value===''));
  await field('groupName','Explicit all locales');await field('groupLocales','   ');await submit();await poll();check('explicit whitespace-only scope submits unrestricted array with guidance',JSON.stringify(payloads[1].allowedLocales)==='[]'&&await page.$eval('#settingsNewGroupLocalesRules',e=>e.textContent.includes('whitespace-only text grants all locales')));await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());groups=await call(P+'/groups',null,token);check('second explicit blank group unrestricted prior restricted group unchanged no members added',groups.length===2&&groups.find(g=>g.name==='Explicit all locales').allowedLocales.length===0&&JSON.stringify(groups.find(g=>g.name==='First group').allowedLocales)==='["he"]'&&groups.every(g=>g.members.length===0));
  const before=reads;refuse=true;await field('groupName','Unsent group');await field('groupLocales','en');await submit();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('valid server refusal keeps full draft and saved groups no refresh',reads===before&&await page.$eval('[name=groupLocales]',e=>e.value==='en')&&await page.$eval('[name=groupName]',e=>e.value==='Unsent group')&&(await call(P+'/groups',null,token)).length===2);await capture('refused');
  const beforeWrites=writes,beforeReads=reads;await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.project.update(p=>({...p,locales:p.locales.filter(l=>l.code!=='en')}));});await settle();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addGroup());check('loaded locale removal makes kept exact draft invalid without fallback/read/write',writes===beforeWrites&&reads===beforeReads&&await page.$eval('[name=groupLocales]',e=>e.value==='en'&&e.getAttribute('aria-invalid')==='true'));
  check('no translations publications tokens tasks webhooks deliveries or rules',await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no group-scope validation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
