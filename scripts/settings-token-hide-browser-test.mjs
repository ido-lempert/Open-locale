// Real local browser -> settings pending token draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56035, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-token-hide-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('token_hide_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/token_hide_browser`;
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


  // Local disposable credentials only; no raw token bytes in logs or screenshots.
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=tokenName]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,heldRead,holdRead=true,failRead=false,failWrite=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(path==='/api/auth/tokens'&&holdRead){heldRead=req;return;}}if(path.startsWith('/api/')&&['POST','PATCH','PUT','DELETE'].includes(req.method())){writes++;if(path==='/api/auth/tokens'&&req.method()==='POST'){if(failWrite)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}}req.continue();});
  const replace=async(value)=>{await page.$eval('[name=tokenName]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
  const poll=async(kind)=>{for(let n=0;n<150;n++){if(kind==='write'?held:heldRead)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Token request not held: '+kind);};
  const submit=()=>page.$eval('[name=createSettingsToken]',e=>e.form.requestSubmit());
  const done=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  check('no hide control before one-time reveal',!await page.$('[name=hideCreatedToken]'));
  await page.select('[name=tokenScope]','read');await replace('First local token');await submit();await poll('write');await replace('Newer name draft');await held.continue();await poll('read');
  check('accepted reveal visible while list refresh pending with Hide available',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.busy()&&!!c.createdToken()?.token;})&&await page.$('[name=hideCreatedToken]')&&await page.$eval('[name=settingsTokenRevealScope]',e=>e.textContent.includes('does not revoke')&&e.textContent.includes('clipboard')));
  // Exercise authentication without returning or printing credential bytes.
  check('real created read token authenticates before hide',await page.evaluate(async()=>{const t=ng.getComponent(document.querySelector('ol-settings')).createdToken().token;return (await fetch('/api/projects',{headers:{'X-Api-Key':t}})).status===200;}));
  await page.setViewport({width:390,height:844});check('actual one-time token and Hide fit at390px before screenshot redaction',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=hideCreatedToken]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});
  // Screenshots redact only disposable test-token DOM text, never print bytes.
  await page.evaluate(()=>{for(const e of document.querySelectorAll('.token-reveal code'))e.textContent='R'.repeat(e.textContent.length);});
  await page.$eval('[name=hideCreatedToken]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-token-hide-control-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('.token-reveal',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-token-hide-control-mobile.png'});await page.setViewport({width:1280,height:900});
  const counts=[reads,writes];await page.click('[name=hideCreatedToken]');await page.waitForSelector('[name=settingsTokenRevealNotice]');
  check('Hide clears signal and DOM with no request and keeps newer draft',reads===counts[0]&&writes===counts[1]&&!await page.$('[name=hideCreatedToken]')&&!await page.$('.token-reveal')&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.createdToken()===null&&c.tokenName()==='Newer name draft'&&c.tokenScope()==='read'&&c.busy();}));
  check('hidden receipt says not revoked or cleared and draft receipt no longer claims reveal above',await page.$eval('[name=settingsTokenRevealNotice]',e=>e.textContent.includes('not revoked')&&e.textContent.includes('not cleared'))&&await page.$eval('[name=settingsTokenDraftNotice]',e=>e.textContent.includes('hidden reveal belonged')&&!e.textContent.includes('revealed above')));
  if(failures)throw new Error('Local token hide did not clear the reveal');
  holdRead=false;await heldRead.continue();await done();let tokens=await call('/auth/tokens',null,token);
  check('successful held refresh cannot restore reveal or revoke saved token',tokens.length===1&&tokens[0].name==='First local token'&&!('token' in tokens[0])&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).createdToken()===null)&&!await page.$('.token-reveal'));
  await page.$eval('[name=settingsTokenRevealNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-token-hide-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsTokenRevealNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-token-hide-mobile.png'});
  check('390px hidden status and draft receipt fit without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsTokenRevealNotice]',e=>e.getBoundingClientRect().right<=innerWidth)&&await page.$eval('[name=settingsTokenDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  await page.$eval('[name=discardSettingsTokenName]',e=>e.click());await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));check('discard after hide keeps hidden status and truthful accepted receipt',await page.$eval('[name=tokenName]',e=>e.value==='')&&await page.$eval('[name=settingsTokenDraftNotice]',e=>e.textContent.includes('no longer shown')&&!e.textContent.includes('revealed above'))&&await page.$('[name=settingsTokenRevealNotice]'));
  held=null;heldRead=null;holdRead=true;await replace('Second local token');await submit();await poll('write');await held.continue();await poll('read');
  check('explicit later Create reveals only its new token and clears hidden notice',await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !!c.createdToken()?.token&&c.createdToken().id!==id;},tokens[0].id)&&await page.$('[name=hideCreatedToken]')&&!await page.$('[name=settingsTokenRevealNotice]'));
  await page.$eval('[name=hideCreatedToken]',e=>e.click());await page.waitForSelector('[name=settingsTokenRevealNotice]');await heldRead.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});await done();tokens=await call('/auth/tokens',null,token);
  check('503 after hide keeps both actual saved tokens hidden without replay',tokens.length===2&&writes===2&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.createdToken()===null&&c.error()==='Refresh failed';})&&!await page.$('.token-reveal'));
  const before=reads;failWrite=true;await replace('Refused local token');await submit();await done();check('refused later Create cannot restore bytes or clear hidden status',reads===before&&writes===3&&!await page.$('.token-reveal')&&await page.$('[name=settingsTokenRevealNotice]')&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied'));
  check('no unrelated tasks or webhook deliveries',await prisma.task.count()===0&&await prisma.webhookDelivery.count()===0);
  for(const t of tokens){const r=await fetch(`${API}/auth/tokens/${t.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Demo token cleanup failed');}check('disposable test tokens explicitly revoked at teardown',(await call('/auth/tokens',null,token)).length===0);
  check('no token hide runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
