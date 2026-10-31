// OIDC groundwork: authorization-code + PKCE login against a configured
// issuer. Local development and tests target the mock issuer in
// scripts/mock-oidc.mjs; no external IdP is enrolled, no provider account
// exists, and no real user is involved.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createPublicKey, randomBytes, verify as cryptoVerify } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PinnedFetchError, pinnedRequest } from '../egress/pinned';
import { AuthService } from './auth.service';

interface OidcState {
  nonce: string;
  verifier: string; // server-side only; never leaves the API
  linkUserId: string | null;
  linkEpoch: number | null; // authEpoch at start-link; stale linker state fails
  expiresAt: number;
}

interface OidcMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

const b64url = (b: Buffer) => b.toString('base64url');
const LOOPBACK = ['127.0.0.1', '::1', 'localhost'];

@Injectable()
export class OidcService {
  // In-memory state/pending stores: an API restart invalidates in-flight
  // logins (fail closed - users simply restart the flow). Documented limit.
  private states = new Map<string, OidcState>();
  private pending = new Map<string, { userId: string; epoch: number; expiresAt: number }>();
  private metadata: Promise<OidcMetadata> | null = null;

  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  private config() {
    const issuerRaw = process.env.OIDC_ISSUER;
    if (!issuerRaw) throw new NotFoundException('OIDC is not configured');
    return {
      issuer: issuerRaw.replace(/\/+$/, ''),
      clientId: process.env.OIDC_CLIENT_ID || 'open-locale',
      redirectUri: process.env.OIDC_REDIRECT_URI || 'http://127.0.0.1:4200/auth/oidc/callback',
    };
  }

  // Scheme/environment rules for the configured issuer. Connection-level
  // protection (deny-list + pinned connect + TLS hostname verification) is
  // enforced by the pinned connector on every outbound call below.
  private assertIssuerAllowed(): void {
    const u = new URL(this.config().issuer);
    const loopbackHost = LOOPBACK.includes(u.hostname);
    if (process.env.NODE_ENV === 'production') {
      if (u.protocol !== 'https:' || loopbackHost) {
        throw new BadRequestException('OIDC_ISSUER must be a public https origin in production');
      }
    } else if (u.protocol !== 'https:' && !(u.protocol === 'http:' && loopbackHost)) {
      throw new BadRequestException('OIDC_ISSUER must be https (http allowed only for loopback development)');
    }
  }

  // Every issuer call goes through the pinned connector: the hostname is
  // resolved, all addresses are checked against the deny list, and the
  // connection is made to the validated IP (no TOCTOU window) while TLS
  // still authenticates the original hostname. Redirects are errors, 5s
  // timeout, 64KB cap. The loopback mock exception is impossible in
  // production (pinnedRequest drops allowPrivate there).
  private async guardedJson(url: string, init?: { method?: string; body?: string }) {
    this.assertIssuerAllowed();
    const loopbackHost = LOOPBACK.includes(new URL(url).hostname);
    try {
      const res = await pinnedRequest(url, {
        method: init?.method,
        body: init?.body,
        headers: init?.body ? { 'content-type': 'application/x-www-form-urlencoded' } : undefined,
        allowPrivate: loopbackHost,
      });
      return { ok: res.status >= 200 && res.status < 300, status: res.status, json: () => res.json() as Record<string, unknown> };
    } catch (e) {
      if (e instanceof PinnedFetchError) throw new BadRequestException(`OIDC egress refused: ${e.message}`);
      throw e;
    }
  }

