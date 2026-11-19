// Real local browser -> settings add-member locale validation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56090, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-new-member-locales-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('new_member_locales_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/new_member_locales_browser`;
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


  const person=await call('/auth/signup',{email:'person@example.com',password:'pass1234',displayName:'Person'});
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=memberLocales]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,refuse=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET')reads++;else{writes++;if(path===`/api${P}/members`&&r.method()==='POST'){payloads.push(JSON.parse(r.postData()));if(refuse){r.respond({status:403,contentType:'application/json',body:JSON.stringify({message:'Permission denied'})});return;}held=r;return;}}}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const field=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const submit=async()=>{await page.$eval('[name=addSettingsMember]',e=>e.form.requestSubmit());await settle();};
  const poll=async()=>{for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Member POST not held');};
  await field('memberEmail','person@example.com');await field('name','Other project draft');
  check('scope rules linked no truncation and explicit Add control',await page.$eval('[name=memberLocales]',e=>e.getAttribute('aria-describedby')==='settingsNewMemberLocalesRules'&&!e.hasAttribute('maxlength'))&&await page.$eval('#settingsNewMemberLocalesRules',e=>e.textContent.includes('team-wide')&&e.textContent.includes('Admin roles')));
  await field('memberLocales',',');await page.focus('[name=memberLocales]');await page.keyboard.press('Enter');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addMember());await settle();
  check('comma-only cannot silently become unrestricted via Enter or captured handler',writes===0&&reads===0&&await page.$eval('[name=memberLocales]',e=>e.value===','&&e.getAttribute('aria-invalid')==='true')&&await page.$eval('[name=addSettingsMember]',e=>e.disabled));
  for(const raw of [' he,,en ','he,','zz','HE','x'.repeat(500)]){await field('memberLocales',raw);await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addMember());check('invalid full scope retained no effects '+raw.slice(0,12),writes===0&&reads===0&&await page.$eval('[name=memberLocales]',(e,v)=>e.value===v,raw)&&await page.$eval('[name=memberEmail]',e=>e.value==='person@example.com')&&await page.$eval('[name=name]',e=>e.value==='Other project draft'));}
  const capture=async label=>{for(const [size,width,height] of [['desktop',1280,900],['mobile',390,844]]){await page.setViewport({width,height});await page.$eval('#settingsNewMemberHeading',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await settle();await page.screenshot({path:`/downloads/settings-member-locales-validation-${label}-${size}.png`});check(label+' '+size+' fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.setViewport({width:1280,height:900});};await field('memberLocales',',');await capture('invalid');
  await field('memberLocales',' he ');await submit();await poll();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addMember());check('corrected loaded scope submitted once without blank widening',writes===1&&JSON.stringify(payloads[0].allowedLocales)==='["he"]'&&payloads[0].role==='MEMBER'&&await page.$eval('[name=addSettingsMember]',e=>e.disabled));await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await settle();let members=await call(P+'/members',null,token);check('actual membership saved with restricted scope and other project draft kept',members.some(m=>m.id===person.user.id&&JSON.stringify(m.allowedLocales)==='["he"]')&&await page.$eval('[name=name]',e=>e.value==='Other project draft')&&await page.$eval('[name=memberEmail]',e=>e.value===''));
  await field('memberEmail','person@example.com');await field('memberLocales','   ');await submit();await poll();check('explicit whitespace-only scope submits unrestricted array with guidance',JSON.stringify(payloads[1].allowedLocales)==='[]'&&await page.$eval('#settingsNewMemberLocalesRules',e=>e.textContent.includes('whitespace-only text grants all locales')));await held.continue();held=null;await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());members=await call(P+'/members',null,token);check('existing membership explicit blank upsert is unrestricted without duplicate member',members.length===2&&members.find(m=>m.id===person.user.id).allowedLocales.length===0);
  const before=reads;refuse=true;await field('memberEmail','person@example.com');await field('memberLocales','en');await submit();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('valid server refusal keeps scope email and prior server grant no refresh',reads===before&&await page.$eval('[name=memberLocales]',e=>e.value==='en')&&await page.$eval('[name=memberEmail]',e=>e.value==='person@example.com')&&(await call(P+'/members',null,token)).find(m=>m.id===person.user.id).allowedLocales.length===0);await capture('refused');
  const beforeWrites=writes,beforeReads=reads;await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.project.update(p=>({...p,locales:p.locales.filter(l=>l.code!=='en')}));});await settle();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).addMember());check('loaded locale removal makes kept exact draft invalid without fallback/read/write',writes===beforeWrites&&reads===beforeReads&&await page.$eval('[name=memberLocales]',e=>e.value==='en'&&e.getAttribute('aria-invalid')==='true'));
  check('no translations publications tokens tasks webhooks deliveries or rules',await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no member-scope validation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
