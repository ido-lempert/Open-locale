import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

// Process-local and bounded. Each protocol owns a separate instance; restarting
// the API invalidates in-flight logins. Synchronous create/consume has one winner.
export class PendingSso {
  private entries = new Map<string, { userId: string; epoch: number; expiresAt: number }>();
  constructor(private readonly capacity: number, private readonly ttlMs = 300_000, private readonly now = () => Date.now()) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || !Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('Invalid pending SSO bounds');
  }
  create(userId: string, epoch: number) {
    const now = this.now();
    for (const [key, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(key);
    if (this.entries.size >= this.capacity) throw new ServiceUnavailableException('Too many pending SSO logins');
    const token = randomBytes(24).toString('base64url');
    this.entries.set(token, { userId, epoch, expiresAt: now + this.ttlMs });
    return token;
  }
  consume(token: string) {
    const entry = this.entries.get(token);
    this.entries.delete(token);
    if (!entry || entry.expiresAt <= this.now()) throw new UnauthorizedException('Invalid or expired pending login');
    return { userId: entry.userId, epoch: entry.epoch };
  }
}
