// Local mock OIDC issuer for development and tests ONLY. Not a real IdP:
// no real users, no real credentials, test fixtures (sso-alice@t.dev etc.).
// Serves discovery metadata, an auto-approving authorize endpoint, a PKCE-
// checking token endpoint, JWKS, and a test-only /mint-code for negative
// tests (bad nonce/aud/iss/exp/signature).
import { createServer } from 'node:http';
import { createHash, generateKeyPairSync, sign as cryptoSign } from 'node:crypto';

const PORT = Number(process.env.MOCK_OIDC_PORT || 5555);
const ISSUER = `http://127.0.0.1:${PORT}`;

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: badKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
jwk.kid = 'mock-1'; jwk.alg = 'RS256'; jwk.use = 'sig';

const codes = new Map(); // code -> { challenge, nonce, claims, badSign }
let lastTokenHost = null;

const b64url = (x) => Buffer.from(x).toString('base64url');
const mint = (claims, useBadKey) => {
  const h = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'mock-1' }));
  const p = b64url(JSON.stringify(claims));
  const sig = cryptoSign('RSA-SHA256', Buffer.from(`${h}.${p}`), useBadKey ? badKey : privateKey);
  return `${h}.${p}.${sig.toString('base64url')}`;
};

createServer(async (req, res) => {
  const u = new URL(req.url, ISSUER);
  const json = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  // Multi-alias: the issuer identity follows the Host header, so the same
  // mock can serve APIs configured with 127.0.0.1 or localhost (the pinned
  // connector preserves the original Host header on the pinned connection).
  const issuer = `http://${req.headers.host || `127.0.0.1:${PORT}`}`;
  if (u.pathname === '/.well-known/openid-configuration') {
    if (process.env.MOCK_REDIRECT_METADATA) {
      res.writeHead(302, { location: `${issuer}/elsewhere` });
      return res.end();
    }
    return json(200, {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
    });
  }
  if (u.pathname === '/jwks') return json(200, { keys: [jwk] });
  if (u.pathname === '/authorize') {
    // Auto-approves the fixture user; sub/email overridable for test cases.
    const code = `mock-code-${codes.size + 1}`;
    codes.set(code, {
      challenge: u.searchParams.get('code_challenge'),
      nonce: u.searchParams.get('nonce'),
      claims: { sub: u.searchParams.get('fixture_sub') || 'mock-user-1', email: u.searchParams.get('fixture_email') || 'sso-alice@t.dev', name: u.searchParams.get('fixture_name') || 'SSO Alice', email_verified: u.searchParams.get('fixture_email_unverified') ? false : true },
    });
    const redir = new URL(u.searchParams.get('redirect_uri'));
    redir.searchParams.set('code', code);
    redir.searchParams.set('state', u.searchParams.get('state'));
    res.writeHead(302, { location: redir.toString() });
    return res.end();
  }
  if (u.pathname === '/mint-code' && req.method === 'POST') {
    // Test-only: pre-seed a code whose id_token carries arbitrary claims,
    // optionally signed with the wrong key. PKCE challenge still enforced.
    const body = JSON.parse(await new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); }));
    const code = `minted-${codes.size + 1}`;
    codes.set(code, { challenge: body.challenge, nonce: body.claims?.nonce ?? null, claims: body.claims || {}, badSign: !!body.badSign, rawIdToken: typeof body.rawIdToken === 'string' ? body.rawIdToken : null });
    return json(200, { code });
  }
  if (u.pathname === '/token' && req.method === 'POST') {
    lastTokenHost = req.headers.host;
    const body = new URLSearchParams(await new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); }));
    const code = body.get('code');
    const rec = codes.get(code);
    if (!rec) return json(400, { error: 'invalid_grant' });
    codes.delete(code); // single-use
    const verifier = body.get('code_verifier') || '';
    if (!rec.challenge || createHash('sha256').update(verifier).digest('base64url') !== rec.challenge) {
      return json(400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
    }
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: issuer,
      aud: body.get('client_id'),
      iat: now,
      exp: now + 300,
      nonce: rec.nonce,
      ...rec.claims, // test fixtures may override iss/aud/exp/nonce for negative tests
    };
    return json(200, { id_token: rec.rawIdToken ?? mint(claims, rec.badSign), token_type: 'Bearer', expires_in: 300 });
  }
  if (u.pathname === '/debug/last-token-host') return json(200, { host: lastTokenHost });
  json(404, { error: 'not found' });
}).listen(PORT, '127.0.0.1', () => console.log(`mock oidc issuer on ${ISSUER}`));
