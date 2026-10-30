jest.mock('./auth.service', () => ({ AuthService: class {} }));
import { generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SamlService } from './saml.service';

describe('SAML fail-closed configuration', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.SAML_ENTRY_POINT = 'https://idp.example/sso';
    process.env.SAML_IDP_CERT = 'configured';
    process.env.SAML_IDP_ENTITY_ID = 'urn:expected-idp';
    delete process.env.SAML_SP_PRIVATE_KEY;
    delete process.env.SAML_SP_SIGNING_CERT;
  });
  afterEach(() => { process.env = { ...original }; });
  const service = () => new SamlService(null as never, null as never);
  it('requires an explicit IdP issuer rather than silently disabling checks', () => {
    delete process.env.SAML_IDP_ENTITY_ID;
    expect(() => service().spInfo()).toThrow('SAML_IDP_ENTITY_ID is required');
  });
  it('rejects whitespace-only issuer', () => {
    process.env.SAML_IDP_ENTITY_ID = '  ';
    expect(() => service().spInfo()).toThrow('required');
  });
  it('rejects a private key without a certificate', () => {
    process.env.SAML_SP_PRIVATE_KEY = 'key';
    expect(() => service().spInfo()).toThrow('both key and certificate');
  });
  it('rejects a certificate without a private key', () => {
    process.env.SAML_SP_SIGNING_CERT = 'cert';
    expect(() => service().spInfo()).toThrow('both key and certificate');
  });
  it('rejects invalid configured key/cert before generating requests', async () => {
    process.env.SAML_SP_PRIVATE_KEY = 'invalid'; process.env.SAML_SP_SIGNING_CERT = 'invalid';
    await expect(service().login()).rejects.toThrow('invalid or do not match');
  });
  it('rejects a valid private key with an invalid certificate', async () => {
    process.env.SAML_SP_PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({type:'pkcs8',format:'pem'}).toString();
    process.env.SAML_SP_SIGNING_CERT = 'invalid';
    await expect(service().login()).rejects.toThrow('invalid or do not match');
  });
  it('rejects a valid RSA key paired with another valid certificate', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'saml-config-unit-'));
    try {
      execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-days','1','-subj','/CN=fixture'], {stdio:'pipe'});
      process.env.SAML_SP_PRIVATE_KEY = generateKeyPairSync('rsa', {modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'}).toString();
      process.env.SAML_SP_SIGNING_CERT = readFileSync(join(dir,'cert.pem'),'utf8');
      await expect(service().login()).rejects.toThrow('invalid or do not match');
    } finally { rmSync(dir,{recursive:true,force:true}); }
  });

});
