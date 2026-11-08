// Real local browser -> retained OTA locale bundle -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55725, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
const downloadDir=mkdtempSync(join(tmpdir(),'ol-ota-download-'));
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-ota-download-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('ota_download_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/ota_download_browser`;
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


  const entries=Object.fromEntries(Array.from({length:51},(_,i)=>[`key${i}`,i===0||i===50?'':i===1?'  ':i===2?'0':`Retained ${i}`]));await call(`${P}/import/en`,{entries},token);const pub=await call(`${P}/ota/publish`,{},token);await call(`${P}/import/en`,{entries:{key0:'NEWER LIVE VALUE'}},token);const expected=await call(`${P}/ota/1/en?branch=main&publicationId=${pub.id}`,undefined,token),bundlePath=`${P}/ota/1/en?branch=main&publicationId=${pub.id}`;
  await page.goto(`${WEB}${bundlePath}`,{waitUntil:'networkidle0'});await page.waitForSelector('.bundle-row');const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});const file=join(downloadDir,'ota-locale-bundle.json');
  let reads=0,writes=0;await page.setRequestInterception(true);page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/')){if(req.method()==='GET')reads++;else writes++;}req.continue();});
  await page.click('[name=nextBundlePage]');await page.waitForFunction(()=>document.querySelectorAll('.bundle-row').length===1);await page.select('[name=bundleValueFilter]','empty');await page.waitForFunction(()=>document.querySelector('[name=bundleMatches]')?.textContent.includes('2 of 51'));check('actual retained empty classification resets last-page navigation without reads or writes',reads===0&&writes===0&&await page.$$eval('.bundle-row',es=>es.length===2&&es.every(e=>e.querySelector('.bundle-value').textContent===''))&&await page.$eval('[name=nextBundlePage]',e=>e.disabled)&&await page.$eval('[name=previousBundlePage]',e=>e.disabled));
  await page.type('[name=bundleSearch]','KEY50');await page.waitForFunction(()=>document.querySelector('[name=bundleMatches]')?.textContent.includes('1 of 51'));check('value filter intersects literal case-insensitive key search',await page.$eval('.bundle-key',e=>e.textContent==='key50'));await page.select('[name=bundleValueFilter]','nonempty');await page.waitForSelector('[name=bundleEmpty]');check('filtered empty guidance offers clearing both rather than missing-values claim',await page.$eval('[name=bundleEmpty]',e=>e.textContent.includes('value filter and search')&&e.textContent.includes('Clear value filter')));
  await page.click('[name=downloadBundle]');for(let n=0;n<100&&!existsSync(file);n++)await new Promise(r=>setTimeout(r,20));const data=JSON.parse(readFileSync(file,'utf8'));rmSync(file);check('actual JSON retains all51 loaded values including empties despite no matches and newer live edit',isDeepStrictEqual(data.bundle,expected)&&data.publicationId===pub.id&&Object.keys(data.bundle.translations).length===51&&data.bundle.translations.key0===''&&reads===0&&writes===0&&await page.$eval('[name=bundleDownloadScope]',e=>e.textContent.includes('regardless of search, value filter or page')));
  await page.screenshot({path:'/downloads/ota-value-filter-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});await page.screenshot({path:'/downloads/ota-value-filter-mobile.png',fullPage:true});check('390px value controls and retained-only scope fit',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[name=bundleValueScope]',e=>e.textContent.includes('Whitespace is non-empty')&&e.textContent.includes('does not find missing keys')));
  await page.click('[name=clearBundleSearch]');await page.waitForFunction(()=>document.querySelector('[name=bundleMatches]')?.textContent.includes('49 of 51'));check('non-empty retains whitespace and zero strings, excludes exact empty',await page.$$eval('.bundle-row',es=>es.some(e=>e.querySelector('.bundle-key').textContent==='key1'&&e.querySelector('.bundle-value').textContent==='  ')&&es.some(e=>e.querySelector('.bundle-key').textContent==='key2'&&e.querySelector('.bundle-value').textContent==='0')&&es.every(e=>e.querySelector('.bundle-value').textContent!=='')));
  await page.click('[name=clearBundleValueFilter]');await page.waitForFunction(()=>document.querySelector('[name=bundleMatches]')?.textContent.includes('51 of 51'));check('Clear restores full first page without account effects',await page.$$eval('.bundle-row',es=>es.length===50)&&reads===0&&writes===0);
  await page.select('[name=bundleValueFilter]','empty');await page.type('[name=bundleSearch]','key0');await page.waitForFunction(()=>document.querySelector('[name=bundleMatches]')?.textContent.includes('1 of 51'));await page.$eval('[name=refreshBundle]',e=>e.click());for(let n=0;n<100&&reads!==1;n++)await new Promise(r=>setTimeout(r,20));await page.waitForFunction(()=>!document.querySelector('[name=bundleLoading]')&&!!document.querySelector('.bundle-row'));check('explicit current retained refresh preserves filter and search, not newer live editor value',reads===1&&writes===0&&await page.$eval('[name=bundleValueFilter]',e=>e.value==='empty')&&await page.$eval('[name=bundleSearch]',e=>e.value==='key0')&&await page.$eval('.bundle-value',e=>e.textContent===''));
  await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},`${P}/ota/1/en?branch=main`);await page.waitForFunction(()=>!document.querySelector('[name=bundleLoading]')&&document.querySelector('[name=bundleIdentity]')?.textContent.includes('Unpinned'));check('query-only publication visit resets filter and search',await page.$eval('[name=bundleValueFilter]',e=>e.value==='')&&await page.$eval('[name=bundleSearch]',e=>e.value==='')&&await page.$$eval('.bundle-row',es=>es.length===50));
  await page.evaluate(()=>{window.lastBundle=ng.getComponent(document.querySelector('ol-ota-bundle'));history.pushState({},'','/projects');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForFunction(()=>!document.querySelector('ol-ota-bundle'));await page.evaluate(()=>window.lastBundle.setValueFilter('empty'));check('departed captured filter handler cannot change state',await page.evaluate(()=>window.lastBundle.valueFilter()==='')&&writes===0);
  check('no OTA value filter runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955/.test(d)));process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
finally {
  await browser?.close();rmSync(downloadDir,{recursive:true,force:true});
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
process.exit(process.exitCode??1);
