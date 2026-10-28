import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthPrincipal {
  userId: string;
  email: string;
  via: 'jwt' | 'api-token';
  scopes?: string[];
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
    return this.issueTokens(user.id, user.email);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return this.issueTokens(user.id, user.email);
  }

  private issueTokens(userId: string, email: string) {
    return {
      accessToken: this.jwt.sign({ sub: userId, email }),
      user: { id: userId, email },
    };
  }

  async verifyAccessToken(token: string): Promise<AuthPrincipal | null> {
    try {
      const payload = this.jwt.verify<{ sub: string; email: string }>(token);
      return { userId: payload.sub, email: payload.email, via: 'jwt' };
    } catch {
      return null;
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