  private async meta(): Promise<OidcMetadata> {
    if (!this.metadata) {
      const { issuer } = this.config();
      const pending = (async (): Promise<OidcMetadata> => {
        const res = await this.guardedJson(`${issuer}/.well-known/openid-configuration`);
        if (!res.ok) throw new Error(`OIDC metadata fetch failed: ${res.status}`);
        const m = res.json();
        // The metadata's issuer must match the configured issuer, and every
        // endpoint we will call must live on the issuer's origin - no
        // cross-origin redirect of token/JWKS traffic.
        if (m.issuer !== issuer) throw new Error('OIDC metadata issuer mismatch');
        const origin = new URL(issuer).origin;
        for (const k of ['authorization_endpoint', 'token_endpoint', 'jwks_uri'] as const) {
          const v = m[k];
          if (typeof v !== 'string' || new URL(v).origin !== origin) {
            throw new Error(`OIDC metadata ${k} missing or outside issuer origin`);
          }
        }
        return m as unknown as OidcMetadata;
      })();
      this.metadata = pending;
      pending.catch(() => { this.metadata = null; });
    }
    return this.metadata;
  }

  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.states) if (v.expiresAt < now) this.states.delete(k);
    for (const [k, v] of this.pending) if (v.expiresAt < now) this.pending.delete(k);
  }

  async start(linkUserId: string | null, linkEpoch: number | null = null) {
    const { clientId, redirectUri } = this.config();
    const m = await this.meta();
    const state = b64url(randomBytes(16));
    const nonce = b64url(randomBytes(16));
    const verifier = b64url(randomBytes(32));
    const ttlMs = Number(process.env.OIDC_STATE_TTL_MS || 10 * 60 * 1000);
    this.states.set(state, { nonce, verifier, linkUserId, linkEpoch, expiresAt: Date.now() + ttlMs });
    this.sweep();
    const challenge = b64url(createHash('sha256').update(verifier).digest());
    const url = new URL(m.authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();
    // Never returns the verifier - only the derived challenge leaves the API.
    return { url: url.toString() };
  }

  private async verifyIdToken(token: string, jwksUri: string): Promise<Record<string, unknown>> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Malformed id_token');
    let header: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Malformed id_token');
    }
    // JSON.parse also succeeds on scalars and arrays: a "valid JSON" header
    // that is not an object is still malformed.
    if (typeof header !== 'object' || header === null || Array.isArray(header)) {
      throw new UnauthorizedException('Malformed id_token');
    }
    if (header.alg !== 'RS256') throw new UnauthorizedException('Unexpected id_token alg');
    const jwksRes = await this.guardedJson(jwksUri);
    if (!jwksRes.ok) throw new UnauthorizedException('JWKS fetch failed');
    const { keys } = jwksRes.json() as unknown as { keys: (JsonWebKey & { kid?: string })[] };
    const jwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) throw new UnauthorizedException('No matching JWKS key');
    const key = createPublicKey({ key: jwk as unknown as import('node:crypto').JsonWebKey, format: 'jwk' });
    const ok = cryptoVerify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
    if (!ok) throw new UnauthorizedException('id_token signature invalid');
    let claims: Record<string, unknown>;
    try {
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Malformed id_token');
    }
    if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) {
      throw new UnauthorizedException('Malformed id_token');
    }
    const { issuer, clientId } = this.config();
    if (claims.iss !== issuer) throw new UnauthorizedException('id_token issuer mismatch');
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(clientId)) throw new UnauthorizedException('id_token audience mismatch');
    // OIDC Core 3.1.3.7: a multi-valued aud REQUIRES an azp claim naming us,
    // and a supplied azp must ALWAYS name us - optional does not mean
    // ignorable when present. Otherwise a token issued for a different party
    // that merely lists our client_id in aud would be accepted.
    if (claims.azp !== undefined && claims.azp !== clientId) throw new UnauthorizedException('id_token authorized-party mismatch');
    if (aud.length > 1 && claims.azp === undefined) throw new UnauthorizedException('id_token missing authorized party');
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) throw new UnauthorizedException('id_token expired');
    if (typeof claims.sub !== 'string' || !claims.sub) throw new UnauthorizedException('id_token missing sub');
    return claims;
  }

  async callback(code: string, state: string) {
    // State is consumed up front: single-use whatever happens next; the
    // check-and-delete is synchronous, so concurrent submissions have
    // exactly one winner.
    const s = this.states.get(state);
    this.states.delete(state);
    if (!s || s.expiresAt < Date.now()) throw new UnauthorizedException('Invalid or expired state');
    const { issuer, clientId, redirectUri } = this.config();
    const m = await this.meta();
    const tokenRes = await this.guardedJson(m.token_endpoint, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: s.verifier,
      }).toString(),
    });
    if (!tokenRes.ok) throw new UnauthorizedException('Authorization code exchange failed');
    const body = tokenRes.json() as { id_token?: string };
    if (!body.id_token) throw new UnauthorizedException('Token response missing id_token');
    const claims = await this.verifyIdToken(body.id_token, m.jwks_uri);
    if (claims.nonce !== s.nonce) throw new UnauthorizedException('Nonce mismatch');
    const sub = claims.sub as string;
    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
    const displayName = typeof claims.name === 'string' && claims.name ? claims.name : email.split('@')[0] || 'sso-user';

    const identity = await this.prisma.externalIdentity.findUnique({
      where: { issuer_subject: { issuer, subject: sub } },
    });
    if (s.linkUserId) {
      // Linking flow: the state is bound to the account that started it AND
      // its authEpoch at that moment - a stale or revoked linker state fails.
      const linker = await this.prisma.user.findUnique({ where: { id: s.linkUserId }, select: { authEpoch: true } });
      if (!linker || linker.authEpoch !== s.linkEpoch) {
        throw new UnauthorizedException('Link state is stale - restart the linking flow');
      }
      if (identity && identity.userId !== s.linkUserId) {
        throw new ConflictException('This identity is already linked to a different account');
      }
      // The email we store on a new binding must be provider-verified.
      if (claims.email_verified !== true) {
        throw new BadRequestException('OIDC email claim is not verified by the provider');
      }
      if (!identity) {
        await this.prisma.externalIdentity.create({ data: { userId: s.linkUserId, issuer, subject: sub, email } });
      }
      return this.finish(s.linkUserId);
    }
    if (identity) return this.finish(identity.userId);

    // First login with this identity: never auto-link by email - that is
    // account takeover. An email collision requires the authenticated
    // linking flow instead.
    if (!email) throw new BadRequestException('OIDC identity has no email claim');
    if (claims.email_verified !== true) {
      throw new BadRequestException('OIDC email claim is not verified by the provider');
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email exists - sign in and link the identity from your account settings');
    }
    // Provision a new account. Empty passwordHash: password login is
    // impossible for this account (bcrypt never matches an empty hash).
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: '',
        displayName,
        memberships: { create: { role: 'OWNER', team: { create: { name: `${displayName}'s team` } } } },
      },
    });
    try {
      await this.prisma.externalIdentity.create({ data: { userId: user.id, issuer, subject: sub, email } });
    } catch {
      // Concurrent first login for the same identity: re-read the winner.
      const winner = await this.prisma.externalIdentity.findUnique({ where: { issuer_subject: { issuer, subject: sub } } });
      if (!winner) throw new UnauthorizedException('Identity binding failed');
      return this.finish(winner.userId);
    }
    return this.finish(user.id);
  }

  // Local 2FA still applies after SSO: an account with TOTP enabled must
  // pass the second factor before a session is issued.
  private async finish(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.totpEnabled) {
      const pendingToken = b64url(randomBytes(16));
      this.pending.set(pendingToken, { userId, epoch: user.authEpoch, expiresAt: Date.now() + 5 * 60 * 1000 });
      return { requiresTwoFactor: true as const, pendingToken };
    }
    return this.auth.issueOidcTokens(userId, false);
  }

  async complete(pendingToken: string, totpCode: string) {
    // Synchronous consume-before-verify: concurrent completes have one winner.
    const p = this.pending.get(pendingToken);
    this.pending.delete(pendingToken);
    if (!p || p.expiresAt < Date.now()) throw new UnauthorizedException('Invalid or expired pending login');
    if (await this.auth.sessionEpoch(p.userId) !== p.epoch) throw new UnauthorizedException('Pending sign-in is stale');
    const passed = await this.auth.verifySecondFactorForUser(p.userId, totpCode);
    if (!passed) throw new UnauthorizedException('Invalid two-factor code');
    return this.auth.issueOidcTokens(p.userId, true, p.epoch);
  }
}
