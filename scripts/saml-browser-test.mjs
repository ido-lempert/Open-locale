import { inflateRawSync } from 'node:zlib';
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
const PG_PORT = 55478, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, mock, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-saml-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('saml_browser');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/saml_browser`;
  execFileSync('node_modules/.bin/prisma', ['migrate','deploy'], { env: {...process.env, DATABASE_URL:url}, stdio:'pipe' });
  prisma = new PrismaClient({ datasources:{db:{url}} });
  mock = spawn(process.execPath,['scripts/mock-saml.mjs'],{env:{...process.env,MOCK_SAML_BROWSER:'1'},stdio:'pipe'});
  await waitFor('http://127.0.0.1:5556/cert');
  const cert=(await (await fetch('http://127.0.0.1:5556/cert')).json()).cert;
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'browser-saml-secret',SAML_ENTRY_POINT:'http://127.0.0.1:5556/sso',SAML_IDP_CERT:cert,SAML_IDP_ENTITY_ID:'http://127.0.0.1:5556/idp',SAML_BROWSER_RETURN_URL:`${WEB}/auth/saml/callback`,PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/auth/saml/sp-info`);
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});
  await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:1280,height:800});
  let redeems=0;
  page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/auth/saml/browser/redeem'))redeems++;});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.waitForSelector('button[name=samlLogin]');
  check('SAML browser sign-in button renders',!!(await page.$('button[name=samlLogin]')));
  await page.screenshot({path:'/downloads/saml-browser-login.png'});
  await page.click('button[name=samlLogin]');
  await page.waitForFunction(()=>location.pathname==='/projects',{timeout:15000});
  check('real IdP form POST completes browser SAML',new URL(page.url()).pathname==='/projects');
  check('handoff redeemed once',redeems===1);
  check('browser verifier removed',await page.evaluate(()=>!sessionStorage.getItem('ol.saml.verifier')));
  check('handoff fragment removed',!page.url().includes('#'));
  check('session authenticates protected endpoint',await page.evaluate(async()=> (await fetch('/api/projects',{headers:{Authorization:`Bearer ${localStorage.getItem('ol_token')}`}})).ok));
  const user=await prisma.user.findUnique({where:{email:'saml-user@example.com'}});
  check('SAML browser provisioned fixture account',!!user);
  await prisma.user.update({where:{id:user.id},data:{totpEnabled:true}});
  const recovery='BROWSER-SAML-RECOVERY';await prisma.recoveryCode.create({data:{userId:user.id,codeHash:createHash('sha256').update(recovery).digest('hex')}});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.waitForSelector('button[name=samlLogin]');await page.click('button[name=samlLogin]');
  await page.waitForSelector('input[name=ssoCode]',{timeout:15000});
  check('SAML handoff pauses for local second factor',new URL(page.url()).pathname==='/auth/saml/callback');
  check('2FA prompt has no ticket in URL',!page.url().includes('#'));
  await page.screenshot({path:'/downloads/saml-browser-second-factor.png'});
  await page.type('input[name=ssoCode]',recovery);await page.click('button.primary');
  await page.waitForFunction(()=>location.pathname==='/projects',{timeout:15000});
  check('recovery verification completes SAML browser login',new URL(page.url()).pathname==='/projects');
  check('recovery code consumed',!!(await prisma.recoveryCode.findFirst({where:{userId:user.id}})).usedAt);
  // Real HTTP handoff rejection legs, independent of Angular UI state.
  const post=async(path,body)=>fetch(`${API}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),redirect:'manual'});
  const verifier='x'.repeat(64), challenge=createHash('sha256').update(verifier).digest('base64url');
  const start=await (await post('/auth/saml/browser/start',{challenge})).json();
  const loginUrl=new URL(start.url), requestXml=inflateRawSync(Buffer.from(loginUrl.searchParams.get('SAMLRequest'),'base64')).toString();
  const requestId=requestXml.match(/ID="([^"]+)"/)[1];
  const assertion=await (await fetch('http://127.0.0.1:5556/mint',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inResponseTo:requestId})})).json();
  const acs=await post('/auth/saml/acs',{...assertion,RelayState:loginUrl.searchParams.get('RelayState')});
  check('ACS browser handoff is no-store 303, not JSON JWT',acs.status===303 && acs.headers.get('cache-control')==='no-store' && !(await acs.text()).includes('accessToken'));
  const ticket=new URLSearchParams(new URL(acs.headers.get('location')).hash.slice(1)).get('code');
  const wrong=await post('/auth/saml/browser/redeem',{code:ticket,verifier:'y'.repeat(64)});
  check('ticket stolen without verifier rejected over HTTP',wrong.status===401);
  const burned=await post('/auth/saml/browser/redeem',{code:ticket,verifier});
  check('wrong verifier burns one-use ticket over HTTP',burned.status===401);
  const replay=await post('/auth/saml/acs',{...assertion,RelayState:loginUrl.searchParams.get('RelayState')});
  check('browser state replay rejected over HTTP',replay.status===401);
  const badStart=await (await post('/auth/saml/browser/start',{challenge})).json();
  const badUrl=new URL(badStart.url);
  const badId=inflateRawSync(Buffer.from(badUrl.searchParams.get('SAMLRequest'),'base64')).toString().match(/ID="([^"]+)"/)[1];
  const badAssertion=await (await fetch('http://127.0.0.1:5556/mint',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inResponseTo:badId,wrongIssuer:true,email:'rejected-browser@example.com'})})).json();
  const rejected=await post('/auth/saml/acs',{...badAssertion,RelayState:badUrl.searchParams.get('RelayState')});
  check('valid browser state with rejected assertion receives fixed-return handoff',rejected.status===303 && new URL(rejected.headers.get('location')).pathname==='/auth/saml/callback');
  await page.evaluate(v=>sessionStorage.setItem('ol.saml.verifier',v),verifier);
  await page.goto(rejected.headers.get('location'),{waitUntil:'networkidle0'});
  check('rejected assertion shows safe restart message in browser',(await page.$eval('[role=alert]',e=>e.textContent))==='SAML sign-in could not be verified. Return to sign-in and try again.');
  check('browser error omits raw issuer/XML diagnostics',!(await page.content()).includes('Unknown SAML issuer'));
  check('rejected assertion created no account',!(await prisma.user.findUnique({where:{email:'rejected-browser@example.com'}})));
  check('error handoff clears fragment and verifier',!page.url().includes('#') && await page.evaluate(()=>!sessionStorage.getItem('ol.saml.verifier')));
  await page.screenshot({path:'/downloads/saml-browser-validation-error.png'});
  const before=redeems;
  await page.goto(`${WEB}/auth/saml/callback#code=unsolicited`,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>!location.hash && !!document.querySelector('[role=alert]'));
  check('unsolicited SAML callback rejected before redemption',redeems===before && !!(await page.$('[role=alert]')));
  check('rejected ticket fragment scrubbed',!page.url().includes('#'));
  await page.setViewport({width:480,height:800});await page.screenshot({path:'/downloads/saml-browser-error-narrow.png'});
  check('SAML narrow error no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Deliver real API responses late across reused-route and destroyed-component
  // boundaries. Transport interception delays delivery, not server validation.
  for (const scenario of ['access-newer','access-destroy','pending-newer','complete-newer']) {
    const twoFactor=scenario.startsWith('pending')||scenario.startsWith('complete');
    await prisma.user.update({where:{id:user.id},data:{totpEnabled:twoFactor}});
    const verifier='late-saml-verifier-'.repeat(4),challenge=createHash('sha256').update(verifier).digest('base64url');
    const start=await (await post('/auth/saml/browser/start',{challenge})).json();
    const loginUrl=new URL(start.url);
    const requestId=inflateRawSync(Buffer.from(loginUrl.searchParams.get('SAMLRequest'),'base64')).toString().match(/ID="([^"]+)"/)[1];
    const assertion=await (await fetch('http://127.0.0.1:5556/mint',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inResponseTo:requestId})})).json();
    const acs=await post('/auth/saml/acs',{...assertion,RelayState:loginUrl.searchParams.get('RelayState')});
    const callbackUrl=acs.headers.get('location');
    await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});
    await page.evaluate(verifier=>{localStorage.clear();sessionStorage.setItem('ol.saml.verifier',verifier);},verifier);
    let releaseResponse,heldResolve,deliveredResolve;
    const releaseGate=new Promise(r=>releaseResponse=r),heldGate=new Promise(r=>heldResolve=r),delivered=new Promise(r=>deliveredResolve=r);
    const endpoint=scenario.startsWith('complete')?'/auth/saml/complete':'/auth/saml/browser/redeem';
    await page.setRequestInterception(true);
    const intercept=async req=>{
      if(req.method()==='POST'&&req.url().endsWith(endpoint)){
        const response=await fetch(req.url(),{method:'POST',headers:{'content-type':'application/json'},body:req.postData()});
        const body=await response.text();
        check(`${scenario} held response is successful`,response.ok && (twoFactor&&!scenario.startsWith('complete')?!!JSON.parse(body).pendingToken:!!JSON.parse(body).accessToken));
        heldResolve();await releaseGate;
        await req.respond({status:response.status,contentType:'application/json',body});deliveredResolve();
      }else await req.continue();
    };
    page.on('request',intercept);
    await page.goto(callbackUrl,{waitUntil:'domcontentloaded'});
    if(scenario.startsWith('complete')){
      const code='MNOP-QRST-UVWX';
      await prisma.recoveryCode.create({data:{userId:user.id,codeHash:createHash('sha256').update(code).digest('hex')}});
      await page.waitForSelector('input[name=ssoCode]');await page.type('input[name=ssoCode]',code);await page.click('button.primary');
    }
    await Promise.race([heldGate,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`No held ${scenario} response`)),10000))]);
    const destroy=scenario.endsWith('destroy');
    await page.evaluate(destroy=>{const c=window.ng.getComponent(document.querySelector('ol-saml-callback'));return c.router.navigateByUrl(destroy?'/login':'/auth/saml/callback#code=newer');},destroy);
    await page.waitForSelector(destroy?'input[name=password]':'[role=alert]');
    releaseResponse();await delivered;await new Promise(r=>setTimeout(r,300));
    // Explicitly settle a rendering turn even when a stale pending-only result
    // mutates a plain field without any signal transition.
    await page.evaluate(()=>document.querySelector('h1')?.click());
    await new Promise(r=>setTimeout(r,100));
    check(`${scenario} late response cannot authenticate or navigate`,await page.evaluate(()=>!localStorage.getItem('ol_token')) && new URL(page.url()).pathname===(destroy?'/login':'/auth/saml/callback'));
    check(`${scenario} preserves new screen without stale second-factor form`,await page.evaluate(()=>!document.querySelector('ol-saml-callback') || !window.ng.getComponent(document.querySelector('ol-saml-callback')).pendingToken) && !(await page.$('input[name=ssoCode]')) && (destroy?!!(await page.$('input[name=password]')):await page.evaluate(()=>document.querySelector('[role=alert]')?.textContent.includes('was not started in this tab'))));
    if(scenario==='access-newer')await page.screenshot({path:'/downloads/saml-stale-response-narrow.png'});
    page.off('request',intercept);await page.setRequestInterception(false);
  }
  console.log(failures?'SAML BROWSER CHECKS FAILED':'ALL SAML BROWSER CHECKS PASSED');
  process.exitCode=failures?1:0;
} catch(e){ console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1; }
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
