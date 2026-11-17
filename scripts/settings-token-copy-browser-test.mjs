// Real local browser -> settings truthful token clipboard feedback -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56041, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-token-copy-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('token_copy_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/token_copy_browser`;
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


  // Disposable local tokens only. Native clipboard bytes never leave the browser.
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=tokenName]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0;page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')){if(r.method()==='GET')reads++;else writes++;}});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const replace=async(value)=>{await page.$eval('[name=tokenName]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const create=async(name)=>{await replace(name);await page.$eval('[name=createSettingsToken]',e=>e.form.requestSubmit());await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy()&&!!ng.getComponent(document.querySelector('ol-settings')).createdToken());await settle();};
  const clickCopy=()=>page.click('[name=copyCreatedToken]');
  const waitCopy=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).tokenCopyPending());
  const notice=()=>page.$eval('[name=settingsTokenCopyNotice]',e=>e.textContent);
  await page.select('[name=tokenScope]','read');await create('First disposable copy token');await replace('Unsubmitted newer draft');
  const context=browser.defaultBrowserContext();await context.overridePermissions(WEB,['clipboard-read','clipboard-sanitized-write']);await page.bringToFront();
  const counts=[reads,writes];await clickCopy();await waitCopy();
  check('native clipboard write accepts exact current token without network effects',await page.evaluate(async()=>await navigator.clipboard.readText()===ng.getComponent(document.querySelector('ol-settings')).createdToken().token)&&reads===counts[0]&&writes===counts[1]);
  check('success feedback is bounded and preserves reveal draft and read-only choice',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.tokenCopyNotice().includes('browser accepted')&&c.tokenCopyNotice().includes('does not confirm pasting')&&!c.tokenCopyNotice().includes(c.createdToken().token)&&c.tokenName()==='Unsubmitted newer draft'&&c.tokenScope()==='read';}));
  await page.setViewport({width:390,height:844});check('actual unredacted token and Copy success fit390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsTokenCopyNotice]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});
  const capture=async(label)=>{await page.evaluate(()=>{for(const e of document.querySelectorAll('.token-reveal code'))e.textContent='R'.repeat(e.textContent.length);});await page.$eval('[name=settingsTokenCopyNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`/downloads/settings-token-copy-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('.token-reveal',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await page.screenshot({path:`/downloads/settings-token-copy-${label}-mobile.png`});await page.setViewport({width:1280,height:900});};
  await capture('success');
  // Real Chrome permission denial, not a mocked application result.
  const cdp=await page.createCDPSession();await cdp.send('Browser.setPermission',{permission:{name:'clipboard-write',allowWithoutSanitization:true},setting:'denied',origin:WEB});await cdp.send('Browser.setPermission',{permission:{name:'clipboard-write',allowWithoutSanitization:false},setting:'denied',origin:WEB});
  await clickCopy();await waitCopy();check('real clipboard denial is visible without lost reveal or raw error',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !!c.createdToken()&&c.tokenCopyNotice().includes('did not confirm')&&c.tokenCopyNotice().includes('copy it manually')&&!c.tokenCopyNotice().includes('NotAllowedError')&&!c.tokenCopyNotice().includes(c.createdToken().token);}));
  await page.setViewport({width:390,height:844});check('clipboard failure feedback fits390px without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsTokenCopyNotice]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});await capture('failure');await context.overridePermissions(WEB,['clipboard-read','clipboard-sanitized-write']);await clickCopy();await waitCopy();check('explicit retry after denial reports actual browser acceptance',(await notice()).includes('browser accepted'));
  const hold=()=>page.evaluate(()=>{window.copyNative= navigator.clipboard.writeText.bind(navigator.clipboard);window.copyCalls=0;Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:value=>{window.copyCalls++;return new Promise((resolve,reject)=>{window.finishCopy=async fail=>{try{if(fail)throw new Error('PRIVATE CLIPBOARD DIAGNOSTIC');await window.copyNative(value);resolve();}catch(e){reject(e);}};});}});});
  const finish=async fail=>{await page.evaluate(f=>window.finishCopy(f),fail);await waitCopy();await settle();};
  await hold();await clickCopy();await page.waitForSelector('[name=settingsTokenCopyPending]');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).copyCreatedToken());
  check('held clipboard write disables duplicate button and direct invocation',await page.$eval('[name=copyCreatedToken]',e=>e.disabled)&&await page.evaluate(()=>window.copyCalls===1)&&!await page.$('[name=settingsTokenCopyNotice]'));
  await page.click('[name=hideCreatedToken]');await settle();check('Hide clears copy feedback but warns pending write may still finish',!await page.$('.token-reveal')&&!await page.$('[name=settingsTokenCopyNotice]')&&await page.$eval('[name=settingsTokenRevealNotice]',e=>e.textContent.includes('may still finish')));await finish(false);
  check('late actual clipboard completion after Hide cannot restore success or reveal',!await page.$('[name=settingsTokenCopyNotice]')&&!await page.$('.token-reveal')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).tokenCopyNotice()===''));
  await create('Second disposable copy token');await clickCopy();await create('Third disposable copy token');
  check('new reveal waits for old pending write rather than racing clipboard',await page.$eval('[name=copyCreatedToken]',e=>e.disabled)&&!await page.$('[name=settingsTokenCopyNotice]'));await finish(true);
  check('old rejected write cannot label replacement reveal',!await page.$('[name=settingsTokenCopyNotice]')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).createdToken().name==='Third disposable copy token'));
  await clickCopy();await finish(false);check('explicit replacement Copy uses exact new token',await page.evaluate(async()=>await navigator.clipboard.readText()===ng.getComponent(document.querySelector('ol-settings')).createdToken().token)&&(await notice()).includes('browser accepted'));
  await clickCopy();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).askRevokeToken(ng.getComponent(document.querySelector('ol-settings')).createdToken().id));await settle();await page.$eval('[name^=confirmRevokeToken-]',e=>e.click());await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await finish(false);
  check('revocation clears reveal and fences old copy result',!await page.$('.token-reveal')&&!await page.$('[name=settingsTokenCopyNotice]')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).tokenCopyNotice()===''));
  await create('Departure disposable copy token');await clickCopy();await page.evaluate(()=>{window.departedSettings=ng.getComponent(document.querySelector('ol-settings'));});await page.click('a.back');await page.waitForSelector('ol-editor');await page.evaluate(()=>window.finishCopy(false));await settle();check('actual route departure destroys component and suppresses late copy notice',await page.evaluate(()=>window.departedSettings.tokenCopyNotice()==='')&&!await page.$('[name=settingsTokenCopyNotice]'));
  check('no unrelated tasks webhooks or deliveries',await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0);
  const tokens=await call('/auth/tokens',null,token);for(const t of tokens){const r=await fetch(`${API}/auth/tokens/${t.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Disposable cleanup failed');}check('all disposable tokens revoked at teardown',(await call('/auth/tokens',null,token)).length===0);
  await page.evaluate(()=>window.copyNative(''));check('no Copy runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
