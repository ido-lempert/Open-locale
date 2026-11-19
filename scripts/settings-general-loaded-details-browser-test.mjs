// Real local browser -> settings read-only origin list refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56086, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-general-loaded-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('general_loaded_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/general_loaded_browser`;
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


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=settingsLoadedGeneralName]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,failNext=false;await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path===`/api${P}`&&failNext){failNext=false;r.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'PRIVATE'})});return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const text=name=>page.$eval(`[name=${name}]`,e=>e.textContent);
  const field=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const refresh=async()=>{await click('refreshSettingsGeneralMetadata');await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).generalMetadataRefreshing());await settle();};
  const capture=async label=>{for(const [size,width,height] of [['desktop',1280,900],['mobile',390,844]]){await page.setViewport({width,height});await page.$eval('#settingsLoadedGeneralHeading',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await settle();await page.screenshot({path:`/downloads/settings-general-loaded-details-${label}-${size}.png`});check(label+' '+size+' fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.setViewport({width:1280,height:900});};
  check('loaded exact initial name and explicit empty description visible',await text('settingsLoadedGeneralName')==='Sync browser'&&await text('settingsLoadedGeneralDescription')==='Empty description');
  check('matching input copy bounded to loaded details',await text('settingsGeneralInputComparison').then(t=>t.includes('match the loaded')&&t.includes('does not check newer server')));
  const before=reads;await field('name','Local name');check('real name typing changes only name comparison with no requests',await text('settingsGeneralInputComparison').then(t=>t.includes('Name input differs'))&&await text('settingsLoadedGeneralName')==='Sync browser'&&reads===before&&writes===0);
  await field('description','Local description');check('both differences named without modifying loaded values',await text('settingsGeneralInputComparison').then(t=>t.includes('Name and description inputs differ'))&&await text('settingsLoadedGeneralDescription')==='Empty description');
  await field('name','Sync browser');check('description-only difference identified',await text('settingsGeneralInputComparison').then(t=>t.includes('Description input differs')));
  await call(P,{name:'Server name',description:'Server description'},token,'PATCH');await refresh();
  check('actual read refresh shows server details alongside retained local inputs',await text('settingsLoadedGeneralName')==='Server name'&&await text('settingsLoadedGeneralDescription')==='Server description'&&await page.$eval('[name=name]',e=>e.value==='Sync browser')&&await page.$eval('[name=description]',e=>e.value==='Local description')&&await text('settingsGeneralInputComparison').then(t=>t.includes('Name and description inputs differ')));
  await capture('different');failNext=true;await refresh();check('failure keeps comparison and loaded values without raw error',await text('settingsLoadedGeneralName')==='Server name'&&await text('settingsGeneralInputComparison').then(t=>t.includes('Name and description inputs differ'))&&await text('settingsGeneralMetadataRefreshNotice').then(t=>t.includes('could not')&&!t.includes('PRIVATE')));
  await click('discardSettingsGeneral');check('real local Discard matches both loaded fields without a save',await text('settingsGeneralInputComparison').then(t=>t.includes('match the loaded'))&&await page.$eval('[name=name]',e=>e.value==='Server name')&&await page.$eval('[name=description]',e=>e.value==='Server description')&&writes===0);
  await field('name',' Server name');check('outer whitespace is a local exact difference',await text('settingsGeneralInputComparison').then(t=>t.includes('Name input differs')));await click('discardSettingsGeneral');
  const markup='<img src=x onerror=alert(1)> & <script>unsafe</script>';await call(P,{name:markup,description:'  Line one\nLine two \n '},token,'PATCH');await refresh();
  check('loaded markup displayed as text never interpreted',await page.$eval('[name=settingsLoadedGeneralName] .loaded-general-value',e=>e.textContent===e.innerText&&!e.querySelector('img,script'))&&await text('settingsLoadedGeneralName')===markup);
  check('loaded newlines and outer whitespace kept by display style',await page.$eval('[name=settingsLoadedGeneralDescription] .loaded-general-value',e=>e.textContent==='  Line one\nLine two \n '&&getComputedStyle(e).whiteSpace==='pre-wrap'));
  await call(P,{name:'X'.repeat(120),description:'Y'.repeat(2000)},token,'PATCH');await refresh();await page.setViewport({width:390,height:844});check('full API-length unbroken text preserved and wraps390px',await text('settingsLoadedGeneralName').then(t=>t.length===120)&&await text('settingsLoadedGeneralDescription').then(t=>t.length===2000)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});
  await call(P,{name:'',description:'   '},token,'PATCH');await refresh();check('exact empty and whitespace-only are visibly distinct without normalization',await text('settingsLoadedGeneralName')==='Empty name'&&await text('settingsLoadedGeneralDescription').then(t=>t.includes('Whitespace-only description'))&&await page.$eval('[name=settingsLoadedGeneralDescription] .loaded-general-value',e=>e.textContent==='   '));await capture('empty');
  const person=await call('/auth/signup',{email:'member@example.com',password:'pass1234',displayName:'Member'});await call(P+'/members',{email:person.user.email,role:'MEMBER',allowedLocales:[]},token);await page.evaluate(t=>localStorage.setItem('ol_token',t),person.accessToken);await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=settingsLoadedGeneralName]');await page.waitForNetworkIdle({idleTime:200});
  check('real direct member sees loaded values but no admin form or local comparison',await text('settingsLoadedGeneralName')==='Empty name'&&await text('settingsLoadedGeneralDescription').then(t=>t.includes('Whitespace-only description'))&&!await page.$('[name=saveSettingsGeneral]')&&!await page.$('[name=discardSettingsGeneral]')&&!await page.$('[name=settingsGeneralInputComparison]'));
  check('display typing refresh discard and member navigation UI zero writes',writes===0);
  check('no translations publications tokens tasks webhooks deliveries or rules',await prisma.translation.count()===0&&await prisma.otaPublication.count()===0&&await prisma.apiToken.count()===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0&&await prisma.automationRule.count()===0);
  check('no loaded-details runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
