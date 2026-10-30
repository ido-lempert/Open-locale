import { ServiceUnavailableException } from '@nestjs/common';
import type { CacheItem, CacheProvider } from '@node-saml/node-saml';

// Process-local cache, not a distributed store. Mutations have no await
// before their state changes, so cap checks/insertion and consume are atomic
// within this JavaScript process. Implements the library's public contract,
// not its private cacheKeys layout. Expired entries are pruned BEFORE capacity
// checks, so a once-full cache recovers instead of refusing forever.
export class BoundedSamlCache implements CacheProvider {
  private entries = new Map<string, { value: string; createdAt: number; expiresAt: number }>();
  constructor(private readonly maxKeys: number, private readonly ttlMs: number) {
    if (!Number.isSafeInteger(maxKeys) || maxKeys < 1 || !Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('Invalid SAML cache bounds');
    }
  }
  private prune(now: number) {
    for (const [key, item] of this.entries) if (item.expiresAt <= now) this.entries.delete(key);
  }
  async saveAsync(key: string, value: string): Promise<CacheItem | null> {
    const now = Date.now(); this.prune(now);
    if (this.entries.has(key)) return null;
    if (this.entries.size >= this.maxKeys) throw new ServiceUnavailableException('SAML request cache is full');
    this.entries.set(key, { value, createdAt: now, expiresAt: now + this.ttlMs });
    return { value, createdAt: now };
  }
  async getAsync(key: string): Promise<string | null> {
    this.prune(Date.now()); return this.entries.get(key)?.value ?? null;
  }
  async consumeAsync(key: string): Promise<string | null> {
    const item = this.entries.get(key); this.entries.delete(key);
    return item && item.expiresAt > Date.now() ? item.value : null;
  }
  async removeAsync(key: string | null): Promise<string | null> {
    return key !== null && this.entries.delete(key) ? key : null;
  }
  async saveIfAbsentAsync(key: string, value: string, expiresAtMs: number): Promise<boolean> {
    const now = Date.now(); this.prune(now);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now || this.entries.has(key) || this.entries.size >= this.maxKeys) return false;
    this.entries.set(key, { value, createdAt: now, expiresAt: expiresAtMs });
    return true;
  }
}
