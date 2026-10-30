import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SAML, ValidateInResponseTo, type Profile } from '@node-saml/node-saml';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const b64url = (b: Buffer) => b.toString('base64url');

// SAML 2.0 service provider (POST binding, inbound only in this slice).
// All signature/condition validation is delegated to the maintained
// @node-saml/node-saml library (xml-crypto underneath); NOTHING here parses
// or verifies signatures by hand. Configuration is fail-closed: both the
// Response and the Assertion must be signed with RS256, audience and issuer
// are pinned, InResponseTo is always required and consumed once (the
// library's cache provider), and assertion-ID replay is rejected.
// On top of the library, precheck() hard-fails the two checks v5 only warns
// about (rejection is announced for v6): the Response Destination and every
// bearer SubjectConfirmationData Recipient must equal our ACS URL.
@Injectable()
export class SamlService {
  private saml: SAML | null = null;
  // Pending SAML logins waiting for the local second factor. Same shape as
  // the OIDC pending store; unifying the two is a documented follow-up -
  // this slice deliberately does not touch the verified OIDC path.
  private pending = new Map<string, { userId: string; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  private config() {
    const entryPoint = process.env.SAML_ENTRY_POINT;
    const idpCert = process.env.SAML_IDP_CERT;
    if (!entryPoint || !idpCert) throw new NotFoundException('SAML is not configured');
    return {
      entryPoint,
      idpCert,
      idpIssuer: process.env.SAML_IDP_ENTITY_ID || undefined,
      issuer: process.env.SAML_SP_ENTITY_ID || 'open-locale',
      callbackUrl: process.env.SAML_ACS_URL || 'http://127.0.0.1:3000/api/auth/saml/acs',
    };
  }

  private client(): SAML {
    if (!this.saml) {
      const c = this.config();
      this.saml = new SAML({
        issuer: c.issuer,
        audience: c.issuer,
        callbackUrl: c.callbackUrl,
        entryPoint: c.entryPoint,
        idpCert: c.idpCert,
        idpIssuer: c.idpIssuer,
        wantAssertionsSigned: true,
        wantAuthnResponseSigned: true,
        signatureAlgorithm: 'sha256',
        validateInResponseTo: ValidateInResponseTo.always,
        rejectReplayedAssertions: true,
        maxAssertionAgeMs: 10 * 60 * 1000,
      });
    }
    return this.saml;
  }

  async login(): Promise<{ url: string }> {
    // The generated AuthnRequest ID is saved into the instance's cache
    // provider by the library, which is what makes the InResponseTo
    // consumption at the ACS enforceable.
    return { url: await this.client().getAuthorizeUrlAsync('', {}) };
  }

  // Structural pre-checks only (no crypto): the exact recipient/destination
  // fail-closed rules the library defers to its next major version.
  private precheck(xml: string, acsUrl: string) {
    let doc: Document;
    try {
      doc = new DOMParser().parseFromString(xml, 'text/xml');
    } catch {
      throw new UnauthorizedException('Malformed SAML response');
    }
    const responses = xpath.select("/*[local-name()='Response']", doc) as Element[];
    if (responses.length !== 1) throw new UnauthorizedException('Expected exactly one SAML Response');
    if (responses[0].getAttribute('Destination') !== acsUrl) {
      throw new UnauthorizedException('SAML response Destination mismatch');
    }
    const assertions = xpath.select("/*[local-name()='Response']/*[local-name()='Assertion']", doc) as Element[];
    if (assertions.length !== 1) throw new UnauthorizedException('Expected exactly one SAML assertion');
    const recipients = xpath.select("//*[local-name()='SubjectConfirmationData']/@Recipient", doc) as Attr[];
    if (!recipients.length || recipients.some((r) => r.value !== acsUrl)) {
      throw new UnauthorizedException('SAML assertion Recipient mismatch');
    }
  }

  async acs(samlResponseB64: string) {
    const c = this.config();
    const xml = Buffer.from(samlResponseB64, 'base64').toString('utf8');
    this.precheck(xml, c.callbackUrl);
    let profile: Profile;
    try {
      const { profile: p } = await this.client().validatePostResponseAsync({ SAMLResponse: samlResponseB64 });
      if (!p) throw new UnauthorizedException('SAML validation failed');
      profile = p;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException(`SAML validation failed: ${e instanceof Error ? e.message.slice(0, 160) : 'error'}`);
    }
    const sub = typeof profile.nameID === 'string' && profile.nameID ? profile.nameID : null;
    if (!sub) throw new UnauthorizedException('SAML assertion has no NameID');
    const attrs = profile as unknown as Record<string, unknown>;
    const emailRaw = attrs[process.env.SAML_ATTR_EMAIL || 'email'];
    const email = typeof emailRaw === 'string' ? emailRaw.toLowerCase() : '';
    if (!email) throw new BadRequestException('SAML assertion has no email attribute');
    const nameRaw = attrs[process.env.SAML_ATTR_NAME || 'displayName'];
    const displayName = typeof nameRaw === 'string' && nameRaw ? nameRaw : email.split('@')[0];
    const issuer = `saml:${c.idpIssuer || c.entryPoint}`;

    const identity = await this.prisma.externalIdentity.findUnique({
      where: { issuer_subject: { issuer, subject: sub } },
    });
    if (identity) return this.finish(identity.userId);

    // Never auto-link by email - that is account takeover. SAML has no
    // standard email-verified claim; the anti-takeover property comes from
    // requiring the authenticated linking flow for collisions (linking is
    // not yet implemented for SAML - fail closed with a clear 409).
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email exists - SAML account linking is not yet implemented');
    }
    // Provision a passwordless account (empty hash never matches bcrypt).
    // Two concurrent first logins for the same NEW email can both pass the
    // existence check; the unique constraint decides, and the loser gets the
    // same fail-closed 409 as any other collision - never an auto-link.
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: '',
          displayName,
          memberships: { create: { role: 'OWNER', team: { create: { name: `${displayName}'s team` } } } },
        },
      });
    } catch {
      throw new ConflictException('An account with this email exists - SAML account linking is not yet implemented');
    }
    try {
      await this.prisma.externalIdentity.create({ data: { userId: user.id, issuer, subject: sub, email } });
    } catch {
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
      this.pending.set(pendingToken, { userId, expiresAt: Date.now() + 5 * 60 * 1000 });
      return { requiresTwoFactor: true as const, pendingToken };
    }
    return this.auth.issueOidcTokens(userId, false);
  }

  async complete(pendingToken: string, totpCode: string) {
    // Synchronous consume-before-verify: concurrent completes have one winner.
    const p = this.pending.get(pendingToken);
    this.pending.delete(pendingToken);
    if (!p || p.expiresAt < Date.now()) throw new UnauthorizedException('Invalid or expired pending login');
    const passed = await this.auth.verifySecondFactorForUser(p.userId, totpCode);
    if (!passed) throw new UnauthorizedException('Invalid two-factor code');
    return this.auth.issueOidcTokens(p.userId, true);
  }
}
