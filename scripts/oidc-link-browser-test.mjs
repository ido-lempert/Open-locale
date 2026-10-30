// Real local browser -> mock IdP -> Angular callback -> built API + Postgres.
// No external IdP/account acceptance. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = 55480, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, mock, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-oidc-link-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('oidc_link');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/oidc_link`;
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  prisma=new PrismaClient({datasources:{db:{url}}});
  mock=spawn(process.execPath,['scripts/mock-oidc.mjs'],{env:{...process.env,MOCK_OIDC_PORT:'5555'},stdio:'pipe'});await waitFor('http://127.0.0.1:5555/.well-known/openid-configuration');
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'oidc-link-secret',OIDC_ISSUER:'http://127.0.0.1:5555',OIDC_REDIRECT_URI:`${WEB}/auth/oidc/callback`,PORT:String(API_PORT)},stdio:'pipe'});await waitFor(`${API}/projects`);
  const call=async(path,body,token)=>{const r=await fetch(`${API}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,json:await r.json()};};
  const owner=(await call('/auth/signup',{email:'existing@link.dev',password:'password-a',displayName:'Existing'})).json;
  const project=(await call('/projects',{name:'Existing project',slug:'existing-project',locales:['en']},owner.accessToken)).json;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true,env:{...process.env,NX_DAEMON:'false',NX_ISOLATE_PLUGINS:'false'}});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();await page.setViewport({width:1280,height:850});await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),owner.accessToken);
  await page.goto(`${WEB}/projects`,{waitUntil:'networkidle0'});await page.click('.identity-link');await page.waitForSelector('input[name=linkPassword]');
  check('projects link opens password-confirmed identity linking',new URL(page.url()).pathname==='/account/link-oidc' && await page.$eval('input[name=linkPassword]',e=>e.type==='password'));
  await page.screenshot({path:'/downloads/oidc-link-desktop.png',fullPage:true});await page.setViewport({width:480,height:850});await page.screenshot({path:'/downloads/oidc-link-narrow.png',fullPage:true});
  check('link form fits narrow viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>sessionStorage.setItem('ol.oidc.state','old-attempt'));
  await page.type('input[name=linkPassword]','wrong-password');await page.click('button[name=startOidcLink]');await page.waitForSelector('[role=alert]');
  check('wrong password clears input and old callback state',await page.$eval('input[name=linkPassword]',e=>e.value==='') && await page.evaluate(()=>!sessionStorage.getItem('ol.oidc.state')));
  check('wrong password creates no external identity',await prisma.externalIdentity.count()===0);
  check('wrong step-up password preserves current session token',await page.evaluate(t=>localStorage.getItem('ol_token')===t,owner.accessToken));
  await page.type('input[name=linkPassword]','password-a');await page.click('button[name=startOidcLink]');await page.waitForFunction(()=>location.pathname==='/projects');
  const identity=await prisma.externalIdentity.findFirst({where:{subject:'mock-user-1'}});
  check('provider identity binds existing account not email-provisioned account',identity?.userId===owner.user.id && await prisma.user.count()===1);
  check('existing project remains accessible after link',await page.evaluate(async id=>{const r=await fetch('/api/projects/'+id,{headers:{Authorization:'Bearer '+localStorage.getItem('ol_token')}});return r.ok;},project.id));
  check('link callback scrubs state and code',!page.url().includes('?') && await page.evaluate(()=>!sessionStorage.getItem('ol.oidc.state')));
  check('password not stored in browser persistence',await page.evaluate(()=>![...Object.values(localStorage),...Object.values(sessionStorage)].some(v=>v.includes('password-a'))));
  // New password account must not steal this already linked provider subject.
  const other=(await call('/auth/signup',{email:'other@link.dev',password:'password-b',displayName:'Other'})).json;
  await page.evaluate(t=>localStorage.setItem('ol_token',t),other.accessToken);await page.goto(`${WEB}/account/link-oidc`,{waitUntil:'networkidle0'});await page.waitForSelector('input[name=linkPassword]');await page.type('input[name=linkPassword]','password-b');await page.click('button[name=startOidcLink]');await page.waitForSelector('[role=alert]');
  check('already-linked provider identity rejected visibly',(await page.$eval('[role=alert]',e=>e.textContent)).includes('different account'));
  check('conflict preserves original identity owner',(await prisma.externalIdentity.findFirst({where:{subject:'mock-user-1'}})).userId===owner.user.id);
  // Unauthenticated account route remains guarded.
  await page.evaluate(()=>localStorage.clear());await page.goto(`${WEB}/account/link-oidc`,{waitUntil:'networkidle0'});
  check('link account route requires session',new URL(page.url()).pathname==='/login');
  console.log(failures?'OIDC LINK CHECKS FAILED':'ALL OIDC LINK CHECKS PASSED');process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);for(const p of await browser?.pages()??[]){console.log('FAILURE_PAGE',p.url(),await p.$eval('body',e=>e.textContent));}process.exitCode=1;}
finally {
  await browser?.close();
  // Nx serve launches a child server. Reap its process group, not only Nx,
  // so a successful suite does not leave the web listener behind.
  const stopped = [web,api,mock].filter(Boolean).map(child => new Promise(resolve => {
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
