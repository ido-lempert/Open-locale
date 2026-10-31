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
const PG_PORT = 55477, WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, mock, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-oidc-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('oidc_browser');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/oidc_browser`;
  execFileSync('node_modules/.bin/prisma', ['migrate','deploy'], { env: {...process.env, DATABASE_URL:url}, stdio:'pipe' });
  prisma = new PrismaClient({ datasources:{db:{url}} });
  mock = spawn(process.execPath,['scripts/mock-oidc.mjs'],{env:{...process.env,MOCK_OIDC_PORT:'5555'},stdio:'pipe'});
  await waitFor('http://127.0.0.1:5555/.well-known/openid-configuration');
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'browser-oidc-secret',OIDC_PENDING_MAX:'2',OIDC_STATE_MAX:'3',OIDC_ISSUER:'http://127.0.0.1:5555',OIDC_REDIRECT_URI:`${WEB}/auth/oidc/callback`,PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/auth/oidc/info`);
  check('OIDC configured endpoint returns only boolean',JSON.stringify(await (await fetch(`${API}/auth/oidc/info`)).json())==='{"configured":true}');
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe',detached:true});
  await waitFor(WEB);
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:1280,height:800});
  let callbackPosts=0;
  page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/auth/oidc/callback'))callbackPosts++;});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});
  await page.waitForSelector('button[name=oidcLogin]');
  check('password login and SSO button both available',!!(await page.$('input[name=password]')));
  await page.screenshot({path:'/downloads/oidc-login-browser.png'});
  await page.click('button[name=oidcLogin]');
  await page.waitForFunction(()=>location.pathname==='/projects',{timeout:15000});
  check('browser completes IdP redirect and arrives authenticated',await page.evaluate(async()=>{const r=await fetch('/api/projects',{headers:{Authorization:`Bearer ${localStorage.getItem('ol_token')}`}});return r.ok;}));
  check('callback exchanges code once',callbackPosts===1);
  check('callback removes query params from final URL',!page.url().includes('?'));
  check('browser state consumed after callback',await page.evaluate(()=>!sessionStorage.getItem('ol.oidc.state')));
  const user=await prisma.user.findUnique({where:{email:'sso-alice@t.dev'}});
  check('browser SSO provisioned the expected fixture user',!!user);
  // Existing SSO account with 2FA enabled. Recovery-code fixture avoids clock
  // windows and drives the real shared second-factor/recovery path.
  await prisma.user.update({where:{id:user.id},data:{totpEnabled:true}});
  const recovery='ABCD-EFGH-IJKL';
  await prisma.recoveryCode.create({data:{userId:user.id,codeHash:createHash('sha256').update(recovery).digest('hex')}});
  await page.evaluate(()=>localStorage.clear());
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});
  await page.waitForSelector('button[name=oidcLogin]');
  await page.click('button[name=oidcLogin]');
  await page.waitForSelector('input[name=ssoCode]',{timeout:15000});
  check('2FA SSO pauses on callback page',new URL(page.url()).pathname==='/auth/oidc/callback');
  check('authorization code scrubbed before second-factor prompt',!page.url().includes('?'));
  await page.screenshot({path:'/downloads/oidc-second-factor-browser.png'});
  await page.type('input[name=ssoCode]',recovery);
  await page.click('button.primary');
  await page.waitForFunction(()=>location.pathname==='/projects',{timeout:15000});
  check('valid recovery code finishes browser SSO',new URL(page.url()).pathname==='/projects');
  check('recovery code consumed in database',!!(await prisma.recoveryCode.findFirst({where:{userId:user.id}})).usedAt);
  // Wrong code: pending token must disappear and UI must offer restart.
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'}); await page.waitForSelector('button[name=oidcLogin]'); await page.click('button[name=oidcLogin]');
  await page.waitForSelector('input[name=ssoCode]');await page.type('input[name=ssoCode]','WRONG-RECOVERY');await page.click('button.primary');
  await page.waitForSelector('[role=alert]');
  check('bad second factor requires restart, no consumed-token retry form',!(await page.$('input[name=ssoCode]')) && (await page.$eval('[role=alert]',e=>e.textContent)).includes('start again'));
  // Unsolicited callback and duplicate state rejected BEFORE API exchange.
  const before=callbackPosts;
  await page.goto(`${WEB}/auth/oidc/callback?code=attacker&state=unissued`,{waitUntil:'networkidle0'});
  check('unsolicited callback visibly rejected', (await page.$eval('[role=alert]',e=>e.textContent)).includes('not started in this tab'));
  check('unsolicited callback never sent to token exchange',callbackPosts===before);
  check('rejected callback also scrubs code from URL',!page.url().includes('?'));
  await page.evaluate(()=>sessionStorage.setItem('ol.oidc.state','expected'));
  await page.goto(`${WEB}/auth/oidc/callback?code=attacker&state=expected&state=other`,{waitUntil:'networkidle0'});
  check('duplicate state rejected before token exchange',callbackPosts===before && !!(await page.$('[role=alert]')));
  await page.evaluate(()=>sessionStorage.setItem('ol.oidc.state','expected'));
  await page.goto(`${WEB}/auth/oidc/callback?code=one&code=two&state=expected`,{waitUntil:'networkidle0'});
  check('duplicate authorization code rejected before exchange',callbackPosts===before && !!(await page.$('[role=alert]')));
  await page.reload({waitUntil:'networkidle0'});
  check('refresh cannot repeat a consumed callback exchange',callbackPosts===before && !!(await page.$('[role=alert]')));
  await page.evaluate(()=>sessionStorage.setItem('ol.oidc.state','denied'));
  await page.goto(`${WEB}/auth/oidc/callback?error=access_denied&state=denied`,{waitUntil:'networkidle0'});
  check('provider cancellation has safe visible error', (await page.$eval('[role=alert]',e=>e.textContent)).includes('identity provider did not complete'));
  check('provider error never triggers exchange',callbackPosts===before);
  // Angular reuses the callback component for query-only navigation.
  // Drive Router itself, not page.goto (which reloads the whole document).
  await page.evaluate(()=>{
    const c=window.ng.getComponent(document.querySelector('ol-oidc-callback'));
    return c.router.navigateByUrl('/auth/oidc/callback?code=new-attacker&state=unissued');
  });
  await page.waitForFunction(()=>!location.search && document.querySelector('[role=alert]')?.textContent.includes('not started in this tab'));
  check('same-route query navigation consumes and scrubs callback',!page.url().includes('?'));
  check('reused callback still rejects before code exchange',callbackPosts===before);
  check('reused callback clears prior cancellation message',!(await page.$eval('[role=alert]',e=>e.textContent)).includes('identity provider did not complete'));
  await page.setViewport({width:480,height:800});
  await page.screenshot({path:'/downloads/oidc-error-narrow.png'});
  check('narrow callback has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Deliver real API responses late across reused-route and destroyed-component
  // boundaries. Transport interception delays delivery, not server validation.
  for (const scenario of ['access-newer','access-destroy','pending-newer','complete-newer']) {
    const twoFactor=scenario.startsWith('pending')||scenario.startsWith('complete');
    await prisma.user.update({where:{id:user.id},data:{totpEnabled:twoFactor}});
    const start=await (await fetch(`${API}/auth/oidc/start`)).json();
    const state=new URL(start.url).searchParams.get('state');
    const authorize=await fetch(start.url,{redirect:'manual'});
    const callbackUrl=authorize.headers.get('location');
    await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});
    await page.evaluate(state=>{localStorage.clear();sessionStorage.setItem('ol.oidc.state',state);},state);
    let releaseResponse,heldResolve,deliveredResolve;
    const releaseGate=new Promise(r=>releaseResponse=r),heldGate=new Promise(r=>heldResolve=r),delivered=new Promise(r=>deliveredResolve=r);
    const endpoint=scenario.startsWith('complete')?'/auth/oidc/complete':'/auth/oidc/callback';
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
    await page.evaluate(destroy=>{const c=window.ng.getComponent(document.querySelector('ol-oidc-callback'));return c.router.navigateByUrl(destroy?'/login':'/auth/oidc/callback?code=newer&state=unissued');},destroy);
    await page.waitForSelector(destroy?'input[name=password]':'[role=alert]');
    releaseResponse();await delivered;await new Promise(r=>setTimeout(r,300));
    // Explicitly settle a rendering turn even when a stale pending-only result
    // mutates a plain field without any signal transition.
    await page.evaluate(()=>document.querySelector('h1')?.click());
    await new Promise(r=>setTimeout(r,100));
    check(`${scenario} late response cannot authenticate or navigate`,await page.evaluate(()=>!localStorage.getItem('ol_token')) && new URL(page.url()).pathname===(destroy?'/login':'/auth/oidc/callback'));
    check(`${scenario} preserves new screen without stale second-factor form`,await page.evaluate(()=>!document.querySelector('ol-oidc-callback') || !window.ng.getComponent(document.querySelector('ol-oidc-callback')).pendingToken) && !(await page.$('input[name=ssoCode]')) && (destroy?!!(await page.$('input[name=password]')):await page.evaluate(()=>document.querySelector('[role=alert]')?.textContent.includes('not started in this tab'))));
    if(scenario==='access-newer')await page.screenshot({path:'/downloads/oidc-stale-response-narrow.png'});
    page.off('request',intercept);await page.setRequestInterception(false);
  }
  await prisma.user.update({where:{id:user.id},data:{totpEnabled:true}});
  await page.goto(`${WEB}/login`,{waitUntil:'networkidle0'});await page.waitForSelector('button[name=oidcLogin]');await page.click('button[name=oidcLogin]');await page.waitForSelector('input[name=ssoCode]');
  const stalePending=await page.evaluate(()=>window.ng.getComponent(document.querySelector('ol-oidc-callback')).pendingToken);
  const staleRecovery='OIDC-EPOCH-STALE';await prisma.recoveryCode.create({data:{userId:user.id,codeHash:createHash('sha256').update(staleRecovery).digest('hex')}});
  await prisma.user.update({where:{id:user.id},data:{authEpoch:{increment:1}}});
  const staleReply=await fetch(`${API}/auth/oidc/complete`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pendingToken:stalePending,totpCode:staleRecovery})});
  check('OIDC pending login cannot cross epoch revocation',staleReply.status===401&&!(await staleReply.json()).accessToken);
  check('stale OIDC pending does not consume recovery code',!(await prisma.recoveryCode.findFirst({where:{userId:user.id,codeHash:createHash('sha256').update(staleRecovery).digest('hex')}})).usedAt);
  const pendingFlow=async()=>{
    const start=await (await fetch(`${API}/auth/oidc/start`)).json();
    const location=new URL((await fetch(start.url,{redirect:'manual'})).headers.get('location'));
    const r=await fetch(`${API}/auth/oidc/callback`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:location.searchParams.get('code'),state:location.searchParams.get('state')})});
    return {status:r.status,json:await r.json()};
  };
  // pending-newer above leaves one unused entry; with capacity2 one slot remains.
  const admitted=await pendingFlow();
  check('OIDC bounded pending store admits remaining slot',admitted.status===200&&!!admitted.json.pendingToken);
  const full=await pendingFlow();
  check('OIDC pending overflow fails closed over real HTTP',full.status===503&&!full.json.pendingToken&&!full.json.accessToken);
  const failed=await fetch(`${API}/auth/oidc/complete`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pendingToken:admitted.json.pendingToken,totpCode:'WRONG'})});
  check('OIDC pending failed verification consumes capacity entry',failed.status===401);
  check('OIDC pending capacity recovers after consumption',!!(await pendingFlow()).json.pendingToken);
  const openStates=[];
  for(let i=0;i<3;i++){
    const r=await fetch(`${API}/auth/oidc/start`);const body=await r.json();openStates.push(body);
    check(`bounded authorization state admits slot ${i+1}`,r.status===200&&typeof body.url==='string'&&!JSON.stringify(body).includes('verifier'));
  }
  const overflow=await fetch(`${API}/auth/oidc/start`);
  check('authorization state overflow fails closed over HTTP',overflow.status===503&&!(await overflow.json()).url);
  const consumedState=new URL(openStates[0].url).searchParams.get('state');
  const rejectedCode=await fetch(`${API}/auth/oidc/callback`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({state:consumedState,code:'invalid'})});
  check('failed code exchange consumes bounded authorization state',rejectedCode.status===401);
  const recovered=await fetch(`${API}/auth/oidc/start`);
  check('authorization capacity recovers after rejected exchange',recovered.status===200&&!!(await recovered.json()).url);
  const replay=await fetch(`${API}/auth/oidc/callback`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({state:consumedState,code:'invalid'})});
  check('consumed authorization state still rejects replay',replay.status===401);
  console.log(failures?'OIDC BROWSER CHECKS FAILED':'ALL OIDC BROWSER CHECKS PASSED');
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
