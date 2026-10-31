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
const PG_PORT = 55481, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, mock, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-saml-link-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('saml_link');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/saml_link`;
  execFileSync('node_modules/.bin/prisma',['migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  prisma=new PrismaClient({datasources:{db:{url}}});
  mock=spawn(process.execPath,['scripts/mock-saml.mjs'],{env:{...process.env,MOCK_SAML_BROWSER:'1'},stdio:'pipe'});await waitFor('http://127.0.0.1:5556/cert');
  const cert=(await (await fetch('http://127.0.0.1:5556/cert')).json()).cert;
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'saml-link-secret',SAML_ENTRY_POINT:'http://127.0.0.1:5556/sso',SAML_IDP_CERT:cert,SAML_IDP_ENTITY_ID:'http://127.0.0.1:5556/idp',SAML_BROWSER_RETURN_URL:`${WEB}/auth/saml/callback`,PORT:String(API_PORT)},stdio:'pipe'});await waitFor(`${API}/projects`);
  const call=async(path,body,token)=>{const r=await fetch(`${API}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,json:await r.json()};};
  const owner=(await call('/auth/signup',{email:'existing@link.dev',password:'password-a',displayName:'Existing'})).json;
  const project=(await call('/projects',{name:'Existing project',slug:'existing-project',locales:['en']},owner.accessToken)).json;
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true,env:{...process.env,NX_DAEMON:'false',NX_ISOLATE_PLUGINS:'false'}});await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();await page.setViewport({width:1280,height:850});await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.evaluate(t=>localStorage.setItem('ol_token',t),owner.accessToken);
  await page.goto(`${WEB}/projects`,{waitUntil:'networkidle0'});await page.click('.saml-identity-link');await page.waitForSelector('input[name=linkPassword]');
  check('projects link opens password-confirmed identity linking',new URL(page.url()).pathname==='/account/link-saml' && await page.$eval('input[name=linkPassword]',e=>e.type==='password'));
  await page.screenshot({path:'/downloads/saml-link-desktop.png',fullPage:true});await page.setViewport({width:480,height:850});await page.screenshot({path:'/downloads/saml-link-narrow.png',fullPage:true});
  check('link form fits narrow viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>sessionStorage.setItem('ol.saml.verifier','old-attempt'));
  await page.type('input[name=linkPassword]','wrong-password');await page.click('button[name=startSamlLink]');await page.waitForSelector('[role=alert]');
  check('wrong password clears input and old callback state',await page.$eval('input[name=linkPassword]',e=>e.value==='') && await page.evaluate(()=>!sessionStorage.getItem('ol.saml.verifier')));
  check('wrong password creates no external identity',await prisma.externalIdentity.count()===0);
  check('wrong step-up password preserves current session token',await page.evaluate(t=>localStorage.getItem('ol_token')===t,owner.accessToken));
  await page.type('input[name=linkPassword]','password-a');await page.click('button[name=startSamlLink]');await page.waitForFunction(()=>location.pathname==='/projects');
  const identity=await prisma.externalIdentity.findFirst({where:{subject:'idp-sub-saml-user@example.com'}});
  check('provider identity binds existing account not email-provisioned account',identity?.userId===owner.user.id && await prisma.user.count()===1);
  check('existing project remains accessible after link',await page.evaluate(async id=>{const r=await fetch('/api/projects/'+id,{headers:{Authorization:'Bearer '+localStorage.getItem('ol_token')}});return r.ok;},project.id));
  check('link callback scrubs state and code',!page.url().includes('#') && await page.evaluate(()=>!sessionStorage.getItem('ol.saml.verifier')));
  check('password not stored in browser persistence',await page.evaluate(()=>![...Object.values(localStorage),...Object.values(sessionStorage)].some(v=>v.includes('password-a'))));
  await prisma.user.update({where:{id:owner.user.id},data:{totpEnabled:true}});
  const loginRecovery='SAML-LINK-LOGIN',finishRecovery='SAML-LINK-FINISH';
  for(const code of [loginRecovery,finishRecovery])await prisma.recoveryCode.create({data:{userId:owner.user.id,codeHash:createHash('sha256').update(code).digest('hex')}});
  const fresh=(await call('/auth/login',{email:'existing@link.dev',password:'password-a',totpCode:loginRecovery})).json;
  await page.evaluate(t=>localStorage.setItem('ol_token',t),fresh.accessToken);
  await page.goto(`${WEB}/account/link-saml`,{waitUntil:'networkidle0'});await page.waitForSelector('input[name=linkPassword]');await page.type('input[name=linkPassword]','password-a');await page.click('button[name=startSamlLink]');await page.waitForSelector('input[name=ssoCode]');
  check('linked existing account pauses for second factor',new URL(page.url()).pathname==='/auth/saml/callback' && await page.evaluate(t=>localStorage.getItem('ol_token')===t,fresh.accessToken));
  check('second-factor handoff scrubs verifier and fragment',!page.url().includes('#')&&await page.evaluate(()=>!sessionStorage.getItem('ol.saml.verifier')));
  await page.type('input[name=ssoCode]',finishRecovery);await page.click('button.primary');await page.waitForFunction(()=>location.pathname==='/projects');
  check('browser link second factor completes to original project',await page.evaluate(async id=>(await fetch('/api/projects/'+id,{headers:{Authorization:'Bearer '+localStorage.getItem('ol_token')}})).ok,project.id));
  check('link second-factor recovery code consumed',!!(await prisma.recoveryCode.findFirst({where:{userId:owner.user.id,codeHash:createHash('sha256').update(finishRecovery).digest('hex')}}))?.usedAt);
  await page.click('.identities-link');await page.waitForSelector('.provider-email');
  check('Projects opens linked identities read-only route',new URL(page.url()).pathname==='/account/identities');
  check('identity list shows issuer and provider metadata',await page.$eval('.issuer',e=>e.textContent==='saml:http://127.0.0.1:5556/idp')&&await page.$eval('.provider-email',e=>e.textContent==='saml-user@example.com'));
  check('identity list names unverified metadata and no unlink action',(await page.$eval('main',e=>e.textContent)).includes('unverified metadata')&&!(await page.$('button')));
  const sessionToken=await page.evaluate(()=>localStorage.getItem('ol_token'));
  const list=await call('/auth/identities',undefined,sessionToken);
  check('identity API returns only intended owner-safe fields',list.status===200&&list.json.length===1&&Object.keys(list.json[0]).sort().join(',')==='createdAt,email,id,issuer');
  check('identity list response is no-store',(await fetch(`${API}/auth/identities`,{headers:{Authorization:`Bearer ${sessionToken}`}})).headers.get('cache-control')==='no-store');
  check('identity list rejects unauthenticated HTTP request',(await call('/auth/identities')).status===401);
  const token=(await call('/auth/tokens',{name:'list-rejection',scopes:['read','write']},sessionToken)).json.token;
  check('identity API-token rejection fixture is valid',typeof token==='string'&&token.startsWith('ol_'));
  const tokenList=await fetch(`${API}/auth/identities`,{headers:{'X-Api-Key':token}});
  check('identity list rejects API-token principal',tokenList.status===403);
  // Literal rendering with real stored metadata, including HTML-looking text.
  await prisma.externalIdentity.update({where:{id:identity.id},data:{issuer:'saml:https://idp.example/'+('long/'.repeat(20))+'<img src=x onerror=alert(1)>',email:'<script>not executable</script>@example.com'}});
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('.provider-email');
  check('identity metadata renders as literal text without injected elements',await page.$eval('.provider-email',e=>e.textContent.includes('<script>'))&&!(await page.$('main script,main img')));
  await page.setViewport({width:1280,height:850});await page.screenshot({path:'/downloads/identities-desktop.png',fullPage:true});
  await page.setViewport({width:480,height:850});await page.screenshot({path:'/downloads/identities-narrow.png',fullPage:true});
  check('long identity metadata fits narrow viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setRequestInterception(true);
  const failList=req=>req.url().endsWith('/auth/identities')?req.respond({status:503,contentType:'application/json',body:'{}'}):req.continue();
  page.on('request',failList);await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[role=alert]');
  check('identity load error hides stale entries and offers retry',!(await page.$('.provider-email'))&&!!(await page.$('main button')));
  page.off('request',failList);await page.setRequestInterception(false);
  await page.click('main button');await page.waitForSelector('.provider-email');
  check('identity retry reloads current entries',!!(await page.$('.issuer')));
  await prisma.externalIdentity.update({where:{id:identity.id},data:{issuer:'saml:http://127.0.0.1:5556/idp',email:'saml-user@example.com'}});
  // New password account must not steal this already linked provider subject.
  const other=(await call('/auth/signup',{email:'other@link.dev',password:'password-b',displayName:'Other'})).json;
  const otherList=await call('/auth/identities',undefined,other.accessToken);
  check('identity list never returns another account bindings',otherList.status===200&&otherList.json.length===0);
  await page.evaluate(t=>localStorage.setItem('ol_token',t),other.accessToken);await page.goto(`${WEB}/account/identities`,{waitUntil:'networkidle0'});await page.waitForSelector('[role=status]');
  check('identity empty state has clear no-linked message',(await page.$eval('main',e=>e.textContent)).includes('No single sign-on identities'));
  await page.screenshot({path:'/downloads/identities-empty.png'});
  await page.evaluate(t=>localStorage.setItem('ol_token',t),other.accessToken);await page.goto(`${WEB}/account/link-saml`,{waitUntil:'networkidle0'});await page.waitForSelector('input[name=linkPassword]');await page.type('input[name=linkPassword]','password-b');await page.click('button[name=startSamlLink]');await page.waitForSelector('[role=alert]');
  check('already-linked provider identity rejected visibly',(await page.$eval('[role=alert]',e=>e.textContent)).includes('could not be verified'));
  check('conflict preserves original identity owner',(await prisma.externalIdentity.findFirst({where:{subject:'idp-sub-saml-user@example.com'}})).userId===owner.user.id);
  await prisma.user.update({where:{id:other.user.id},data:{totpEnabled:true}});
  check('identity list requires second-factor session after enable',(await call('/auth/identities',undefined,other.accessToken)).status===403);
  // Unauthenticated account route remains guarded.
  await page.evaluate(()=>localStorage.clear());await page.goto(`${WEB}/account/link-saml`,{waitUntil:'networkidle0'});
  check('link account route requires session',new URL(page.url()).pathname==='/login');
  await page.goto(`${WEB}/account/identities`,{waitUntil:'networkidle0'});
  check('identity list route requires session',new URL(page.url()).pathname==='/login');
  console.log(failures?'SAML LINK CHECKS FAILED':'ALL SAML LINK CHECKS PASSED');process.exitCode=failures?1:0;
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
