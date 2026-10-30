// Local mock SAML identity provider for transport-level SP tests.
// Generates a real self-signed RSA key/cert with openssl at startup and
// produces SAML responses signed with the same maintained xml-crypto
// library the verifier uses - no hand-rolled signature math anywhere.
// Endpoints (JSON-over-HTTP harness, not a browser flow):
//   GET  /sso?SAMLRequest=...  -> { requestId } extracted from the deflated AuthnRequest
//   POST /mint                 -> { SAMLResponse } with knobs for negative tests
//   GET  /cert                 -> { cert } bare base64 cert for SAML_IDP_CERT
import http from 'node:http';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SignedXml } from 'xml-crypto';
import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

const PORT = 5556;
export const IDP_ENTITY_ID = 'http://127.0.0.1:5556/idp';
const dir = mkdtempSync(join(tmpdir(), 'mock-saml-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', join(dir, 'key.pem'),
  '-out', join(dir, 'cert.pem'), '-days', '1', '-nodes', '-subj', '/CN=mock-saml-idp'], { stdio: 'pipe' });
const privateKey = readFileSync(join(dir, 'key.pem'), 'utf8');
const certPem = readFileSync(join(dir, 'cert.pem'), 'utf8');
const certB64 = certPem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');

let counter = 0;
const nextId = (p) => `_${p}${Date.now().toString(36)}${(counter++).toString(36)}`;
const nowIso = (offsetSec = 0) => new Date(Date.now() + offsetSec * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

const SIG_ALG = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';

function signElement(xml, localName, elementId, issuerLocationXpath) {
  const sig = new SignedXml({
    privateKey,
    signatureAlgorithm: SIG_ALG,
    canonicalizationAlgorithm: C14N,
    getKeyInfoContent: () => `<ds:X509Data><ds:X509Certificate>${certB64}</ds:X509Certificate></ds:X509Data>`,
  });
  sig.addReference({
    xpath: `//*[local-name()='${localName}']`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', C14N],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    uri: `#${elementId}`,
  });
  sig.computeSignature(xml, { location: { reference: issuerLocationXpath, action: 'after' } });
  return sig.getSignedXml();
}

function buildResponse(knobs = {}) {
  const spEntity = knobs.spEntity || 'open-locale';
  const acsUrl = knobs.acsUrl || 'http://127.0.0.1:3000/api/auth/saml/acs';
  const respId = nextId('resp');
  const asrtId = nextId('asrt');
  const inResponseTo = knobs.inResponseTo;
  const audience = knobs.audience ?? spEntity;
  const recipient = knobs.recipient ?? acsUrl;
  const destination = knobs.destination ?? acsUrl;
  const email = knobs.email ?? 'saml-user@example.com';
  const nameId = knobs.nameId ?? `idp-sub-${email}`;
  const displayName = knobs.displayName ?? 'SAML User';
  const nooCond = nowIso(knobs.conditionsOffsetSec ?? 300);
  const nooScd = nowIso(knobs.scdOffsetSec ?? 300);
  let xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${respId}" Version="2.0" IssueInstant="${nowIso()}" Destination="${destination}"${inResponseTo ? ` InResponseTo="${inResponseTo}"` : ''}>` +
    `<saml:Issuer>${IDP_ENTITY_ID}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `<saml:Assertion ID="${asrtId}" Version="2.0" IssueInstant="${nowIso()}">` +
    `<saml:Issuer>${IDP_ENTITY_ID}</saml:Issuer>` +
    `<saml:Subject><saml:NameID>${nameId}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">` +
    `<saml:SubjectConfirmationData NotOnOrAfter="${nooScd}" Recipient="${recipient}"${inResponseTo ? ` InResponseTo="${inResponseTo}"` : ''}/>` +
    `</saml:SubjectConfirmation></saml:Subject>` +
    `<saml:Conditions NotBefore="${nowIso(-60)}" NotOnOrAfter="${nooCond}">` +
    `<saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${nowIso()}" SessionIndex="${nextId('sess')}">` +
    `<saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement>` +
    `<saml:AttributeStatement>` +
    `<saml:Attribute Name="email"><saml:AttributeValue>${email}</saml:AttributeValue></saml:Attribute>` +
    `<saml:Attribute Name="displayName"><saml:AttributeValue>${displayName}</saml:AttributeValue></saml:Attribute>` +
    `</saml:AttributeStatement></saml:Assertion></samlp:Response>`;
  // Change namespaces/issuer BEFORE signing: cryptographically valid
  // documents isolate protocol semantics from signature failure.
  if (knobs.wrongIssuer) xml = xml.replaceAll(IDP_ENTITY_ID, 'urn:other-idp');
  if (knobs.responseNamespace) xml = xml.replace('xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"', 'xmlns:samlp="urn:other-protocol"');
  if (knobs.assertionNamespace) xml = xml.replace('xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"', 'xmlns:saml="urn:other-assertion"');
  if (knobs.subjectNamespace) xml = xml.replace('<saml:Subject>', '<x:Subject xmlns:x="urn:other-subject">').replace('</saml:Subject>', '</x:Subject>');
  if (knobs.signAssertion !== false) {
    xml = signElement(xml, 'Assertion', asrtId, "//*[local-name()='Assertion']/*[local-name()='Issuer']");
  }
  // Adversarial injections happen BEFORE the Response is signed, so the
  // Response signature stays valid and rejection can only come from the
  // structural rule under test.
  if (knobs.siblingAssertion) {
    const evil = `<saml:Assertion ID="${nextId('evil')}" Version="2.0" IssueInstant="${nowIso()}"><saml:Issuer>${IDP_ENTITY_ID}</saml:Issuer><saml:Subject><saml:NameID>attacker@evil.example</saml:NameID></saml:Subject></saml:Assertion>`;
    xml = xml.replace('</samlp:Response>', `${evil}</samlp:Response>`);
  }
  if (knobs.deepAssertion) {
    // Hidden assertion INSIDE Extensions carrying the SAME ID as the real
    // signed assertion - the classic duplicate-ID wrapping primitive.
    const evil = `<samlp:Extensions><saml:Assertion ID="${asrtId}" Version="2.0" IssueInstant="${nowIso()}"><saml:Issuer>urn:attacker</saml:Issuer><saml:Subject><saml:NameID>attacker@evil.example</saml:NameID></saml:Subject></saml:Assertion></samlp:Extensions>`;
    xml = xml.replace(`<samlp:Status>`, `${evil}<samlp:Status>`);
  }
  if (knobs.nsAssertion) {
    const evil = `<x:Assertion xmlns:x="urn:attacker-ns" ID="${nextId('nsevil')}" Version="2.0"><x:Subject><x:NameID>attacker@evil.example</x:NameID></x:Subject></x:Assertion>`;
    xml = xml.replace('</samlp:Response>', `${evil}</samlp:Response>`);
  }
  if (knobs.signResponse !== false) {
    xml = signElement(xml, 'Response', respId, "//*[local-name()='Response']/*[local-name()='Issuer']");
  }
  if (knobs.tamperEmail) {
    xml = xml.replace(`>${email}</saml:AttributeValue>`, '>tampered@evil.example</saml:AttributeValue>');
  }
  if (knobs.doctype) {
    xml = `<!DOCTYPE samlp:Response [<!ENTITY probe "doctype-probe">]>${xml}`;
  }
  return Buffer.from(xml, 'utf8').toString('base64');
}

// SP signing cert (set via POST /sp-cert): when the AuthnRequest arrives
// with SigAlg/Signature (HTTP-Redirect binding), the mock verifies it the
// way a real IdP would, so tests prove the SP's request signature is real.
let spCertPem = null;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (req.method === 'POST' && u.pathname === '/sp-cert') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const j = JSON.parse(body);
      spCertPem = `-----BEGIN CERTIFICATE-----\n${j.cert.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
    return;
  }
  if (req.method === 'GET' && u.pathname === '/cert') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ cert: certB64 }));
    return;
  }
  if (req.method === 'GET' && u.pathname === '/sso') {
    try {
      const deflated = Buffer.from(u.searchParams.get('SAMLRequest'), 'base64');
      const xml = zlib.inflateRawSync(deflated).toString('utf8');
      const m = xml.match(/ID="([^"]+)"/);
      // HTTP-Redirect binding signature check (SAML Bindings 3.4.4.1): the
      // signature covers the URLSearchParams serialization of SAMLRequest,
      // RelayState (when present) and SigAlg, in that order - decode then
      // re-encode to reproduce the exact signed bytes.
      let spSignature = 'absent';
      const sigAlg = u.searchParams.get('SigAlg');
      const signature = u.searchParams.get('Signature');
      if (sigAlg || signature) {
        spSignature = 'invalid';
        if (spCertPem && sigAlg === 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256' && signature) {
          const base = new URLSearchParams();
          base.set('SAMLRequest', u.searchParams.get('SAMLRequest'));
          if (u.searchParams.get('RelayState') !== null) base.set('RelayState', u.searchParams.get('RelayState'));
          base.set('SigAlg', sigAlg);
          const ok = cryptoVerify('sha256', Buffer.from(base.toString()), createPublicKey(spCertPem), Buffer.from(signature, 'base64'));
          spSignature = ok ? 'valid' : 'invalid';
        }
      }
      if (process.env.MOCK_SAML_BROWSER === '1') {
        const response = buildResponse({ inResponseTo: m[1] });
        const relay = u.searchParams.get('RelayState') || '';
        const escape = v => v.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
        res.writeHead(200, { 'content-type': 'text/html', 'cache-control':'no-store' });
        res.end(`<form method="post" action="http://127.0.0.1:3000/api/auth/saml/acs"><input name="SAMLResponse" value="${escape(response)}"><input name="RelayState" value="${escape(relay)}"></form><script>document.forms[0].submit()</script>`);
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ requestId: m[1], spSignature }));
    } catch (e) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }
  if (req.method === 'POST' && u.pathname === '/mint') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const knobs = body ? JSON.parse(body) : {};
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ SAMLResponse: buildResponse(knobs) }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(e.message || e) }));
      }
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{}');
});
server.listen(PORT, '127.0.0.1', () => console.log(`mock-saml listening on ${PORT}`));
