// Real local browser -> settings pending token draft preservation -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55960, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-token-draft-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('token_draft_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/token_draft_browser`;
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


  // All credentials in this test exist only in its disposable demo database.
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector('[name=tokenName]');await page.waitForNetworkIdle({idleTime:200});
  let creates=0,reads=0,held,failCreate=false,failRead=false;const payloads=[];
  await page.setRequestInterception(true);page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/')&&req.method()==='GET'){reads++;if(failRead&&path===`/api${P}`)return req.respond({status:503,contentType:'application/json',body:'{"message":"Refresh failed"}'});}if(req.method()==='POST'&&path==='/api/auth/tokens'){creates++;payloads.push(JSON.parse(req.postData()));if(failCreate)return req.respond({status:403,contentType:'application/json',body:'{"message":"Permission denied"}'});held=req;return;}req.continue();});
  const replace=async(value)=>page.$eval('[name=tokenName]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const poll=async()=>{for(let n=0;n<150;n++){if(held)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Token request not held');};
  const submit=()=>page.$eval('[name=createSettingsToken]',e=>e.form.requestSubmit());
  const done=()=>page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-settings')).busy());
  await replace(' First token ');await page.select('[name=tokenScope]','read');await submit();await poll();await page.select('[name=tokenScope]','read,write');await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).createToken());check('pending duplicate blocked with exact original raw name and access',creates===1&&payloads[0].name===' First token '&&JSON.stringify(payloads[0].scopes)==='["read"]');await held.continue();await done();check('scope-only edit preserves whole name and access draft with uncreated receipt',await page.$eval('[name=tokenName]',e=>e.value===' First token ')&&await page.$eval('[name=tokenScope]',e=>e.value==='read,write')&&await page.$eval('[name=settingsTokenDraftNotice]',e=>e.textContent.includes('has not been created')&&e.textContent.includes('revealed above belongs to the submitted token')));if(failures)throw new Error('Token draft preservation absent or mismatched');
  let tokens=await call('/auth/tokens',null,token);check('only original read-only demo token stored and reveal bound to its ID',tokens.length===1&&JSON.stringify(tokens[0].scopes)==='["read"]'&&!('token' in tokens[0])&&await page.evaluate(id=>{const t=ng.getComponent(document.querySelector('ol-settings')).createdToken();return t.id===id&&typeof t.token==='string'&&t.token.length>=24;},tokens[0].id)&&reads>0);
  // Hide generated demo token bytes in screenshot DOM only, never print them.
  await page.evaluate(()=>{for(const e of document.querySelectorAll('.token-reveal code'))e.textContent='[local fixture token hidden]';});await page.$eval('[name=settingsTokenDraftNotice]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/settings-token-pending-draft-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval('[name=tokenName]',e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-70));await page.screenshot({path:'/downloads/settings-token-pending-draft-mobile.png'});check('390px token name/access and receipt fit without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=settingsTokenDraftNotice]',e=>e.getBoundingClientRect().right<=innerWidth));
  held=null;await submit();await poll();check('newer access sent only by explicit second Create with receipt clear',creates===2&&payloads[1].name===' First token '&&JSON.stringify(payloads[1].scopes)==='["read","write"]'&&!await page.$('[name=settingsTokenDraftNotice]'));await held.continue();await done();tokens=await call('/auth/tokens',null,token);check('unchanged success clears name keeps access and reveals actual second token',tokens.length===2&&await page.$eval('[name=tokenName]',e=>e.value==='')&&await page.$eval('[name=tokenScope]',e=>e.value==='read,write')&&await page.evaluate(ids=>{const t=ng.getComponent(document.querySelector('ol-settings')).createdToken();return ids.includes(t.id);},tokens.filter(t=>t.scopes.includes('write')).map(t=>t.id))&&!await page.$('[name=settingsTokenDraftNotice]'));
  const before=reads;failCreate=true;await replace('Refused');await submit();await page.waitForFunction(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Permission denied');check('POST refusal retains draft without created claim or refresh',reads===before&&await page.$eval('[name=tokenName]',e=>e.value==='Refused')&&!await page.$('[name=settingsTokenDraftNotice]'));
  failCreate=false;failRead=true;held=null;await replace('Saved');await page.select('[name=tokenScope]','read');await submit();await poll();await replace('Next');await page.select('[name=tokenScope]','read,write');await held.continue();await done();tokens=await call('/auth/tokens',null,token);check('refresh failure keeps whole newer draft accurate receipt and original DB token',tokens.length===3&&tokens.some(t=>t.name==='Saved'&&JSON.stringify(t.scopes)==='["read"]')&&!tokens.some(t=>t.name==='Next'||t.name==='Refused')&&await page.$eval('[name=tokenName]',e=>e.value==='Next')&&await page.$eval('[name=tokenScope]',e=>e.value==='read,write')&&await page.$eval('[name=settingsTokenDraftNotice]',e=>e.textContent.includes('submitted token was created')&&e.textContent.includes('has not been created'))&&await page.evaluate(()=>ng.getComponent(document.querySelector('ol-settings')).error()==='Refresh failed'));
  // Revoke only these disposable demo tokens, without exposing their raw bytes.
  for(const t of tokens){const r=await fetch(`${API}/auth/tokens/${t.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Demo token cleanup failed');}check('isolated demo tokens revoked before teardown',(await call('/auth/tokens',null,token)).length===0);
  check('no pending token draft runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
