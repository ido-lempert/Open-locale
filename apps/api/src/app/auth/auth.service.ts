import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { decryptTotpSecret, encryptTotpSecret } from './totp-crypto';
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, otpauthUrl, totpCode, verifyTotp } from './totp';

export interface AuthPrincipal {
  userId: string;
  email: string;
  via: 'jwt' | 'api-token';
  scopes?: string[];
  // True when this session completed the account's second factor at login.
  mfa?: boolean;
  // Session generation: bumped whenever 2FA is enabled or disabled, which
  // revokes every JWT issued earlier. API tokens are not epoch-bound.
  epoch?: number;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(email: string, password: string, displayName: string) {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) throw new ConflictException('An account with this email already exists');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        displayName: displayName.trim(),
        memberships: {
          create: {
            role: 'OWNER',
            team: { create: { name: `${displayName.trim()}'s team` } },
          },
        },
      },
    });
    return this.issueTokens(user.id, user.email, false, user.authEpoch);
  }

  // Failed second-factor attempts lock the account's 2FA for 10 minutes
  // after 5 consecutive failures (resets on success). Password verification
  // happens first, so this only throttles attackers who already hold the
  // password - it cannot be used to enumerate which accounts have 2FA.
  private static readonly TOTP_MAX_FAILURES = 5;
  private static readonly TOTP_LOCK_MS = 10 * 60 * 1000;

  async login(email: string, password: string, totpCode?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    if (user.totpEnabled) {
      if (user.totpLockedUntil && user.totpLockedUntil.getTime() > Date.now()) {
        throw new UnauthorizedException('Too many failed two-factor attempts; try again later');
      }
      const passed = totpCode ? await this.checkSecondFactor(user, totpCode) : false;
      if (!passed) {
        // Atomic increment - concurrent failures can never lose a count.
        const updated = await this.prisma.user.update({
          where: { id: user.id },
          data: { totpFailedAttempts: { increment: 1 } },
          select: { totpFailedAttempts: true },
        });
        if (updated.totpFailedAttempts >= AuthService.TOTP_MAX_FAILURES) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { totpLockedUntil: new Date(Date.now() + AuthService.TOTP_LOCK_MS), totpFailedAttempts: 0 },
          });
        }
        throw new UnauthorizedException(totpCode ? 'Invalid two-factor code' : 'Two-factor code required');
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { totpFailedAttempts: 0, totpLockedUntil: null },
      });
    }
    return this.issueTokens(user.id, user.email, user.totpEnabled, user.authEpoch);
  }

  // Accepts a current TOTP code (replay-protected by last-seen counter) or
  // an unused recovery code (consumed atomically on success).
  private async checkSecondFactor(user: { id: string; totpSecret: string | null; totpLastCounter: number | null }, code: string): Promise<boolean> {
    const trimmed = code.trim();
    if (/^\d{6}$/.test(trimmed) && user.totpSecret) {
      const secret = decryptTotpSecret(user.totpSecret);
      const counter = Math.floor(Date.now() / 1000 / 30);
      let matched: number | null = null;
      for (const w of [-1, 0, 1]) {
        const expected = Buffer.from(totpCode(secret, (counter + w) * 30_000));
        if (timingSafeEqual(Buffer.from(trimmed), expected)) { matched = counter + w; break; }
      }
      if (matched === null) return false;
      // Atomic claim: exactly one concurrent submission of the same code
      // advances the counter; the loser sees count 0 and is rejected.
      const claimed = await this.prisma.user.updateMany({
        where: { id: user.id, OR: [{ totpLastCounter: null }, { totpLastCounter: { lt: matched } }] },
        data: { totpLastCounter: matched },
      });
      return claimed.count === 1;
    }
    // Recovery code path: consume atomically - only one concurrent login can
    // mark the hash used.
    const hash = hashRecoveryCode(trimmed);
    const used = await this.prisma.recoveryCode.updateMany({
      where: { userId: user.id, codeHash: hash, usedAt: null },
      data: { usedAt: new Date() },
    });
    return used.count === 1;
  }

  // Generates and encrypts a pending secret; does NOT enable 2FA until a
  // valid code proves the authenticator was configured.
  private async requirePassword(user: { passwordHash: string }, password: string) {
    if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Current password required');
    }
  }

  async setupTotp(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    await this.requirePassword(user, password);
    if (user.totpEnabled) throw new ConflictException('Two-factor is already enabled; disable it first');
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: encryptTotpSecret(secret), totpLastCounter: null } });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  async enableTotp(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) throw new UnauthorizedException('Run setup first');
    await this.requirePassword(user, password);
    if (user.totpEnabled) throw new ConflictException('Two-factor is already enabled');
    if (!verifyTotp(decryptTotpSecret(user.totpSecret), code.trim())) {
      throw new UnauthorizedException('Code does not match the pending secret');
    }
    const codes = generateRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { totpEnabled: true, totpLastCounter: Math.floor(Date.now() / 1000 / 30), totpFailedAttempts: 0, totpLockedUntil: null, authEpoch: { increment: 1 } },
      });
      await tx.recoveryCode.deleteMany({ where: { userId } });
      await tx.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })) });
    });
    // Shown once; only hashes persist.
    return { enabled: true, recoveryCodes: codes };
  }

  async disableTotp(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled) throw new UnauthorizedException('Two-factor is not enabled');
    await this.requirePassword(user, password);
    const passed = await this.checkSecondFactor(user, code);
    if (!passed) throw new UnauthorizedException('Invalid two-factor code');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { totpEnabled: false, totpSecret: null, totpLastCounter: null, totpFailedAttempts: 0, totpLockedUntil: null, authEpoch: { increment: 1 } },
      });
      await tx.recoveryCode.deleteMany({ where: { userId } });
    });
    return { enabled: false };
  }

  async totpStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const remaining = await this.prisma.recoveryCode.count({ where: { userId, usedAt: null } });
    return { enabled: user.totpEnabled, recoveryCodesRemaining: user.totpEnabled ? remaining : 0 };
  }

  private issueTokens(userId: string, email: string, mfa: boolean, epoch: number) {
    return {
      accessToken: this.jwt.sign({ sub: userId, email, mfa, epoch }),
      user: { id: userId, email },
    };
  }

  // Step-up for session-sensitive operations: once an account has 2FA
  // enabled, sessions issued before (or without) completing the second
  // factor must not mint API tokens or manage 2FA. Checked live so
  // enabling 2FA takes effect on the very next request.
  async requireStepUp(userId: string, principal: AuthPrincipal) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { totpEnabled: true } });
    if (user?.totpEnabled && principal.mfa !== true) {
      throw new ForbiddenException('Step-up required: sign in again with your two-factor code');
    }
  }

  async verifyAccessToken(token: string): Promise<AuthPrincipal | null> {
    try {
      const payload = this.jwt.verify<{ sub: string; email: string; mfa?: boolean; epoch?: number }>(token);
      return {
        userId: payload.sub,
        email: payload.email,
        via: 'jwt',
        mfa: payload.mfa === true,
        epoch: payload.epoch ?? 0,
      };
    } catch {
      return null;
    }
  }

  // Live session authorization for JWT-authenticated requests: the token's
  // epoch must match the account's current epoch (enabling/disabling 2FA
  // revokes all earlier sessions, so a pre-2FA 7-day token dies at enable
  // and a pre-disable MFA token can never become valid again after a
  // re-enable with a new secret), and an account with 2FA on requires a
  // second-factor-completed session. API tokens skip this (via 'api-token'):
  // they are scoped credentials that never pass 2FA - documented boundary.
  async authorizeSession(principal: AuthPrincipal): Promise<void> {
    if (principal.via !== 'jwt') return;
    const user = await this.prisma.user.findUnique({
      where: { id: principal.userId },
      select: { authEpoch: true, totpEnabled: true },
    });
    if (!user || user.authEpoch !== (principal.epoch ?? 0)) {
      throw new UnauthorizedException('Session revoked - sign in again');
    }
    if (user.totpEnabled && principal.mfa !== true) {
      throw new ForbiddenException('Two-factor authentication required - sign in again with your code');
    }
  }

  async listApiTokens(userId: string) {
    const tokens = await this.prisma.apiToken.findMany({
      where: { userId },
      select: { id: true, name: true, scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return tokens;
  }

  async revokeApiToken(userId: string, tokenId: string) {
    const record = await this.prisma.apiToken.findFirst({ where: { id: tokenId, userId } });
    if (!record) return null;
    await this.prisma.apiToken.delete({ where: { id: record.id } });
    return { revoked: tokenId };
  }

  async createApiToken(userId: string, name: string, scopes: string[], expiresAt?: Date) {
    const raw = `ol_${randomBytes(24).toString('base64url')}`;
    const tokenHash = sha256(raw);
    const record = await this.prisma.apiToken.create({
      data: { userId, name, tokenHash, scopes, expiresAt },
    });
    return { id: record.id, name: record.name, token: raw };
  }

  async verifyApiToken(raw: string): Promise<AuthPrincipal | null> {
    if (!raw.startsWith('ol_')) return null;
    const tokenHash = sha256(raw);
    const record = await this.prisma.apiToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record) return null;
    const presented = Buffer.from(tokenHash);
    if (!timingSafeEqual(presented, Buffer.from(record.tokenHash))) return null;
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;
    await this.prisma.apiToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });
    return { userId: record.userId, email: record.user.email, via: 'api-token', scopes: record.scopes };
  }
}
