// Real local browser -> Webhook journal -> built API + Postgres.
// No external provider requests. Requires nx build api.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-core';
const PG_PORT = Number(process.env.WEBHOOK_JOURNAL_TEST_PG_PORT ?? 55544), WEB_PORT = 4200, API_PORT = 3000;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let failures = 0, api, web, browser, prisma;
process.exitCode = 1;
const check = (name, ok) => console.log(`${ok ? 'PASS' : (failures++, 'FAIL')} ${name}`);
const waitFor = async (url) => { for (let n=0;n<120;n++) { if (await fetch(url).then(r=>r.status<500).catch(()=>false)) return; await new Promise(r=>setTimeout(r,500)); } throw new Error(`Not ready: ${url}`); };
const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-webhook-journal-browser-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
try {
  await pg.initialise();await pg.start();await pg.createDatabase('webhook_journal_browser');
  const url=`postgresql://postgres:postgres@localhost:${PG_PORT}/webhook_journal_browser`;
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


  const hook=await prisma.webhook.create({data:{projectId:project.id,url:'https://example.com/hook',secret:'private-signing-secret',events:['translation.updated']}});
  const emptyHook=await prisma.webhook.create({data:{projectId:project.id,url:'https://example.com/empty',secret:'other-private-secret',events:['translation.updated']}});
  const longEvent='translation.'+'x'.repeat(160)+'<img src=x onerror=alert(1)>';
  await prisma.webhookDelivery.createMany({data:[
    {webhookId:hook.id,event:'translation.updated',httpStatus:204,success:true,attempts:1,durationMs:15,createdAt:new Date('2026-11-05T12:00:00Z')},
    {webhookId:hook.id,event:longEvent,httpStatus:503,success:false,attempts:2,durationMs:200,error:'private-network-error',createdAt:new Date('2026-11-05T11:00:00Z')},
    {webhookId:hook.id,event:'snapshot.restored',httpStatus:null,success:false,attempts:2,durationMs:5,error:'private-dns-error',createdAt:new Date('2026-11-05T10:00:00Z')},
  ]});
  const journal=`${WEB}${P}/webhooks/${hook.id}/deliveries`;
  const mutations=[];page.on('request',r=>{if(r.url().includes('/api/')&&r.method()!=='GET'&&r.method()!=='OPTIONS')mutations.push(r.method()+' '+r.url());});
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});await page.waitForSelector(`a[href="${P}/webhooks/${hook.id}/deliveries"]`);await page.click(`a[href="${P}/webhooks/${hook.id}/deliveries"]`);await page.waitForSelector('.delivery-row');
  check('admin settings link opens scoped read-only journal',page.url()===journal&&await page.$$eval('.delivery-row',r=>r.length===3));
  const text=await page.$eval('.delivery-list',e=>e.textContent);
  check('persisted newest-first success HTTP attempts duration timestamp render',text.indexOf('Succeeded')<text.indexOf('Failed')&&text.includes('HTTP 204')&&text.includes('1 attempt(s)')&&text.includes('15 ms')&&await page.$$eval('time',r=>r.length===3&&r.every(e=>e.textContent.includes('2026'))));
  check('failed and no-response statuses explicit without raw network errors/secrets',text.includes('HTTP 503')&&text.includes('HTTP unavailable')&&text.includes('2 attempt(s)')&&!(await page.content()).includes('private-network-error')&&!(await page.content()).includes('private-dns-error')&&!(await page.content()).includes('private-signing-secret'));
  check('untrusted event string rendered as text not markup',text.includes(longEvent)&&!(await page.$('.delivery-row img')));
  check('page states snapshot limited scope and HTTP success caveat',await page.$eval('main',e=>e.textContent.includes('Up to 50')&&e.textContent.includes('not that it processed the event')&&e.textContent.includes('does not send or retry')));
  await page.screenshot({path:'/downloads/webhook-journal-desktop.png',fullPage:true});await page.setViewport({width:390,height:844});
  check('mobile long event wraps without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/downloads/webhook-journal-mobile.png',fullPage:true});
  let failReads=0;await page.setRequestInterception(true);const failRead=r=>{if(r.method()==='GET'&&new URL(r.url()).pathname===`/api${P}/webhooks/${hook.id}/deliveries`){failReads++;return r.respond({status:503,contentType:'application/json',body:JSON.stringify({message:'private-backend-error'})});}return r.continue();};page.on('request',failRead);await page.click('[name=refreshDeliveries]');await page.waitForSelector('[role=alert]');
  check('manual failed read hides stale rows and empty success; fixed safe retry',failReads===1&&!(await page.$('.delivery-row'))&&!(await page.$('[name=deliveriesEmpty]'))&&!(await page.content()).includes('private-backend-error')&&await page.$eval('[role=alert]',e=>e.textContent.includes('No deliveries are shown')));
  await page.screenshot({path:'/downloads/webhook-journal-error.png',fullPage:true});page.off('request',failRead);
  let held=false,reads=0,release;const gate=new Promise(r=>release=r);const holdRead=async r=>{if(r.method()==='GET'&&new URL(r.url()).pathname===`/api${P}/webhooks/${hook.id}/deliveries`){held=true;reads++;await gate;}return r.continue();};page.on('request',holdRead);await page.click('[name=refreshDeliveries]');for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,20));if(!held)throw new Error('read not held');await page.click('[name=refreshDeliveries]');
  check('held manual refresh disables duplicates and clears stale error/rows',reads===1&&await page.$eval('[name=refreshDeliveries]',e=>e.disabled&&e.getAttribute('aria-busy')==='true')&&!(await page.$('[role=alert]'))&&!(await page.$('.delivery-row'))&&!(await page.$('[name=deliveriesEmpty]')));
  release();await page.waitForSelector('.delivery-row');check('manual retry recovers persisted rows',await page.$$eval('.delivery-row',r=>r.length===3)&&!(await page.$('[role=alert]')));page.off('request',holdRead);await page.setRequestInterception(false);
  await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'));},`${P}/webhooks/${emptyHook.id}/deliveries`);await page.waitForSelector('[name=deliveriesEmpty]');check('existing empty webhook gives explicit empty state',!(await page.$('.delivery-row'))&&!(await page.$('[role=alert]')));
  await page.goto(journal,{waitUntil:'networkidle0'});await page.waitForSelector('.delivery-row');await prisma.webhook.delete({where:{id:hook.id}});await page.click('[name=refreshDeliveries]');await page.waitForSelector('[role=alert]');check('deleted webhook 404 hides previous rows without exposing API detail',!(await page.$('.delivery-row'))&&!(await page.$('[name=deliveriesEmpty]')));
  const member=await call('/auth/signup',{email:'journal-member@example.com',password:'pass1234',displayName:'Member'});await prisma.teamMember.create({data:{teamId:project.teamId,userId:member.user.id,role:'MEMBER'}});await page.evaluate(t=>localStorage.setItem('ol_token',t),member.accessToken);
  await page.goto(`${WEB}${P}/settings`,{waitUntil:'networkidle0'});check('ordinary member settings omit journal link',!(await page.$(`a[href$="/deliveries"]`)));
  const denied=await fetch(`${API}${P}/webhooks/${emptyHook.id}/deliveries`,{headers:{Authorization:`Bearer ${member.accessToken}`}});check('live journal API rejects ordinary member with 403',denied.status===403);
  await page.goto(`${WEB}${P}/webhooks/${emptyHook.id}/deliveries`,{waitUntil:'networkidle0'});await page.waitForSelector('[role=alert]');check('direct member journal route fails closed without empty success',!(await page.$('.delivery-row'))&&!(await page.$('[name=deliveriesEmpty]')));
  check('journal browsing refresh failure retry and empty flow sends no mutations',mutations.length===0);
  check('journal has no page runtime errors',!diagnostics.some(d=>/TypeError|Cannot read properties|NG0955|NG0\d{3}/.test(d)));
  console.log(failures?'WEBHOOK JOURNAL BROWSER CHECKS FAILED':'ALL WEBHOOK JOURNAL BROWSER CHECKS PASSED');process.exitCode=failures?1:0;
} catch(e){console.log(`FAIL suite aborted: ${e?.stack??e}`);process.exitCode=1;}
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
process.exit(process.exitCode??1);
