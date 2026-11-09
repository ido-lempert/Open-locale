// Real local browser -> focused read-only export -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55786, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-export-scope-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('export_scope_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/export_scope_browser`;
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


  await call(`${P}/import/en`,{entries:{alpha:'Saved server'}},token);
  for(const [kind,selector,path,filename] of [
    ['file','[name=exportFile]',`${P}/export/en?branch=main`,'sync-browser.en.json'],
    ['bundle','[name=exportBundle]',`${P}/export-bundle/json?branch=main`,'sync-browser-json.zip'],
    ['tmx','[name=exportTmx]',`${P}/tm/he/tmx`,'sync-browser-he.tmx']
  ]) {
    await call(`${P}/import/en`,{entries:{alpha:'Saved server'}},token);
    await call(`${P}/import/he`,{entries:{alpha:'Saved target'}},token);
    const expectedResponse=await fetch(`${API}${path}`,{headers:{Authorization:`Bearer ${token}`}});if(!expectedResponse.ok)throw new Error('baseline export failed');
    const expected=Buffer.from(await expectedResponse.arrayBuffer());
    await page.goto(`${WEB}${P}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="alpha in en"]');
    if(kind==='tmx')await page.select('[name=ioLocale]','he');
    await page.evaluate(()=>{window.__downloads=[];window.__revoked=[];window.__blobs=new Map();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{const u=create(b);window.__blobs.set(u,b);return u;};URL.revokeObjectURL=u=>{window.__revoked.push(u);revoke(u);};const original=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.__downloads.push({filename:this.download,url:this.href,blob:window.__blobs.get(this.href)});return;}return original.call(this);};});
    const requests=[];const listener=req=>{if(new URL(req.url()).pathname.startsWith('/api/'))requests.push({method:req.method(),url:req.url()});};page.on('request',listener);
    const input=await page.$('[aria-label="alpha in en"]');await input.focus();await input.type(' LOCAL_ONLY_DRAFT');const local=await input.evaluate(e=>e.value);
    await page.click(selector);await page.waitForFunction(()=>window.__downloads.length===1&&!document.querySelector('[name=exportPending]'));await new Promise(r=>setTimeout(r,150));
    check(`${kind} focused pointer export makes only one export GET and no translation save`,requests.length===1&&requests[0].method==='GET'&&new URL(requests[0].url).pathname===new URL(`${API}${path}`).pathname&&await input.evaluate((e,v)=>e.value===v&&document.activeElement===e,local));
    const download=await page.evaluate(async()=>{const d=window.__downloads[0];return{filename:d.filename,bytes:Array.from(new Uint8Array(await d.blob.arrayBuffer())),revoked:window.__revoked.includes(d.url)};});
    const actual=Buffer.from(download.bytes);const contentMatches=kind==='file'?JSON.stringify(JSON.parse(actual.toString()))===JSON.stringify(JSON.parse(expected.toString())):actual.equals(expected);
    check(`${kind} downloads saved server bytes with filename and revoked URL, not local draft`,download.filename===filename&&download.revoked&&contentMatches&&!actual.includes(Buffer.from('LOCAL_ONLY_DRAFT')));
    if(kind==='file'){await page.screenshot({path:'/downloads/editor-export-focus-desktop.png'});await page.setViewport({width:390,height:844});await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/downloads/editor-export-focus-mobile.png'});check('390px export controls fit viewport',await page.$eval(selector,e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));await page.setViewport({width:1280,height:900});}
    page.off('request',listener);
  }
  check('no focused export runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
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
