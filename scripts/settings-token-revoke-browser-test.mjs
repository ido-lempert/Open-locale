// Real local browser -> guarded API-token revocation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.SETTINGS_ACCESS_REMOVE_TEST_PG_PORT ?? 55998), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-token-revoke-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('token_revoke_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/token_revoke_browser`;
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


  const first=await call('/auth/tokens',{name:'First token',scopes:['read']},token);
  const other=await call('/auth/tokens',{name:'Other token',scopes:['read']},token);
  const tokenStatus=key=>fetch(`${API}/projects`,{headers:{'X-Api-Key':key}}).then(r=>r.status);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`[name=startRevokeToken-${first.id}]`);await page.waitForNetworkIdle({idleTime:200});
  let deletes=0,reads=0,held,refuse=true,failRead=false;const readPaths=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;readPaths.push(path);if(failRead&&path==='/api/auth/tokens')return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='DELETE'&&path===`/api/auth/tokens/${first.id}`){deletes++;if(refuse)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const direct=id=>page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).revokeToken(id),id);
  await direct(first.id);check('unconfirmed direct token revoke makes no request',deletes===0&&reads===0);if(failures)throw new Error('Token confirmation guard absent');
  await click('startRevokeToken-'+other.id);await direct(first.id);check('wrong target confirmation does not authorize revoke',deletes===0);await click('cancelRevokeToken-'+other.id);
  await click('startRevokeToken-'+first.id);await page.screenshot({path:'/downloads/settings-token-revoke-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(`[name=confirmRevokeToken-${first.id}]`,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-token-revoke-confirm-mobile.png'});await page.setViewport({width:1280,height:900});await click('cancelRevokeToken-'+first.id);await direct(first.id);check('cancel requires new explicit matching confirmation',deletes===0&&!!await page.$(`[name=startRevokeToken-${first.id}]`));
  await page.evaluate(({id,raw})=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.createdToken.set({id,name:'First token',token:raw});c.tokenName.set('Unsent token');c.name.set('Other draft');},{id:first.id,raw:first.token});await settle();await click('startRevokeToken-'+first.id);await click('confirmRevokeToken-'+first.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());check('403 retains confirmation reveal and saved token without reload',deletes===1&&reads===0&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.confirmingToken()===id&&c.createdToken()?.id===id&&c.error()==='Permission denied'&&!c.tokenRevokeNotice();},first.id)&&(await call('/auth/tokens',null,token)).length===2);
  check('refused revoke leaves both tokens usable',await tokenStatus(first.token)===200&&await tokenStatus(other.token)===200);
  refuse=false;failRead=true;await click('confirmRevokeToken-'+first.id);for(let n=0;n<150&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Token DELETE not held');await direct(first.id);await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.cancelRevokeToken();c.askRevokeToken(id);},other.id);await settle();check('held revoke blocks duplicate cancel and other target start',deletes===2&&await page.$eval(`[name=confirmRevokeToken-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=cancelRevokeToken-${first.id}]`,e=>e.disabled)&&await page.$eval(`[name=startRevokeToken-${other.id}]`,e=>e.disabled)&&await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).confirmingToken()===id,first.id));
  await held.continue();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await direct(first.id);await page.evaluate(id=>ng.getComponent(document.querySelector('ol-settings')).askRevokeToken(id),first.id);const tokens=await call('/auth/tokens',null,token);check('accepted revoke503 removes target locally and on server without retry or stale reveal',deletes===2&&tokens.length===1&&tokens[0].id===other.id&&!await page.$(`[name=startRevokeToken-${first.id}]`)&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.tokens().length===1&&c.tokens()[0].id===id&&c.createdToken()===null&&c.confirmingToken()===null&&c.error()==='Refresh failed'&&c.tokenName()==='Unsent token'&&c.name()==='Other draft'&&c.tokenRevokeNotice().includes('was revoked');},other.id));
  check('revoked token actually fails authentication while other token works',await tokenStatus(first.token)===401&&await tokenStatus(other.token)===200);
  check('only selected token row is deleted',await prisma.apiToken.count({where:{id:first.id}})===0&&await prisma.apiToken.count({where:{id:other.id}})===1);
  await page.$eval('[name=settingsTokenRevokeNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-token-revoke-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=settingsTokenRevokeNotice]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-110));await page.screenshot({path:'/downloads/settings-token-revoke-mobile.png'});check('390px accepted revocation receipt fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('failed revoke refresh reads tokens only',reads===1&&readPaths.every(p=>p==='/api/auth/tokens'));
  failRead=false;
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.name.set('Retained name');c.description.set('Retained description');c.tokenName.set('Next token');c.tokenScope.set('read');c.newRuleName.set('Next rule');c.createdToken.set({id:'local-display-only',name:'Kept display',token:'not-a-real-token'});});await settle();
  await page.setViewport({width:1280,height:900});await click('startRevokeToken-'+other.id);await click('confirmRevokeToken-'+other.id);await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  check('successful revoke refresh keeps unrelated drafts and nonmatching display',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.tokens().length===0&&c.name()==='Retained name'&&c.description()==='Retained description'&&c.tokenName()==='Next token'&&c.tokenScope()==='read'&&c.newRuleName()==='Next rule'&&c.createdToken()?.id==='local-display-only'&&c.error()===''&&c.tokenRevokeNotice().includes('was revoked');}));
  check('successful revoke uses tokens-only read and revokes the other token',reads===2&&readPaths.every(p=>p==='/api/auth/tokens')&&await tokenStatus(other.token)===401&&await prisma.apiToken.count()===0);
  check('no tasks translations or webhook deliveries',await prisma.task.count()===0&&await prisma.translation.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no token revoke runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
