// SAML SP slice: inbound Web-SSO POST profile against the LOCAL MOCK IdP
// (scripts/mock-saml.mjs) only - no external IdP, no real accounts.
// All signature verification is done server-side by @node-saml/node-saml;
// the mock signs with the same maintained xml-crypto. Negative legs are
// discriminating: each uses a fresh login (fresh InResponseTo) and an
// otherwise fully valid, correctly signed response, so only the rule under
// test can reject it. Run: node scripts/saml-test.mjs (requires: nx build api)
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const PG_PORT = 55476, API_PORT = 3000, MOCK_PORT = 5556;
const API = `http://127.0.0.1:${API_PORT}/api`;
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
const IDP_ENTITY_ID = `${MOCK}/idp`;
const root = process.cwd();
let failures = 0;
process.exitCode = 1; // fail-closed exit
const check = (n, c, x = '') => { console.log(`${c ? 'PASS' : (failures++, 'FAIL')} ${n} ${x}`); };

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32dec(s) {
  const clean = s.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function totp(secretB32, counterOffset = 0) {
  const counter = Math.floor(Date.now() / 1000 / 30) + counterOffset;
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', b32dec(secretB32)).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, '0');
}
async function call(path, { jwt, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const waitFor = async (url, tries = 90) => {
  for (let i = 0; i < tries; i++) { await new Promise((r) => setTimeout(r, 500)); if (await fetch(url).then((r) => r.status > 0).catch(() => false)) return true; }
  return false;
};
async function mint(knobs = {}) {
  const res = await fetch(`${MOCK}/mint`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(knobs) });
  const j = await res.json();
  if (!j.SAMLResponse) throw new Error(`mint failed: ${JSON.stringify(j)}`);
  return j.SAMLResponse;
}
// One fresh SP-initiated login: returns the AuthnRequest ID the IdP must echo.
async function freshRequestId() {
  const login = await call('/auth/saml/login');
  const u = new URL(login.json.url);
  const samlRequest = u.searchParams.get('SAMLRequest');
  const res = await fetch(`${MOCK}/sso?SAMLRequest=${encodeURIComponent(samlRequest)}`);
  return (await res.json()).requestId;
}

const dataDir = mkdtempSync(join(tmpdir(), 'ol-pg-saml-'));
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false });
let api, mock, prisma;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('openlocale_saml');
  const url = `postgresql://postgres:postgres@localhost:${PG_PORT}/openlocale_saml`;
  execFileSync(join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  mock = spawn(process.execPath, [join(root, 'scripts', 'mock-saml.mjs')], { stdio: 'pipe' });
  if (!(await waitFor(`${MOCK}/cert`))) throw new Error('mock IdP did not start');
  const cert = (await (await fetch(`${MOCK}/cert`)).json()).cert;
  // SP signing keypair for the AuthnRequest-signing legs: the API gets the
  // private key + cert, and the mock IdP gets the cert so it can verify the
  // redirect-binding signature the way a real IdP would.
  const spDir = mkdtempSync(join(tmpdir(), 'ol-sp-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', join(spDir, 'key.pem'),
    '-out', join(spDir, 'cert.pem'), '-days', '1', '-nodes', '-subj', '/CN=open-locale-sp'], { stdio: 'pipe' });
  const spKeyPem = readFileSync(join(spDir, 'key.pem'), 'utf8');
  const spCertB64 = readFileSync(join(spDir, 'cert.pem'), 'utf8').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  await fetch(`${MOCK}/sp-cert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cert: spCertB64 }) });
  api = spawn(process.execPath, [join(root, 'dist', 'apps', 'api', 'main.js')], {
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: 'saml-secret', TOTP_ENCRYPTION_KEY: 'saml-test-key-0123456789',
      SAML_ENTRY_POINT: `${MOCK}/sso`, SAML_IDP_CERT: cert, SAML_IDP_ENTITY_ID: IDP_ENTITY_ID,
      SAML_SP_ENTITY_ID: 'open-locale', SAML_ACS_URL: `http://127.0.0.1:${API_PORT}/api/auth/saml/acs`,
      SAML_SP_PRIVATE_KEY: spKeyPem, SAML_SP_SIGNING_CERT: spCertB64, PORT: String(API_PORT) }, stdio: 'pipe' });
  if (!(await waitFor(`${API}/projects`))) throw new Error('API did not start');
  prisma = new PrismaClient({ datasources: { db: { url } } });

  // Happy path: fresh login, correctly signed response, echoed InResponseTo.
  const metaRes = await fetch(`${API}/auth/saml/metadata`);
  const metaXml = await metaRes.text();
  check('metadata endpoint returns SP descriptor with entity ID and ACS', metaRes.status === 200 && metaXml.includes('entityID="open-locale"') && metaXml.includes('/api/auth/saml/acs'), `status=${metaRes.status}`);
  check('metadata advertises the SP signing certificate', metaXml.includes('use="signing"') && metaXml.includes(spCertB64.slice(0, 40)));
  const spInfo = await call('/auth/saml/sp-info');
  check('sp-info reports configured state with public values only', spInfo.json?.configured === true && spInfo.json?.entityId === 'open-locale' && spInfo.json?.acsUrl.endsWith('/api/auth/saml/acs') && spInfo.json?.idpEntryPoint === `${MOCK}/sso` && spInfo.json?.requestSigning === true && !('idpCert' in (spInfo.json ?? {})) && !('privateKey' in (spInfo.json ?? {})), JSON.stringify(spInfo.json).slice(0, 120));
  const login1 = await call('/auth/saml/login');
  const lu = new URL(login1.json.url);
  check('login returns URL on IdP entry point origin', lu.origin === MOCK && lu.pathname === '/sso', lu.origin + lu.pathname);
  const samlRequest = lu.searchParams.get('SAMLRequest');
  check('login URL carries a SAMLRequest parameter', typeof samlRequest === 'string' && samlRequest.length > 20);
  check('AuthnRequest is signed (SigAlg + Signature on the URL)', lu.searchParams.get('SigAlg') === 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256' && !!lu.searchParams.get('Signature'));
  const ssoRes = await (await fetch(`${MOCK}/sso?${lu.search.slice(1)}`)).json();
  check('mock IdP verifies the SP request signature', ssoRes.spSignature === 'valid', String(ssoRes.spSignature));
  const tamperedQuery = lu.search.slice(1).replace(/Signature=[^&]+/, (m) => `Signature=${m.slice(10, -4)}AAAA`);
  const tamperedSso = await (await fetch(`${MOCK}/sso?${tamperedQuery}`)).json();
  check('mock IdP rejects a tampered request signature (discriminating)', tamperedSso.spSignature === 'invalid', String(tamperedSso.spSignature));
  const reqId = await freshRequestId();
  check('mock IdP decodes the deflated AuthnRequest and its ID', typeof reqId === 'string' && reqId.length > 5, String(reqId));
  const happy = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ inResponseTo: reqId }) } });
  check('valid signed response provisions user and issues a session', (happy.status === 200 || happy.status === 201) && !!happy.json?.accessToken && !!happy.json?.user?.id, `status=${happy.status}`);
  const happyAuthed = await call('/auth/2fa/status', { jwt: happy.json.accessToken });
  check('SSO-issued session authenticates against a protected endpoint', happyAuthed.status === 200, `got ${happyAuthed.status}`);
  const provisioned = await prisma.user.findUnique({ where: { email: 'saml-user@example.com' }, include: { externalIdentities: true } });
  check('provisioned user is passwordless with a bound saml identity', !!provisioned && provisioned.passwordHash === '' && provisioned.externalIdentities.length === 1 && provisioned.externalIdentities[0].issuer === `saml:${IDP_ENTITY_ID}`);

  // Replay: the exact same response bytes a second time.
  const replayReq = await freshRequestId();
  const replayResp = await mint({ inResponseTo: replayReq, email: 'replay@example.com' });
  const first = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: replayResp } });
  const second = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: replayResp } });
  check('replayed response rejected (request ID consumed / assertion replay)', (first.status === 200 || first.status === 201) && second.status === 401, `first=${first.status} second=${second.status}`);

  // Negative legs: each otherwise fully valid and correctly signed.
  const cases = [
    ['wrong audience rejected', { audience: 'someone-else' }],
    ['wrong Recipient rejected', { recipient: 'http://127.0.0.1:3000/api/auth/saml/acs-evil' }],
    ['wrong Destination rejected', { destination: 'http://127.0.0.1:3000/api/auth/saml/acs-evil' }],
    ['email tampered after signing rejected', { tamperEmail: true }],
    ['unsigned assertion rejected', { signAssertion: false }],
    ['unsigned response rejected', { signResponse: false }],
    ['expired conditions rejected', { conditionsOffsetSec: -600, scdOffsetSec: -600 }],
  ];
  for (const [name, knobs] of cases) {
    const rid = await freshRequestId();
    const r = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ ...knobs, inResponseTo: rid, email: `neg-${knobs.audience ? 'aud' : Math.random().toString(36).slice(2, 8)}@example.com` }) } });
    check(name, r.status === 401, `got ${r.status}`);
  }
  // Adversarial wrapping / namespace-confusion / duplicate-ID / DTD legs.
  // Each response is otherwise fully valid with BOTH signatures valid, so
  // only the structural rule under test can reject it.
  const adversarial = [
    ['DOCTYPE/entity declaration rejected', { doctype: true }],
    ['sibling second assertion rejected (wrapping shape)', { siblingAssertion: true }],
    ['hidden duplicate-ID assertion rejected (wrapping primitive)', { deepAssertion: true }],
    ['namespace-confused assertion sibling rejected', { nsAssertion: true }],
  ];
  for (const [name, knobs] of adversarial) {
    const rid = await freshRequestId();
    const r = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ ...knobs, inResponseTo: rid, email: `adv-${Math.random().toString(36).slice(2, 8)}@example.com` }) } });
    // The reason is asserted too, so the leg proves rejection comes from the
    // structural rule under test and not incidentally (e.g. a signature
    // failure would say "SAML validation failed" instead).
    check(name, r.status === 401 && typeof r.json?.message === 'string' && !r.json.message.startsWith('SAML validation failed'), `got ${r.status} "${String(r.json?.message).slice(0, 80)}"`);
  }
  const noIrt = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ email: 'noirt@example.com' }) } });
  check('missing InResponseTo rejected', noIrt.status === 401, `got ${noIrt.status}`);
  const bogusIrt = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ inResponseTo: '_bogus-never-issued', email: 'bogus@example.com' }) } });
  check('unknown InResponseTo rejected', bogusIrt.status === 401, `got ${bogusIrt.status}`);

  // Anti-takeover: existing local account with the same email, no binding.
  await call('/auth/signup', { method: 'POST', body: { email: 'collide@example.com', password: 'pass1234', displayName: 'Local' } });
  const ridC = await freshRequestId();
  const collide = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ inResponseTo: ridC, email: 'collide@example.com' }) } });
  check('email collision with existing account rejected (no auto-link)', collide.status === 409, `got ${collide.status}`);
  const notLinked = await prisma.user.findUnique({ where: { email: 'collide@example.com' }, include: { externalIdentities: true } });
  check('no identity was bound on the collision attempt', notLinked.externalIdentities.length === 0);

  // Local 2FA after SSO: fixture = user with a password, TOTP enabled via the
  // real endpoints, and an ExternalIdentity row bound directly (what the
  // authenticated linking flow will produce once implemented for SAML).
  await call('/auth/signup', { method: 'POST', body: { email: 'twofa@example.com', password: 'pass1234', displayName: 'TwoFA' } });
  const tfLogin = (await call('/auth/login', { method: 'POST', body: { email: 'twofa@example.com', password: 'pass1234' } })).json;
  const tfSetup = (await call('/auth/2fa/setup', { jwt: tfLogin.accessToken, method: 'POST', body: { password: 'pass1234' } })).json;
  await call('/auth/2fa/enable', { jwt: tfLogin.accessToken, method: 'POST', body: { password: 'pass1234', code: totp(tfSetup.secret) } });
  await prisma.externalIdentity.create({ data: { userId: tfLogin.user.id, issuer: `saml:${IDP_ENTITY_ID}`, subject: 'idp-sub-twofa@example.com', email: 'twofa@example.com' } });
  const ridT = await freshRequestId();
  const tfAcs = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ inResponseTo: ridT, email: 'twofa@example.com' }) } });
  check('SSO into 2FA account returns requiresTwoFactor (no tokens yet)', tfAcs.json?.requiresTwoFactor === true && !tfAcs.json?.accessToken, `status=${tfAcs.status}`);
  const wrongCode = await call('/auth/saml/complete', { method: 'POST', body: { pendingToken: tfAcs.json.pendingToken, totpCode: totp(tfSetup.secret) === '000000' ? '000001' : '000000' } });
  check('wrong second-factor code rejected', wrongCode.status === 401, `got ${wrongCode.status}`);
  const ridT2 = await freshRequestId();
  const tfAcs2 = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ inResponseTo: ridT2, email: 'twofa@example.com' }) } });
  // enable claims the current TOTP window's counter, so the completing
  // login uses the next window's code (the verifier accepts +-1 window).
  const done = await call('/auth/saml/complete', { method: 'POST', body: { pendingToken: tfAcs2.json.pendingToken, totpCode: totp(tfSetup.secret, 1) } });
  check('correct second-factor code completes SSO login', (done.status === 200 || done.status === 201) && !!done.json?.accessToken, `status=${done.status}`);
  const reuse = await call('/auth/saml/complete', { method: 'POST', body: { pendingToken: tfAcs2.json.pendingToken, totpCode: totp(tfSetup.secret, 1) } });
  check('pending token single-use after completion', reuse.status === 401, `got ${reuse.status}`);

  // Account linking: session-only start-link with fresh password, binding
  // carried as an opaque RelayState token, single-use, epoch-bound.
  await call('/auth/signup', { method: 'POST', body: { email: 'eve-link@example.com', password: 'pass1234', displayName: 'Eve' } });
  const eveLogin = (await call('/auth/login', { method: 'POST', body: { email: 'eve-link@example.com', password: 'pass1234' } })).json;
  const noAuth = await call('/auth/saml/start-link', { method: 'POST', body: { password: 'pass1234' } });
  check('start-link without a session rejected', noAuth.status === 401, `got ${noAuth.status}`);
  const wrongPw = await call('/auth/saml/start-link', { jwt: eveLogin.accessToken, method: 'POST', body: { password: 'nope-nope' } });
  check('start-link with wrong password rejected', wrongPw.status === 401, `got ${wrongPw.status}`);
  const linkStart = (await call('/auth/saml/start-link', { jwt: eveLogin.accessToken, method: 'POST', body: { password: 'pass1234' } })).json;
  const relay = new URL(linkStart.url).searchParams.get('RelayState');
  check('start-link returns IdP URL carrying an opaque RelayState', typeof relay === 'string' && relay.length > 10);
  const ridL = await freshRequestId();
  // The asserted email differs from the account email on purpose: the
  // anti-takeover boundary is the fresh-password step-up, not email matching.
  const linkAcs = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ inResponseTo: ridL, email: 'eve-saml-asserted@example.com' }), RelayState: relay } });
  check('link flow binds identity and issues the linker session', (linkAcs.status === 200 || linkAcs.status === 201) && linkAcs.json?.user?.email === 'eve-link@example.com', `status=${linkAcs.status}`);
  const eveBound = await prisma.externalIdentity.findFirst({ where: { issuer: `saml:${IDP_ENTITY_ID}`, subject: 'idp-sub-eve-saml-asserted@example.com' } });
  check('binding row points at the linker account', eveBound?.userId === eveLogin.user.id);
  const ridReuse = await freshRequestId();
  const reuseLink = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ inResponseTo: ridReuse, email: 'second-attempt@example.com' }), RelayState: relay } });
  check('link RelayState token is single-use', reuseLink.status === 401, `got ${reuseLink.status}`);
  await call('/auth/signup', { method: 'POST', body: { email: 'frank-link@example.com', password: 'pass1234', displayName: 'Frank' } });
  const frankLogin = (await call('/auth/login', { method: 'POST', body: { email: 'frank-link@example.com', password: 'pass1234' } })).json;
  const frankLink = (await call('/auth/saml/start-link', { jwt: frankLogin.accessToken, method: 'POST', body: { password: 'pass1234' } })).json;
  const ridF = await freshRequestId();
  const stealLink = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ inResponseTo: ridF, email: 'saml-user@example.com' }), RelayState: new URL(frankLink.url).searchParams.get('RelayState') } });
  check('linking an identity bound to a different account rejected', stealLink.status === 409, `got ${stealLink.status}`);
  const ridP = await freshRequestId();
  const plainLogin = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ inResponseTo: ridP, email: 'eve-saml-asserted@example.com' }) } });
  check('plain SAML login after link uses the binding (linker session)', (plainLogin.status === 200 || plainLogin.status === 201) && plainLogin.json?.user?.email === 'eve-link@example.com', `status=${plainLogin.status}`);
  const ridU = await freshRequestId();
  const unknownRelay = await call('/auth/saml/acs', { method: 'POST', body: { SAMLResponse: await mint({ inResponseTo: ridU, email: 'unknown-relay@example.com' }), RelayState: 'bogus-token' } });
  // The SP only ever issues RelayState for link flows, so an arriving token
  // we did not issue is anomalous: fail closed rather than silently degrade
  // to a non-link login.
  check('unissued RelayState rejected (only SP-issued link tokens honored)', unknownRelay.status === 401, `got ${unknownRelay.status}`);
  const unknownBound = await prisma.externalIdentity.findFirst({ where: { email: 'unknown-relay@example.com' } });
  check('rejected RelayState created no binding or account', !unknownBound && !(await prisma.user.findUnique({ where: { email: 'unknown-relay@example.com' } })));

  console.log(failures === 0 ? 'ALL SAML CHECKS PASSED' : `${failures} SAML CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (e) {
  console.log(`FAIL suite aborted: ${e.message || e}`);
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect().catch(() => {});
  if (api) api.kill('SIGKILL');
  if (mock) mock.kill('SIGKILL');
  await pg.stop().catch(() => {});
}
