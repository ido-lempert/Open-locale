// Real local browser -> settings pending member draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55976, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-token-name-discard-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('token_name_discard_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/token_name_discard_browser`;
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


  // Credentials exist only in this disposable local database, never a real account.
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=tokenName]');await page.waitForNetworkIdle({idleTime:200});
  let writes=0,reads=0,held,failRead=false;
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(path.startsWith('/api/')&&['POST','PATCH','PUT','DELETE'].includes(req.method())){writes++;if(req.method()==='POST'&&path==='/api/auth/tokens'){held=req;return;}}req.continue();});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const replace=async(name,value)=>{await page.$eval(`[name=${name}]`,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle();};
  const click=async name=>{await page.$eval(`[name=${name}]`,e=>e.scrollIntoView({block:'center'}));await page.click(`[name=${name}]`);await settle();};
  const select=async value=>{await page.select('[name=tokenScope]',value);await settle();};
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Token POST not held');};
  const done=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  check('empty name discard disabled',await page.$eval('[name=discardSettingsTokenName]',e=>e.disabled));
  await replace('tokenName','   ');await replace('name','Other project draft');await select('read,write');await click('discardSettingsTokenName');check('raw whitespace name cleared locally while access and other form stay',writes===0&&reads===0&&await page.$eval('[name=tokenName]',e=>e.value==='')&&await page.$eval('[name=name]',e=>e.value==='Other project draft')&&await page.$eval('[name=tokenScope]',e=>e.value==='read,write'));if(failures)throw new Error('Name discard absent');
  await select('read');await replace('tokenName','First');await click('createSettingsToken');await poll();await replace('tokenName','Next');await select('read,write');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).discardTokenNameDraft());check('pending create blocks button and direct discard preserving newer name',writes===1&&await page.$eval('[name=discardSettingsTokenName]',e=>e.disabled)&&await page.$eval('[name=tokenName]',e=>e.value==='Next'));await held.continue();await done();
  const beforeReads=reads,beforeWrites=writes;const savedId=await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).createdToken().id);await click('discardSettingsTokenName');let tokens=await call('/auth/tokens',null,token);check('discard keeps actual read-only token and reveal without requests or stale retained claim',tokens.length===1&&tokens[0].id===savedId&&tokens[0].name==='First'&&JSON.stringify(tokens[0].scopes)==='["read"]'&&!('token' in tokens[0])&&reads===beforeReads&&writes===beforeWrites&&await page.$eval('[name=tokenName]',e=>e.value==='')&&await page.$eval('[name=settingsTokenDraftNotice]',e=>e.textContent.includes('name draft was discarded')&&!e.textContent.includes('kept here'))&&await page.evaluate(id=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.createdToken().id===id&&c.createdToken().token.length>=24&&c.tokenScope()==='read,write';},savedId));
  held=null;failRead=true;await select('read');await replace('tokenName','Saved');await click('createSettingsToken');await poll();await replace('tokenName','Unsent');await select('read,write');await held.continue();await done();const failedReads=reads,failedWrites=writes;await click('discardSettingsTokenName');tokens=await call('/auth/tokens',null,token);check('503 reset preserves accepted read-only token reveal error and selected access without requests',tokens.length===2&&tokens.some(t=>t.name==='Saved'&&JSON.stringify(t.scopes)==='["read"]')&&!tokens.some(t=>t.name==='Unsent')&&reads===failedReads&&writes===failedWrites&&await page.$eval('[name=tokenName]',e=>e.value==='')&&await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-settings'));return c.error()==='Refresh failed'&&c.createdToken().id&&c.createdToken().token.length>=24&&c.tokenScope()==='read,write';})&&await page.$eval('[name=settingsTokenDraftNotice]',e=>e.textContent.includes('name draft was discarded')));
  await replace('tokenName','New unsent name');await page.evaluate(()=>{for(const e of document.querySelectorAll('.token-reveal code'))e.textContent='[local fixture token hidden]';});await page.$eval('[name=discardSettingsTokenName]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-token-name-discard-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=discardSettingsTokenName]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-90));await page.screenshot({path:'/downloads/settings-token-name-discard-mobile.png'});check('390px name discard and receipt fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsTokenDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  for(const t of tokens){const r=await fetch(`${API}/auth/tokens/${t.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Demo token cleanup failed');}check('isolated fixture tokens revoked before teardown',(await call('/auth/tokens',null,token)).length===0);
  check('no name discard runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
