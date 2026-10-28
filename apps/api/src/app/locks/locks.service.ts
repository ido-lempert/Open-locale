import { Injectable } from '@nestjs/common';

// In-process per-project mutex serializing bulk mutations (imports, restores)
// so automatic snapshots always capture an authoritative pre-mutation state.
// Single-instance scope: a multi-instance deployment must move this to a
// database-level lock on a dedicated connection (a Prisma-pool-held advisory
// lock was tried and starved the pool - P2024).
@Injectable()
export class LocksService {
  private readonly locks = new Map<string, Promise<unknown>>();

  async withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(projectId) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(fn);
    this.locks.set(projectId, next);
    try {
      return (await next) as T;
    } finally {
      if (this.locks.get(projectId) === next) this.locks.delete(projectId);
    }
  }
}
