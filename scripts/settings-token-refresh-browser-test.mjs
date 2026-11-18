// Real local browser -> settings read-only token metadata refresh -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 56047, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-token-refresh-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('token_refresh_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/token_refresh_browser`;
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


  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=tokenName]');await page.waitForNetworkIdle({idleTime:200});
  let reads=0,writes=0,holdNext=false,held;
  await page.setRequestInterception(true);page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){if(r.method()==='GET'){reads++;if(path==='/api/auth/tokens'&&holdNext){holdNext=false;held=r;return;}}else writes++;}r.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const field=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const create=async name=>{await field('tokenName',name);await page.$eval('[name=createSettingsToken]',e=>e.form.requestSubmit());await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await settle();};
  const start=async()=>{held=null;holdNext=true;await page.click('[name=refreshSettingsTokens]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('Token metadata read not held');await settle();};
  const answer=async(body,status=200)=>{const r=held;held=null;await r.respond({status,contentType:'application/json',body:JSON.stringify(body)});await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).tokenListRefreshing());await settle();};
  await page.select('[name=tokenScope]','read');await create('Disposable original token');const first=(await call('/auth/tokens',null,token))[0];
  await field('tokenName','Unsubmitted token draft');await field('name','Other general draft');await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));c.tokenCopyNotice.set('Earlier copy feedback');c.error.set('Independent error');});
  const counts=[reads,writes];await start();await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).refreshTokenList());
  check('explicit refresh reads only token metadata once and blocks duplicate button and direct handler',reads===counts[0]+1&&writes===counts[1]&&await page.$eval('[name=refreshSettingsTokens]',e=>e.disabled)&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).tokens().length===1));
  await call('/auth/tokens',{name:'External disposable token',scopes:['read']},token);await answer(await call('/auth/tokens',null,token));
  check('success updates actual metadata while preserving reveal drafts copy feedback and independent error',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.tokens().length===2&&!!c.createdToken()?.token&&c.tokenName()==='Unsubmitted token draft'&&c.tokenScope()==='read'&&c.name()==='Other general draft'&&c.tokenCopyNotice()==='Earlier copy feedback'&&c.error()==='Independent error'&&c.tokenListRefreshNotice().includes('not a token authentication check');}));
  const capture=async label=>{await page.evaluate(()=>{for(const e of document.querySelectorAll('.token-reveal code'))e.textContent='R'.repeat(e.textContent.length);});await page.$eval('[name=refreshSettingsTokens]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`/downloads/settings-token-refresh-${label}-desktop.png`});await page.setViewport({width:390,height:844});await page.$eval('[name=refreshSettingsTokens]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-65));await page.screenshot({path:`/downloads/settings-token-refresh-${label}-mobile.png`});check(`${label} refresh status and controls fit390px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsTokenListRefreshNotice]',e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewport({width:1280,height:900});};
  await page.setViewport({width:390,height:844});check('actual unredacted reveal with refresh fits390px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1280,height:900});await capture('success');
  await start();await answer({message:'PRIVATE RAW SERVER DIAGNOSTIC'},503);
  check('503 retains last list reveal and drafts with bounded retry guidance',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.tokens().length===2&&!!c.createdToken()&&c.tokenName()==='Unsubmitted token draft'&&c.error()==='Independent error'&&c.tokenListRefreshNotice().includes('could not be refreshed')&&!c.tokenListRefreshNotice().includes('PRIVATE');}));await capture('failure');
  await start();await answer(await call('/auth/tokens',null,token));check('explicit retry succeeds without mutations',writes===counts[1]&&await page.$eval('[name=settingsTokenListRefreshNotice]',e=>e.textContent.includes('was refreshed')));
  const beforeRevoke=await call('/auth/tokens',null,token);await start();await page.$eval(`[name=startRevokeToken-${first.id}]`,e=>e.click());await settle();await page.$eval(`[name=confirmRevokeToken-${first.id}]`,e=>e.click());await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());await answer(beforeRevoke);
  check('late refresh cannot resurrect actually revoked token or publish stale receipt',!(await call('/auth/tokens',null,token)).some(t=>t.id===first.id)&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !c.tokens().some(t=>t.id===id)&&c.createdToken()===null&&c.tokenListRefreshNotice()==='';},first.id));
  const beforeCreate=await call('/auth/tokens',null,token);await start();await create('Replacement disposable token');await answer(beforeCreate);
  check('late refresh cannot replace metadata accepted by later explicit Create',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return !!c.createdToken()&&c.tokens().some(t=>t.id===c.createdToken().id)&&c.tokenListRefreshNotice()==='';}));
  // Empty current metadata is a valid snapshot; it does not hide the kept reveal.
  for(const t of await call('/auth/tokens',null,token))await call(`/auth/tokens/${t.id}`,null,token,'DELETE');await start();await answer(await call('/auth/tokens',null,token));
  check('empty real list keeps one-time reveal and explicit snapshot limits',await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.tokens().length===0&&!!c.createdToken()&&c.tokenListRefreshNotice().includes('list snapshot');})&&await page.$eval('#settingsTokenListRefreshScope',e=>e.textContent.includes('no longer in the list')));
  await start();await page.evaluate(()=>{window.departedSettings=ng.getComponent(document.querySelector('ol-settings'));window.departedSettings.tokenListRefreshNotice.set('');});const departureRead=held;held=null;await page.click('a.back');await page.waitForSelector('ol-editor');await departureRead.respond({status:200,contentType:'application/json',body:'[]'}).catch(()=>{});await settle();
  check('actual route departure suppresses pending refresh feedback',await page.evaluate(()=>window.departedSettings.tokenListRefreshNotice()===''&&!window.departedSettings.tokenListRefreshing())&&!await page.$('[name=settingsTokenListRefreshNotice]'));
  check('no disposable tokens tasks webhooks or deliveries remain',(await call('/auth/tokens',null,token)).length===0&&await prisma.task.count()===0&&await prisma.webhook.count()===0&&await prisma.webhookDelivery.count()===0);
  check('no token refresh runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
