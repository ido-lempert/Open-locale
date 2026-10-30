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
  api=spawn(process.execPath,['dist/apps/api/main.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:'browser-oidc-secret',OIDC_ISSUER:'http://127.0.0.1:5555',OIDC_REDIRECT_URI:`${WEB}/auth/oidc/callback`,PORT:String(API_PORT)},stdio:'pipe'});
  await waitFor(`${API}/auth/oidc/info`);
  check('OIDC configured endpoint returns only boolean',JSON.stringify(await (await fetch(`${API}/auth/oidc/info`)).json())==='{"configured":true}');
  web=spawn('node_modules/.bin/nx',['serve','web','--port',String(WEB_PORT)],{stdio:'pipe'});
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
  await page.setViewport({width:480,height:800});
  await page.screenshot({path:'/downloads/oidc-error-narrow.png'});
  check('narrow callback has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log(failures?'OIDC BROWSER CHECKS FAILED':'ALL OIDC BROWSER CHECKS PASSED');
  process.exitCode=failures?1:0;
} catch(e){ console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1; }
finally {await browser?.close();web?.kill('SIGKILL');api?.kill('SIGKILL');mock?.kill('SIGKILL');await prisma?.$disconnect();await pg.stop().catch(()=>{});rmSync(dataDir,{recursive:true,force:true});}
// Some child shutdown callbacks can reset exitCode. Exit with the verified result.
process.exit(process.exitCode??1);
