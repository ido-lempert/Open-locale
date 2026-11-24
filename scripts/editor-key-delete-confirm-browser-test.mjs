// Real local browser -> targeted key deletion -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.EDITOR_CREATE_DELETE_TEST_PG_PORT ?? 56144), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, completed = false, api, web, browser, prisma;
process.exitCode = 1;
process.on('exit',()=>{if(!completed||failures)process.exitCode=1;});
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-key-delete-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('key_delete_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/key_delete_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Original',remove:'Delete me'}},token);await call(`${P}/branches`,{name:'other'},token);
  const target=(await call(`${P}/keys`,null,token)).find(k=>k.name==='remove');
  await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');await page.type('[name=newKey]','local.new.key');
  let deletes=0,puts=0,reads=0,deletePath='';page.on('request',req=>{const p=new URL(req.url()).pathname;if(req.method()==='DELETE'&&p.startsWith(`/api${P}/keys/`)){deletes++;deletePath=p;}if(req.method()==='PUT'&&p.endsWith('/translations'))puts++;if(req.method()==='GET'&&p===`/api${P}/keys`)reads++;});
  await page.click('[aria-label="alpha in en"]');await page.type('[aria-label="alpha in en"]',' local draft');const ask=async()=>{await page.click('[aria-label="Delete key remove"]');await page.waitForSelector('[name=confirmKeyDelete]');};await ask();
  check('pointer first click opens loaded exact key identity without delete read or blur save',deletes===0&&puts===0&&reads===0&&await page.$eval('[name=keyDeleteProjectId]',e=>e.textContent)===project.id&&await page.$eval('[name=keyDeleteBranch]',e=>e.textContent)==='main'&&await page.$eval('[name=keyDeleteId]',e=>e.textContent)===target.id&&await page.$eval('[name=keyDeleteName]',e=>e.textContent)==='remove'&&await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')==='alpha in en'));
  check('review names stored deletion scope and loaded-state limits',await page.$eval('[aria-label="Confirm key deletion"]',e=>e.textContent.includes('all its stored locale translations, translation history, comments and screenshot records')&&e.textContent.includes('Linked task-key records')&&e.textContent.includes('not a fresh permission check, newer server state or a complete impact preview')));
  await page.screenshot({path:'/downloads/editor-key-delete-confirm-desktop.png'});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/editor-key-delete-confirm-mobile.png'});
  check('390px confirmation keeps warning identity and both choices within modal',await page.evaluate(()=>{const e=document.querySelector('[aria-label="Confirm key deletion"]'),r=e.getBoundingClientRect(),b=document.querySelector('[name=cancelKeyDelete]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth&&b.bottom<=r.bottom;}));
  await page.click('[name=cancelKeyDelete]');await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-editor')).confirmKeyRemove());
  check('pointer cancel keeps focused unrelated local translation and new-key form without request',deletes===0&&puts===0&&reads===0&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original local draft'&&document.activeElement===e)&&await page.$eval('[name=newKey]',e=>e.value==='local.new.key')&&(await call(`${P}/keys`,null,token)).find(k=>k.name==='alpha').translations.find(t=>t.localeCode==='en').value==='Original');
  await ask();await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor')),k=c.keys().find(k=>k.name==='remove');c.edit(k,'en','Changed after review');await c.confirmKeyRemove();});
  check('selected local edit cancels confirmation without write',deletes===0&&puts===0&&!await page.$('[name=confirmKeyDelete]')&&await page.$eval('[aria-label="remove in en"]',e=>e.value==='Changed after review'));
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.edit(c.keys().find(k=>k.name==='remove'),'en','Delete me');c.edit(c.keys().find(k=>k.name==='alpha'),'en','Original');});await ask();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));window.capturedKeyDelete=c.pendingKeyDelete();return c.reload();});
  await page.waitForFunction(()=>!ng.getComponent(document.querySelector('ol-editor')).keysLoading());await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.pendingKeyDelete.set(window.capturedKeyDelete);await c.confirmKeyRemove();});
  check('new real key read rejects restored captured confirmation without delete or save',deletes===0&&puts===0&&reads===1&&!await page.$('[name=confirmKeyDelete]'));
  await ask();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor'));window.capturedKeyDelete=c.pendingKeyDelete();return c.switchBranch('other');});await page.evaluate(()=>ng.getComponent(document.querySelector('ol-editor')).switchBranch('main'));await page.waitForSelector('[aria-label="Delete key remove"]');await page.evaluate(async()=>{const c=ng.getComponent(document.querySelector('ol-editor'));c.pendingKeyDelete.set(window.capturedKeyDelete);await c.confirmKeyRemove();});
  check('branch away and back rejects old capture without deletion',deletes===0&&puts===0&&reads===3&&!await page.$('[name=confirmKeyDelete]'));
  await ask();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('ol-editor')),p=c.pendingKeyDelete();c.pendingKeyDelete.set({...p,projectId:'<img onerror=fail>-'+'P'.repeat(110),branch:'<img onerror=fail>-'+'B'.repeat(90),id:'<img onerror=fail>-'+'I'.repeat(110),name:'<img onerror=fail>-'+'N'.repeat(110)});});await page.screenshot({path:'/downloads/editor-key-delete-confirm-long-mobile.png'});
  check('long markup-like identity renders as escaped wrapping text',await page.$eval('[aria-label="Confirm key deletion"]',e=>!e.querySelector('img')&&e.textContent.includes('<img onerror=fail>')&&e.scrollWidth<=e.clientWidth));await page.$eval('[aria-label="Confirm key deletion"]',e=>e.scrollTop=e.scrollHeight);await page.click('[name=cancelKeyDelete]');check('artificial long fixture canceled before real delete',deletes===0);
  await page.setViewport({width:1280,height:900});await page.click('[aria-label="alpha in en"]');await page.type('[aria-label="alpha in en"]',' local before delete');await ask();await page.click('[name=confirmKeyDelete]');await page.waitForFunction(()=>!document.querySelector('[aria-label="Delete key remove"]')&&!document.querySelector('[name=keyDeleting]'));await page.evaluate(async()=>ng.getComponent(document.querySelector('ol-editor')).confirmKeyRemove());const remaining=await call(`${P}/keys`,null,token);
  check('explicit confirmation deletes exact key once without blur-saving unrelated local text',deletes===1&&deletePath===`/api${P}/keys/${target.id}`&&puts===0&&!remaining.some(k=>k.id===target.id)&&remaining.find(k=>k.name==='alpha').translations.find(t=>t.localeCode==='en').value==='Original');
  check('other local translation and new-key form retained without completion reread',reads===3&&await page.$eval('[aria-label="alpha in en"]',e=>e.value==='Original local before delete')&&await page.$eval('[name=newKey]',e=>e.value==='local.new.key'));
  await page.screenshot({path:'/downloads/editor-key-delete-confirm-result.png'});check('no key-confirmation runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));completed=true;process.exitCode=failures?1:0;
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
